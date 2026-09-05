import { AppError, Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { notificationsService } from '../notifications/notifications.service';
import { dealHealthService } from '../deal-health/deal-health.service';
import { insertAuditLog } from '../../shared/auditLog';
import { runPostCommit } from '../../shared/postCommit';
import { mapDbError } from '../../shared/crud/dbErrors';
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
  async allocate(salesOrderId: string, actorId: string | null = null): Promise<AllocateResult> {
    const order = await fulfillmentRepository.findSalesOrderForAllocation(salesOrderId);
    if (!order) throw Errors.notFound('Sales order');

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
      // Re-read the order under a row lock and re-check the status INSIDE the
      // transaction. Checking it outside let two concurrent allocate calls
      // both pass, creating duplicate fulfillments and double-reserving stock.
      const lockedOrder = await fulfillmentRepository.findSalesOrderForAllocationForUpdate(
        client,
        salesOrderId,
      );
      if (!lockedOrder) throw Errors.notFound('Sales order');
      if (!ALLOCATABLE_STATUSES.has(lockedOrder.status)) {
        throw Errors.businessRuleViolation(
          `Cannot allocate a sales order in status ${lockedOrder.status}; it must be PENDING or CONFIRMED`
        );
      }

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
        // The backordered quantity lives only in the `backorders` row itself
        // (014_backorders.sql) — sales_order_items has no redundant counter
        // to keep in sync (the 2026-09-05 schema refactor dropped it).
        await fulfillmentRepository.insertBackorder(client, {
          salesOrderId,
          salesOrderItemId: backorder.salesOrderItemId,
          productId: backorder.productId,
          quantity: backorder.quantity,
        });
      }

      const status = backorders.length > 0 ? 'PARTIALLY_FULFILLED' : 'PROCESSING';
      await fulfillmentRepository.updateSalesOrderStatus(client, salesOrderId, status);

      await insertAuditLog(client, {
        entityType: 'sales_order',
        entityId: salesOrderId,
        action: 'FULFILLMENT_ALLOCATED',
        actorId,
        newValue: { fulfillmentCount: fulfillments.length, backorderCount: backorders.length, status },
      });

      return { salesOrderId, fulfillments, backorderCount: backorders.length, status };
    }).then(async (result) => {
      // Post-commit side effects. The allocation is already durable, so a
      // failure here must NOT surface as a 500 for an operation that
      // succeeded — the client would retry and double-allocate.
      await runPostCommit('fulfillment.allocate', async () => {
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
      });
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
  async ship(fulfillmentId: string, actorId: string | null = null): Promise<Fulfillment> {
    const items = await fulfillmentRepository.findFulfillmentItemsForShip(fulfillmentId);

    return withTransaction(async (client) => {
      // Lock and re-check inside the transaction. Reading the status outside
      // let two concurrent ship calls both pass, consuming inventory twice
      // and double-counting fulfilled_quantity. acceptSplit/overrideSplit
      // already did this correctly; ship was the outlier.
      const fulfillment = await fulfillmentRepository.findByIdForUpdate(client, fulfillmentId);
      if (!fulfillment) throw Errors.notFound('Fulfillment');
      if (!SHIPPABLE_STATUSES.has(fulfillment.status)) {
        throw Errors.businessRuleViolation(
          `Cannot ship a fulfillment in status ${fulfillment.status}`
        );
      }

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
        actorId,
        newValue: { salesOrderId: fulfillment.sales_order_id, fullyFulfilled },
      });

      return updated;
    }).then(async (updated) => {
      await runPostCommit('fulfillment.ship', async () => {
        const quotationId = await fulfillmentRepository.findQuotationIdForSalesOrder(
          updated.sales_order_id,
        );
        if (quotationId) await dealHealthService.recalculate(quotationId);
      });
      return updated;
    });
  },

  /** Confirms the system-suggested warehouse allocation as final: PENDING -> IN_PROGRESS. */
  async acceptSplit(fulfillmentId: string, actorId: string | null = null): Promise<Fulfillment> {
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
        actorId,
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
  async overrideSplit(
    fulfillmentId: string,
    items: OverrideSplitItem[],
    actorId: string | null = null,
  ): Promise<Fulfillment> {
    if (items.length === 0) {
      throw Errors.businessRuleViolation('At least one item override is required');
    }
    try {
      return await withTransaction(async (client) => {
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
          // Must be this fulfillment's own warehouse — that's where the
          // reservation below is applied.
          const inventoryRow = await fulfillmentRepository.lockInventoryAtWarehouse(
            client,
            fulfillment.warehouse_id,
            item.product_id,
          );
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
        actorId,
        newValue: { items },
      });

      // Re-read rather than returning the row captured before the updates —
      // the caller was previously handed pre-override state.
      const refreshed = await fulfillmentRepository.findByIdForUpdate(client, fulfillmentId);
      return refreshed ?? fulfillment;
      });
    } catch (err) {
      // AppErrors (NOT_FOUND, BUSINESS_RULE_VIOLATION, ...) are already the
      // right shape — only translate raw driver/constraint errors.
      if (err instanceof AppError) throw err;
      // A CHECK-constraint violation on inventory (e.g. quantity_reserved
      // exceeding quantity_on_hand because the wrong warehouse was validated
      // against — see lockInventoryAtWarehouse) used to bubble up as a raw
      // 500 instead of the 422/400 every other module's constraint
      // violations produce.
      throw mapDbError(err, 'Fulfillment override');
    }
  },
};
