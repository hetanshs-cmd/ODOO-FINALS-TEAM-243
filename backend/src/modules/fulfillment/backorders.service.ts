import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { getPaginationParams, buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { dealHealthService } from '../deal-health/deal-health.service';
import { fulfillmentRepository } from './fulfillment.repository';
import { backordersRepository } from './backorders.repository';
import { Backorder } from './backorders.model';
import { Fulfillment } from './fulfillment.model';

const CONSOLIDATABLE_STATUSES = new Set(['OPEN', 'PARTIALLY_FULFILLED']);

export interface ConsolidateResult {
  backorder: Backorder;
  fulfillment: Fulfillment;
}

export const backordersService = {
  async list(query: { status?: string; page?: unknown; limit?: unknown }): Promise<PaginatedResult<Backorder>> {
    const pagination = getPaginationParams(query);
    const filters = { status: query.status };
    const [items, total] = await Promise.all([
      backordersRepository.list(filters, pagination.limit, pagination.offset),
      backordersRepository.count(filters),
    ]);
    return buildPaginatedResult(items, total, pagination);
  },

  /**
   * Consolidate: now that inventory has arrived, find a warehouse that can
   * fully cover the backordered quantity, create a fulfillment for it (same
   * fulfillments/fulfillment_items/reserve-inventory steps as the original
   * allocation in fulfillment.service.ts::allocate), reduce the sales order
   * item's backordered_quantity, and mark the backorder FULFILLED. Requires
   * a single warehouse to cover the full remaining quantity — a backorder
   * that can only be partially covered is left OPEN for a later retry
   * rather than silently under-shipping it.
   */
  async consolidate(backorderId: string): Promise<ConsolidateResult> {
    const result = await withTransaction(async (client) => {
      const backorder = await backordersRepository.findByIdForUpdate(client, backorderId);
      if (!backorder) throw Errors.notFound('Backorder');
      if (!CONSOLIDATABLE_STATUSES.has(backorder.status)) {
        throw Errors.businessRuleViolation(
          `Cannot consolidate a backorder in status ${backorder.status}`,
        );
      }

      const inventoryRows = await fulfillmentRepository.lockInventoryForProducts(client, [
        backorder.product_id,
      ]);
      const quantityNeeded = Number(backorder.quantity);
      const covering = inventoryRows.find(
        (row) => Number(row.quantity_available) >= quantityNeeded,
      );
      if (!covering) {
        throw Errors.businessRuleViolation(
          'No single warehouse currently has enough available inventory to consolidate this backorder',
        );
      }

      const fulfillment = await fulfillmentRepository.insertFulfillment(client, {
        salesOrderId: backorder.sales_order_id,
        warehouseId: covering.warehouse_id,
      });
      await fulfillmentRepository.insertFulfillmentItem(client, {
        fulfillmentId: fulfillment.id,
        salesOrderItemId: backorder.sales_order_item_id,
        quantity: quantityNeeded,
      });
      await fulfillmentRepository.reserveInventory(
        client,
        covering.warehouse_id,
        backorder.product_id,
        quantityNeeded,
      );
      await backordersRepository.reduceBackorderedQuantity(
        client,
        backorder.sales_order_item_id,
        quantityNeeded,
      );
      const updatedBackorder = await backordersRepository.markFulfilled(client, backorderId);

      return { backorder: updatedBackorder, fulfillment };
    });

    const quotationId = await fulfillmentRepository.findQuotationIdForSalesOrder(
      result.backorder.sales_order_id,
    );
    if (quotationId) await dealHealthService.recalculate(quotationId);

    return result;
  },
};
