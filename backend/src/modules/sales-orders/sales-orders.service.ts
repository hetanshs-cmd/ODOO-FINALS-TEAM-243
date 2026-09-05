import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { generateDocumentNumber } from '../../shared/documentNumber';
import { getPaginationParams, buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { salesOrdersRepository } from './sales-orders.repository';
import { SalesOrder, SalesOrderWithItems } from './sales-orders.model';

/**
 * A quotation is convertible once governance has cleared it: either the
 * approval chain signed it off (APPROVED) or the customer confirmed it
 * through the portal (ACCEPTED).
 *
 * ACCEPTED alone used to be the only accepted status, but nothing in the
 * codebase ever wrote it — the portal confirm flow that produces it did not
 * exist — so every convert attempt failed with a 422 and the entire
 * downstream pipeline (fulfillment, billing, invoicing) was unreachable.
 * `docs/api.md` has always documented this endpoint as accepting
 * APPROVED/ACCEPTED; this matches the documented contract.
 */
const CONVERTIBLE_STATUSES = new Set(['APPROVED', 'ACCEPTED']);

export const salesOrdersService = {
  /**
   * Converts an approved/accepted quotation into a sales order — one order
   * line per quotation line, in one transaction (Medusa Workflows pattern,
   * same as discount-engine) so a partial failure never leaves a half-created
   * order or a quotation stuck in CONVERTED with no order behind it.
   */
  async convertFromQuotation(quotationId: string): Promise<SalesOrderWithItems> {
    const items = await salesOrdersRepository.listQuotationItemsForConversion(quotationId);

    return withTransaction(async (client) => {
      // Re-read under a row lock: the status check and the insert must not be
      // separable by a concurrent convert of the same quotation.
      const quotation = await salesOrdersRepository.findQuotationForConversionForUpdate(
        client,
        quotationId,
      );
      if (!quotation) throw Errors.notFound('Quotation');

      if (!CONVERTIBLE_STATUSES.has(quotation.status)) {
        throw Errors.businessRuleViolation(
          `Cannot convert a quotation in status ${quotation.status}; it must be APPROVED or ACCEPTED`,
        );
      }

      if (items.length === 0) {
        throw Errors.businessRuleViolation('Quotation has no items to convert');
      }

      const order = await salesOrdersRepository.insert(client, {
        order_number: generateDocumentNumber('SO'),
        quotation_id: quotationId,
        customer_id: quotation.customer_id,
        sales_rep_id: quotation.sales_rep_id,
      });

      const orderItems = await Promise.all(
        items.map((item) =>
          salesOrdersRepository.insertItem(client, {
            sales_order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount_amount,
            tax_percent: item.tax_percent,
          }),
        ),
      );

      await salesOrdersRepository.markQuotationConverted(client, quotationId);

      // sales_orders stores no totals (011_sales_orders.sql) — read the
      // just-inserted items back through sales_order_totals so the response
      // still carries subtotal/discount_total/tax_total/grand_total.
      const totals = await salesOrdersRepository.findTotals(client, order.id);

      return { ...order, ...totals, items: orderItems };
    });
  },

  async getWithItems(id: string): Promise<SalesOrderWithItems> {
    const order = await salesOrdersRepository.findById(id);
    if (!order) throw Errors.notFound('Sales order');
    const items = await salesOrdersRepository.listItems(id);
    return { ...order, items };
  },

  async list(query: {
    status?: string;
    customer_id?: string;
    quotation_id?: string;
    page?: unknown;
    limit?: unknown;
  }): Promise<PaginatedResult<SalesOrder>> {
    const pagination = getPaginationParams(query);
    const filters = { status: query.status, customerId: query.customer_id, quotationId: query.quotation_id };
    const [items, total] = await Promise.all([
      salesOrdersRepository.list(filters, pagination.limit, pagination.offset),
      salesOrdersRepository.count(filters),
    ]);
    return buildPaginatedResult(items, total, pagination);
  },
};
