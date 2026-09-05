import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { notificationsService } from '../notifications/notifications.service';
import { dealHealthService } from '../deal-health/deal-health.service';
import { insertAuditLog } from '../../shared/auditLog';
import { allocateAcrossWarehouses, InventoryRow, OrderItemToAllocate } from './warehouseAllocation';
import { fulfillmentRepository } from './fulfillment.repository';
import { Fulfillment } from './fulfillment.model';

const ALLOCATABLE_STATUSES = new Set(['PENDING', 'CONFIRMED']);
const SHIPPABLE_STATUSES = new Set(['PENDING', 'IN_PROGRESS']);
// A split can only be accepted/overridden before it starts shipping.
const SPLIT_EDITABLE_STATUSES = new Set(['PENDING']);

export interface OverrideSplitItem {
  sales_order_item_id: string;
  quantity: number;
}

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

      await insertAuditLog(client, {
        entityType: 'fulfillment',
        entityId: fulfillmentId,
        action: 'FULFILLMENT_SHIPPED',
        actorId: null,
        newValue: { salesOrderId: fulfillment.sales_order_id, fullyFulfilled },
      });

      return updated;
    }).then(async (updated) => {
      const quotationId = await fulfillmentRepository.findQuotationIdForSalesOrder(
        fulfillment.sales_order_id,
      );
      if (quotationId) await dealHealthService.recalculate(quotationId);
      return updated;
    });
  },

  /** Confirms the system-suggested warehouse allocation as final: PENDING -> IN_PROGRESS. */
  async acceptSplit(fulfillmentId: string): Promise<Fulfillment> {
    return withTransaction(async (client) => {
      const fulfillment = await fulfillmentRepository.findByIdForUpdate(client, fulfillmentId);
      if (!fulfillment) throw Errors.notFound('Fulfillment');
      if (!SPLIT_EDITABLE_STATUSES.has(fulfillment.status)) {
        throw Errors.businessRuleViolation(
          `Cannot accept a split for a fulfillment in status ${fulfillment.status}`,
        );
      }
      const updated = await fulfillmentRepository.updateStatus(client, fulfillmentId, 'IN_PROGRESS');
      await insertAuditLog(client, {
        entityType: 'fulfillment',
        entityId: fulfillmentId,
        action: 'FULFILLMENT_SPLIT_ACCEPTED',
        actorId: null,
      });
      return updated;
    });
  },

  /**
   * Lets an operator manually adjust the quantities already allocated to
   * this fulfillment (e.g. correcting a system-suggested split before it
   * ships). Only quantities on lines already part of this fulfillment can
   * be changed here — moving a line to a *different* warehouse means
   * cancelling and re-allocating, out of scope for this endpoint. Each
   * requested quantity is validated against that warehouse's current
   * available inventory before being applied, and the inventory
   * reservation is adjusted by the delta (up or down) in the same
   * transaction.
   */
  async overrideSplit(fulfillmentId: string, items: OverrideSplitItem[]): Promise<Fulfillment> {
    if (items.length === 0) {
      throw Errors.businessRuleViolation('At least one item override is required');
    }
    return withTransaction(async (client) => {
      const fulfillment = await fulfillmentRepository.findByIdForUpdate(client, fulfillmentId);
      if (!fulfillment) throw Errors.notFound('Fulfillment');
      if (!SPLIT_EDITABLE_STATUSES.has(fulfillment.status)) {
        throw Errors.businessRuleViolation(
          `Cannot override a split for a fulfillment in status ${fulfillment.status}`,
        );
      }

      for (const override of items) {
        const item = await fulfillmentRepository.findItemForFulfillment(
          client,
          fulfillmentId,
          override.sales_order_item_id,
        );
        if (!item) {
          throw Errors.businessRuleViolation(
            `Sales order item ${override.sales_order_item_id} is not part of this fulfillment`,
          );
        }

        const currentQuantity = Number(item.quantity);
        const delta = override.quantity - currentQuantity;
        if (delta === 0) continue;

        if (delta > 0) {
          const [inventoryRow] = await fulfillmentRepository.lockInventoryForProducts(client, [
            item.product_id,
          ]);
          const available = inventoryRow ? Number(inventoryRow.quantity_available) : 0;
          if (available < delta) {
            throw Errors.businessRuleViolation(
              `Not enough available inventory at this warehouse to increase ${item.product_id} by ${delta}`,
            );
          }
          await fulfillmentRepository.reserveInventory(
            client,
            fulfillment.warehouse_id,
            item.product_id,
            delta,
          );
        } else {
          await fulfillmentRepository.releaseReservation(
            client,
            fulfillment.warehouse_id,
            item.product_id,
            -delta,
          );
        }

        await fulfillmentRepository.updateItemQuantity(client, item.id, override.quantity);
      }

      await insertAuditLog(client, {
        entityType: 'fulfillment',
        entityId: fulfillmentId,
        action: 'FULFILLMENT_SPLIT_OVERRIDDEN',
        actorId: null,
        newValue: { items },
      });

      return fulfillment;
    });
  },
};
