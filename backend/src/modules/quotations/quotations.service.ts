import { Errors } from '../../errors/AppError';
import { roundMoney } from '../../shared/money';
import { generateDocumentNumber } from '../../shared/documentNumber';
import { mapDbError } from '../../shared/crud/dbErrors';
import { withTransaction } from '../../shared/db/withTransaction';
import { insertAuditLog } from '../../shared/auditLog';
import { runPostCommit } from '../../shared/postCommit';
import { getPaginationParams, buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { quotationsRepository } from './quotations.repository';
import { Quotation, QuotationItem, QuotationWithItems } from './quotations.model';
import { AuthenticatedUser } from '../auth/auth.types';
import { discountEngineService } from '../discount-engine/discount-engine.service';
import { dealHealthService } from '../deal-health/deal-health.service';

interface CreateQuotationDto {
  customer_id: string;
  title?: string | null;
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
      // The insert and its audit row go in one transaction, per
      // shared/auditLog.ts's own contract ("always call this from inside the
      // same withTransaction block as the mutation it records"). Previously
      // the audit write used the pool, so a failed audit left an unaudited
      // quotation behind.
      return await withTransaction(async (client) => {
        const quotation = await quotationsRepository.create(client, {
          quotation_number: generateDocumentNumber('Q'),
          title: dto.title?.trim() ? dto.title.trim() : null,
          customer_id: dto.customer_id,
          // Always the authenticated caller — never client-supplied — so a
          // quotation can't be created under someone else's name.
          sales_rep_id: salesRepId,
          price_list_id: dto.price_list_id ?? null,
          currency: dto.currency,
          valid_until: dto.valid_until ?? null,
        });
        await insertAuditLog(client, {
          entityType: 'quotation',
          entityId: quotation.id,
          action: 'QUOTATION_CREATED',
          actorId: salesRepId,
          newValue: { customer_id: dto.customer_id, currency: dto.currency },
        });
        return quotation;
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
    dto: {
      title?: string | null;
      price_list_id?: string | null;
      currency?: string;
      valid_until?: string | null;
      order_discount_percent?: number;
    },
    requester: AuthenticatedUser,
  ): Promise<Quotation> {
    const quotation = await quotationsRepository.findById(id);
    if (!quotation) throw Errors.notFound('Quotation');
    assertCanAccessQuotation(quotation, requester);
    // The title is just a label with no bearing on pricing or governance, so
    // renaming a proposal stays allowed at any status. Every other field here
    // feeds the money math and remains DRAFT-only.
    const editsBeyondTitle = Object.keys(dto).some((k) => k !== 'title' && dto[k as keyof typeof dto] !== undefined);
    if (quotation.status !== 'DRAFT' && editsBeyondTitle) {
      throw Errors.businessRuleViolation(
        `Cannot edit a quotation in status ${quotation.status}; only DRAFT quotations are editable`,
      );
    }
    const normalized =
      dto.title !== undefined ? { ...dto, title: dto.title?.trim() ? dto.title.trim() : null } : dto;
    const updated = await quotationsRepository.update(id, normalized);
    if (!updated) throw Errors.notFound('Quotation');

    if (dto.order_discount_percent !== undefined) {
      // Same reasoning as addItem: the order-level discount is itself a
      // discount/negotiation signal deal-health scores on.
      await runPostCommit('quotations.update', () =>
        dealHealthService.recalculate(id).then(() => undefined),
      );
    }

    return updated;
  },

  /**
   * Adds a line item. Discount/tax amounts are never computed here (or
   * stored) — `quotation_item_amounts`/`quotation_totals` (006_quotations.sql)
   * are the single canonical formula, so this only inserts the raw inputs
   * (quantity/unit_price/percentages) and reads the computed figures back
   * from that view — never trusting a client-supplied total either way
   * (docs/security.md: backend validation/computation is authoritative).
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

    // margin_percent is computed from the product's cost_price when one is
    // on record — null-safe, since cost_price is nullable on older/manual
    // product rows (docs/architecture.md: never guess a missing cost).
    const costPrice = await quotationsRepository.findProductCostPrice(dto.product_id);
    const marginPercent =
      costPrice !== null && dto.unit_price !== 0
        ? roundMoney(((dto.unit_price - Number(costPrice)) / dto.unit_price) * 100)
        : null;

    let item: QuotationItem;
    try {
      item = await quotationsRepository.addItem({
        quotation_id: quotationId,
        product_id: dto.product_id,
        description: dto.description ?? null,
        quantity: dto.quantity,
        unit_price: dto.unit_price,
        discount_percent: discountPercent,
        tax_percent: taxPercent,
        billing_type: dto.billing_type,
      });
    } catch (err) {
      throw mapDbError(err, 'Quotation item');
    }
    item.margin_percent = marginPercent;

    // Deal-health score depends on the quotation's current discount/negotiation
    // signals, so refresh it whenever a line item changes them — keeps the
    // score from going stale between explicit submit/negotiation events.
    // The item is already committed, so a scoring failure must not 500 the
    // request and invite a retry that adds the line a second time.
    await runPostCommit('quotations.addItem', () =>
      dealHealthService.recalculate(quotationId).then(() => undefined),
    );

    return item;
  },

  /** Same DRAFT-only rule and margin/deal-health handling as addItem. */
  async updateItem(
    quotationId: string,
    itemId: string,
    dto: Partial<{
      quantity: number;
      unit_price: number;
      discount_percent: number;
      tax_percent: number;
      description: string | null;
    }>,
    requester: AuthenticatedUser,
  ): Promise<QuotationItem> {
    const quotation = await quotationsRepository.findById(quotationId);
    if (!quotation) throw Errors.notFound('Quotation');
    assertCanAccessQuotation(quotation, requester);
    if (quotation.status !== 'DRAFT') {
      throw Errors.businessRuleViolation(
        `Cannot edit items on a quotation in status ${quotation.status}; only DRAFT quotations are editable`,
      );
    }
    const existingItem = await quotationsRepository.findItem(quotationId, itemId);
    if (!existingItem) throw Errors.notFound('Quotation item');

    let item: QuotationItem | null;
    try {
      item = await quotationsRepository.updateItem(itemId, dto);
    } catch (err) {
      throw mapDbError(err, 'Quotation item');
    }
    if (!item) throw Errors.notFound('Quotation item');

    if (item.product_id) {
      const costPrice = await quotationsRepository.findProductCostPrice(item.product_id);
      const unitPrice = Number(item.unit_price);
      item.margin_percent =
        costPrice !== null && unitPrice !== 0
          ? roundMoney(((unitPrice - Number(costPrice)) / unitPrice) * 100)
          : null;
    }

    await runPostCommit('quotations.updateItem', () =>
      dealHealthService.recalculate(quotationId).then(() => undefined),
    );

    return item;
  },

  /** Same DRAFT-only rule as addItem/updateItem. */
  async removeItem(quotationId: string, itemId: string, requester: AuthenticatedUser): Promise<void> {
    const quotation = await quotationsRepository.findById(quotationId);
    if (!quotation) throw Errors.notFound('Quotation');
    assertCanAccessQuotation(quotation, requester);
    if (quotation.status !== 'DRAFT') {
      throw Errors.businessRuleViolation(
        `Cannot remove items from a quotation in status ${quotation.status}; only DRAFT quotations are editable`,
      );
    }
    const existingItem = await quotationsRepository.findItem(quotationId, itemId);
    if (!existingItem) throw Errors.notFound('Quotation item');

    await quotationsRepository.removeItem(itemId);

    await runPostCommit('quotations.removeItem', () =>
      dealHealthService.recalculate(quotationId).then(() => undefined),
    );
  },

  async getTimeline(id: string, requester: AuthenticatedUser) {
    const quotation = await quotationsRepository.findById(id);
    if (!quotation) throw Errors.notFound('Quotation');
    assertCanAccessQuotation(quotation, requester);
    return quotationsRepository.listTimeline(id);
  },

  /**
   * DRAFT -> SUBMITTED is the only status transition owned directly by this
   * service; every later transition (APPROVED/PENDING_APPROVAL/...) happens
   * as a side effect of the discount engine or approvals flow. Submitting
   * immediately (and synchronously) runs the discount-engine check so a
   * ceiling breach is caught and routed to approval right away, instead of
   * requiring a separate explicit call to POST /:id/check-discounts.
   */
  async submit(id: string, requester: AuthenticatedUser): Promise<QuotationWithItems> {
    const quotation = await quotationsRepository.findById(id);
    if (!quotation) throw Errors.notFound('Quotation');
    assertCanAccessQuotation(quotation, requester);
    if (quotation.status !== 'DRAFT') {
      throw Errors.businessRuleViolation(
        `Cannot submit a quotation in status ${quotation.status}; only DRAFT quotations can be submitted`,
      );
    }
    const items = await quotationsRepository.listItems(id);
    if (items.length === 0) {
      throw Errors.businessRuleViolation('Cannot submit a quotation with no items');
    }

    await withTransaction(async (client) => {
      await quotationsRepository.updateStatus(client, id, 'SUBMITTED');
      await insertAuditLog(client, {
        entityType: 'quotation',
        entityId: id,
        action: 'QUOTATION_SUBMITTED',
        actorId: requester.id,
        oldValue: { status: quotation.status },
        newValue: { status: 'SUBMITTED' },
      });
    });

    // Auto-invoke discount governance now that the quotation is submitted —
    // this itself moves status on to APPROVED or PENDING_APPROVAL, may
    // create an approval_requests row, and (per discountEngineService)
    // refreshes the deal-health score as part of its own post-commit step.
    //
    // The check runs in its own transaction, so a failure here (e.g. no
    // approval levels configured) would otherwise leave the quotation
    // stranded in SUBMITTED while the caller sees an error. Roll the status
    // back to DRAFT so submit stays all-or-nothing from the caller's side.
    try {
      await discountEngineService.checkDiscounts(id);
    } catch (err) {
      await withTransaction(async (client) => {
        await quotationsRepository.updateStatus(client, id, quotation.status);
        await insertAuditLog(client, {
          entityType: 'quotation',
          entityId: id,
          action: 'QUOTATION_SUBMIT_ROLLED_BACK',
          actorId: requester.id,
          oldValue: { status: 'SUBMITTED' },
          newValue: { status: quotation.status },
        });
      });
      throw err;
    }

    const updated = await quotationsRepository.findById(id);
    const updatedItems = await quotationsRepository.listItems(id);
    return { ...(updated as Quotation), items: updatedItems };
  },
};
