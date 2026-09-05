import { randomBytes } from 'crypto';
import { Errors } from '../../errors/AppError';
import { roundMoney } from '../../shared/money';
import { mapDbError } from '../../shared/crud/dbErrors';
import { quotationsRepository } from './quotations.repository';
import { Quotation, QuotationItem, QuotationWithItems } from './quotations.model';

interface CreateQuotationDto {
  customer_id: string;
  sales_rep_id: string;
  price_list_id?: string | null;
  currency: string;
  valid_until?: string | null;
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

function generateQuotationNumber(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `Q-${today}-${suffix}`;
}

export const quotationsService = {
  async create(dto: CreateQuotationDto): Promise<Quotation> {
    try {
      return await quotationsRepository.create({
        quotation_number: generateQuotationNumber(),
        customer_id: dto.customer_id,
        sales_rep_id: dto.sales_rep_id,
        price_list_id: dto.price_list_id ?? null,
        currency: dto.currency,
        valid_until: dto.valid_until ?? null,
      });
    } catch (err) {
      throw mapDbError(err, 'Quotation');
    }
  },

  async getWithItems(id: string): Promise<QuotationWithItems> {
    const quotation = await quotationsRepository.findById(id);
    if (!quotation) throw Errors.notFound('Quotation');
    const items = await quotationsRepository.listItems(id);
    return { ...quotation, items };
  },

  /**
   * Adds a line item and recomputes quotation totals. Discount/tax amounts
   * are always computed server-side from quantity/unit_price/percentages —
   * a client-supplied line_total is never trusted (docs/security.md: backend
   * validation/computation is authoritative).
   */
  async addItem(quotationId: string, dto: AddQuotationItemDto): Promise<QuotationItem> {
    const quotation = await quotationsRepository.findById(quotationId);
    if (!quotation) throw Errors.notFound('Quotation');
    if (quotation.status !== 'DRAFT') {
      throw Errors.businessRuleViolation(
        `Cannot add items to a quotation in status ${quotation.status}; only DRAFT quotations are editable`
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
