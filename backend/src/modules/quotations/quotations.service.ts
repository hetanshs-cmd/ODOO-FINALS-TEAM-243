import { Errors } from '../../errors/AppError';
import { roundMoney } from '../../shared/money';
import { generateDocumentNumber } from '../../shared/documentNumber';
import { mapDbError } from '../../shared/crud/dbErrors';
import { getPaginationParams, buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { quotationsRepository } from './quotations.repository';
import { Quotation, QuotationItem, QuotationWithItems } from './quotations.model';
import { AuthenticatedUser } from '../auth/auth.types';

interface CreateQuotationDto {
  customer_id: string;
  price_list_id?: string | null;
  currency: string;
  valid_until?: string | null;
}

// A plain sales rep only works their own quotations; managers/admins can
// act on any quotation (matches quotations.routes.ts's stated intent, now
// actually enforced here instead of just in a comment).
function assertCanAccessQuotation(quotation: Quotation, requester: AuthenticatedUser): void {
  if (requester.role === 'SALES_REP' && quotation.sales_rep_id !== requester.id) {
    throw Errors.forbidden();
  }
}

interface AddQuotationItemDto {
  product_id: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  tax_percent?: number;
  billing_type: 'ONE_TIME' | 'RECURRING';
}

export const quotationsService = {
  async create(dto: CreateQuotationDto, salesRepId: string): Promise<Quotation> {
    try {
      return await quotationsRepository.create({
        quotation_number: generateDocumentNumber('Q'),
        customer_id: dto.customer_id,
        // Always the authenticated caller — never client-supplied — so a
        // quotation can't be created under someone else's name.
        sales_rep_id: salesRepId,
        price_list_id: dto.price_list_id ?? null,
        currency: dto.currency,
        valid_until: dto.valid_until ?? null,
      });
    } catch (err) {
      throw mapDbError(err, 'Quotation');
    }
  },

  async getWithItems(id: string, requester: AuthenticatedUser): Promise<QuotationWithItems> {
    const quotation = await quotationsRepository.findById(id);
    if (!quotation) throw Errors.notFound('Quotation');
    assertCanAccessQuotation(quotation, requester);
    const items = await quotationsRepository.listItems(id);
    return { ...quotation, items };
  },

  /** A sales rep only sees their own quotations; managers/admins see everything. */
  async list(
    query: { status?: string; customer_id?: string; page?: unknown; limit?: unknown },
    requester: AuthenticatedUser,
  ): Promise<PaginatedResult<Quotation>> {
    const pagination = getPaginationParams(query);
    const filters = {
      status: query.status,
      customerId: query.customer_id,
      salesRepId: requester.role === 'SALES_REP' ? requester.id : undefined,
    };
    const [items, total] = await Promise.all([
      quotationsRepository.list(filters, pagination.limit, pagination.offset),
      quotationsRepository.count(filters),
    ]);
    return buildPaginatedResult(items, total, pagination);
  },

  /** Only DRAFT quotations are editable — matches addItem's own rule. */
  async update(
    id: string,
    dto: { price_list_id?: string | null; currency?: string; valid_until?: string | null },
    requester: AuthenticatedUser,
  ): Promise<Quotation> {
    const quotation = await quotationsRepository.findById(id);
    if (!quotation) throw Errors.notFound('Quotation');
    assertCanAccessQuotation(quotation, requester);
    if (quotation.status !== 'DRAFT') {
      throw Errors.businessRuleViolation(
        `Cannot edit a quotation in status ${quotation.status}; only DRAFT quotations are editable`,
      );
    }
    const updated = await quotationsRepository.update(id, dto);
    if (!updated) throw Errors.notFound('Quotation');
    return updated;
  },

  /**
   * Adds a line item and recomputes quotation totals. Discount/tax amounts
   * are always computed server-side from quantity/unit_price/percentages —
   * a client-supplied line_total is never trusted (docs/security.md: backend
   * validation/computation is authoritative).
   */
  async addItem(
    quotationId: string,
    dto: AddQuotationItemDto,
    requester: AuthenticatedUser,
  ): Promise<QuotationItem> {
    const quotation = await quotationsRepository.findById(quotationId);
    if (!quotation) throw Errors.notFound('Quotation');
    assertCanAccessQuotation(quotation, requester);
    if (quotation.status !== 'DRAFT') {
      throw Errors.businessRuleViolation(
        `Cannot add items to a quotation in status ${quotation.status}; only DRAFT quotations are editable`,
      );
    }

    const discountPercent = dto.discount_percent ?? 0;
    const taxPercent = dto.tax_percent ?? 0;

    const lineSubtotal = roundMoney(dto.quantity * dto.unit_price);
    const discountAmount = roundMoney(lineSubtotal * (discountPercent / 100));
    const taxableAmount = roundMoney(lineSubtotal - discountAmount);
    const taxAmount = roundMoney(taxableAmount * (taxPercent / 100));
    const lineTotal = roundMoney(taxableAmount + taxAmount);

    try {
      const item = await quotationsRepository.addItem({
        quotation_id: quotationId,
        product_id: dto.product_id,
        description: dto.description ?? null,
        quantity: dto.quantity,
        unit_price: dto.unit_price,
        discount_percent: discountPercent,
        discount_amount: discountAmount,
        tax_percent: taxPercent,
        line_total: lineTotal,
        billing_type: dto.billing_type,
      });
      await quotationsRepository.recalculateTotals(quotationId);
      return item;
    } catch (err) {
      throw mapDbError(err, 'Quotation item');
    }
  },
};
