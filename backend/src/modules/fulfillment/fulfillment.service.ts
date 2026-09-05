import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { notificationsService } from '../notifications/notifications.service';
import { dealHealthService } from '../deal-health/deal-health.service';
import { allocateAcrossWarehouses, InventoryRow, OrderItemToAllocate } from './warehouseAllocation';
import { fulfillmentRepository } from './fulfillment.repository';
import { Fulfillment } from './fulfillment.model';

const ALLOCATABLE_STATUSES = new Set(['PENDING', 'CONFIRMED']);
const SHIPPABLE_STATUSES = new Set(['PENDING', 'IN_PROGRESS']);

export interface AllocateResult {
  salesOrderId: string;
  fulfillments: Fulfillment[];
  backorderCount: number;
  status: string;
}

export const fulfillmentService = {
  /**
   * Warehouse split: load state, run the pure allocation algorithm, then
   * persist fulfillments/fulfillment_items/backorders and update inventory
   * reservations as one transaction (same explicit-step-sequence pattern
   * used by discount-engine, so a failure partway through never leaves
   * inventory reserved without a matching fulfillment row).
   */
  async allocate(salesOrderId: string): Promise<AllocateResult> {
    const order = await fulfillmentRepository.findSalesOrderForAllocation(salesOrderId);
    if (!order) throw Errors.notFound('Sales order');
    if (!ALLOCATABLE_STATUSES.has(order.status)) {
      throw Errors.businessRuleViolation(
        `Cannot allocate a sales order in status ${order.status}; it must be PENDING or CONFIRMED`
      );
    }

    const orderItems = await fulfillmentRepository.listOrderItemsForAllocation(salesOrderId);
    if (orderItems.length === 0) {
      throw Errors.businessRuleViolation('Sales order has no items to allocate');
    }

    const itemsToAllocate: OrderItemToAllocate[] = orderItems.map((item) => ({
      salesOrderItemId: item.id,
      productId: item.product_id,
      quantity: Number(item.quantity),
    }));
    const productIds = [...new Set(itemsToAllocate.map((item) => item.productId))];

    return withTransaction(async (client) => {
      const inventoryRows = await fulfillmentRepository.lockInventoryForProducts(client, productIds);
      const inventory: InventoryRow[] = inventoryRows.map((row) => ({
        warehouseId: row.warehouse_id,
        productId: row.product_id,
        quantityAvailable: Number(row.quantity_available),
      }));

      const { allocations, backorders } = allocateAcrossWarehouses(itemsToAllocate, inventory);

      const fulfillments: Fulfillment[] = [];
      for (const allocation of allocations) {
        const fulfillment = await fulfillmentRepository.insertFulfillment(client, {
          salesOrderId,
          warehouseId: allocation.warehouseId,
        });
        for (const line of allocation.items) {
          await fulfillmentRepository.insertFulfillmentItem(client, {
            fulfillmentId: fulfillment.id,
            salesOrderItemId: line.salesOrderItemId,
            quantity: line.quantity,
          });
          await fulfillmentRepository.reserveInventory(
            client,
            allocation.warehouseId,
            line.productId,
            line.quantity
          );
        }
        fulfillments.push(fulfillment);
      }

      for (const backorder of backorders) {
        await fulfillmentRepository.insertBackorder(client, {
          salesOrderId,
          salesOrderItemId: backorder.salesOrderItemId,
          productId: backorder.productId,
          quantity: backorder.quantity,
        });
        await fulfillmentRepository.addBackorderedQuantity(
          client,
          backorder.salesOrderItemId,
          backorder.quantity
        );
      }

      const status = backorders.length > 0 ? 'PARTIALLY_FULFILLED' : 'PROCESSING';
      await fulfillmentRepository.updateSalesOrderStatus(client, salesOrderId, status);

      return { salesOrderId, fulfillments, backorderCount: backorders.length, status };
    }).then(async (result) => {
      if (result.backorderCount > 0) {
        await notificationsService.notify({
          userId: order.sales_rep_id,
          type: 'BACKORDER_CREATED',
          title: 'Backorder created',
          message: `${result.backorderCount} line(s) on sales order ${salesOrderId} could not be fully allocated`,
          referenceType: 'sales_order',
          referenceId: salesOrderId,
        });
      }
      // A backorder/partial allocation is a fulfillment-delay signal that
      // feeds deal-health — refresh the linked quotation's score.
      const quotationId = await fulfillmentRepository.findQuotationIdForSalesOrder(salesOrderId);
      if (quotationId) await dealHealthService.recalculate(quotationId);
      return result;
    });
  },

  async getWithItems(id: string) {
    const fulfillment = await fulfillmentRepository.findById(id);
    if (!fulfillment) throw Errors.notFound('Fulfillment');
    const items = await fulfillmentRepository.listItems(id);
    return { ...fulfillment, items };
  },

  async listBySalesOrder(salesOrderId: string) {
    return fulfillmentRepository.listBySalesOrder(salesOrderId);
  },

  /**
   * Marks a fulfillment (and its items) SHIPPED: stock physically leaves
   * the warehouse (on_hand and reserved both drop), the covered sales
   * order items record their fulfilled quantity, and the parent sales
   * order is promoted to FULFILLED once every line is fully covered.
   */
  async ship(fulfillmentId: string): Promise<Fulfillment> {
    const fulfillment = await fulfillmentRepository.findById(fulfillmentId);
    if (!fulfillment) throw Errors.notFound('Fulfillment');
    if (!SHIPPABLE_STATUSES.has(fulfillment.status)) {
      throw Errors.businessRuleViolation(
        `Cannot ship a fulfillment in status ${fulfillment.status}`
      );
    }

    const items = await fulfillmentRepository.findFulfillmentItemsForShip(fulfillmentId);

    return withTransaction(async (client) => {
      const updated = await fulfillmentRepository.markFulfillmentShipped(client, fulfillmentId);
      await fulfillmentRepository.markFulfillmentItemsShipped(client, fulfillmentId);

      for (const item of items) {
        await fulfillmentRepository.releaseAndConsumeInventory(
          client,
          fulfillment.warehouse_id,
          item.product_id,
          Number(item.quantity)
        );
        await fulfillmentRepository.addFulfilledQuantity(client, item.sales_order_item_id, Number(item.quantity));
      }

      const fullyFulfilled = await fulfillmentRepository.allItemsFulfilled(client, fulfillment.sales_order_id);
      await fulfillmentRepository.updateSalesOrderStatus(
        client,
        fulfillment.sales_order_id,
        fullyFulfilled ? 'FULFILLED' : 'PARTIALLY_FULFILLED'
      );

      return updated;
    }).then(async (updated) => {
      const quotationId = await fulfillmentRepository.findQuotationIdForSalesOrder(
        fulfillment.sales_order_id,
      );
      if (quotationId) await dealHealthService.recalculate(quotationId);
      return updated;
    });
  },
};
