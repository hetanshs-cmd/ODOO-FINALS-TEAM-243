import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { generateDocumentNumber } from '../../shared/documentNumber';
import { getPaginationParams, buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { salesOrdersRepository } from './sales-orders.repository';
import { SalesOrder, SalesOrderWithItems } from './sales-orders.model';

const CONVERTIBLE_STATUSES = new Set(['ACCEPTED']);

export const salesOrdersService = {
  /**
   * Converts an accepted quotation into a sales order — one order line per
   * quotation line, in one transaction (Medusa Workflows pattern, same as
   * discount-engine) so a partial failure never leaves a half-created order
   * or a quotation stuck in CONVERTED with no order behind it.
   */
  async convertFromQuotation(quotationId: string): Promise<SalesOrderWithItems> {
    const quotation = await salesOrdersRepository.findQuotationForConversion(quotationId);
    if (!quotation) throw Errors.notFound('Quotation');

    if (!CONVERTIBLE_STATUSES.has(quotation.status)) {
      throw Errors.businessRuleViolation(
        `Cannot convert a quotation in status ${quotation.status}; it must be ACCEPTED`
      );
    }

    const items = await salesOrdersRepository.listQuotationItemsForConversion(quotationId);
    if (items.length === 0) {
      throw Errors.businessRuleViolation('Quotation has no items to convert');
    }

    return withTransaction(async (client) => {
      const order = await salesOrdersRepository.insert(client, {
        order_number: generateDocumentNumber('SO'),
        quotation_id: quotationId,
        customer_id: quotation.customer_id,
        sales_rep_id: quotation.sales_rep_id,
        subtotal: quotation.subtotal,
        discount_total: quotation.discount_total,
        tax_total: quotation.tax_total,
        grand_total: quotation.grand_total,
      });

      const orderItems = await Promise.all(
        items.map((item) =>
          salesOrdersRepository.insertItem(client, {
            sales_order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount_amount,
            total: item.line_total,
          })
        )
      );

      await salesOrdersRepository.markQuotationConverted(client, quotationId);

      return { ...order, items: orderItems };
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
    page?: unknown;
    limit?: unknown;
  }): Promise<PaginatedResult<SalesOrder>> {
    const pagination = getPaginationParams(query);
    const filters = { status: query.status, customerId: query.customer_id };
    const [items, total] = await Promise.all([
      salesOrdersRepository.list(filters, pagination.limit, pagination.offset),
      salesOrdersRepository.count(filters),
    ]);
    return buildPaginatedResult(items, total, pagination);
  },
};
