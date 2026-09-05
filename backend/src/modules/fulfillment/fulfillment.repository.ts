import { PoolClient } from 'pg';
import { db } from '../../config/database';
import { Fulfillment, FulfillmentItem } from './fulfillment.model';

export interface SalesOrderForAllocation {
  id: string;
  status: string;
  sales_rep_id: string;
}

export interface SalesOrderItemForAllocation {
  id: string;
  product_id: string;
  quantity: string;
}

export interface InventoryForUpdateRow {
  warehouse_id: string;
  product_id: string;
  quantity_available: string;
}

export const fulfillmentRepository = {
  async findSalesOrderForAllocation(salesOrderId: string): Promise<SalesOrderForAllocation | null> {
    const { rows } = await db.query(
      'SELECT id, status, sales_rep_id FROM sales_orders WHERE id = $1',
      [salesOrderId],
    );
    return (rows[0] as SalesOrderForAllocation | undefined) ?? null;
  },

  /** Same read under a row lock, so allocate's status check can't be raced. */
  async findSalesOrderForAllocationForUpdate(
    client: PoolClient,
    salesOrderId: string,
  ): Promise<SalesOrderForAllocation | null> {
    const { rows } = await client.query(
      'SELECT id, status, sales_rep_id FROM sales_orders WHERE id = $1 FOR UPDATE',
      [salesOrderId],
    );
    return (rows[0] as SalesOrderForAllocation | undefined) ?? null;
  },

  async listOrderItemsForAllocation(salesOrderId: string): Promise<SalesOrderItemForAllocation[]> {
    const { rows } = await db.query(
      'SELECT id, product_id, quantity FROM sales_order_items WHERE sales_order_id = $1',
      [salesOrderId],
    );
    return rows as SalesOrderItemForAllocation[];
  },

  /**
   * Locks the relevant (warehouse, product) inventory rows for the duration
   * of the allocation transaction so two concurrent allocations can't both
   * read the same available stock and over-commit it.
   */
  async lockInventoryForProducts(
    client: PoolClient,
    productIds: string[],
  ): Promise<InventoryForUpdateRow[]> {
    if (productIds.length === 0) return [];
    const { rows } = await client.query(
      `SELECT i.warehouse_id, i.product_id, i.quantity_on_hand - i.quantity_reserved AS quantity_available
       FROM inventory i
       JOIN warehouses w ON w.id = i.warehouse_id AND w.status = 'ACTIVE'
       WHERE i.product_id = ANY($1::uuid[])
       FOR UPDATE`,
      [productIds],
    );
    return rows as InventoryForUpdateRow[];
  },

  /**
   * Locks and returns the inventory row for ONE product at ONE warehouse.
   *
   * override-split previously took `lockInventoryForProducts(...)[0]`, which
   * is an arbitrary warehouse's row (the query spans every active warehouse
   * and has no ORDER BY) — so it validated availability against one warehouse
   * while reserving stock from another, driving quantity_available negative
   * until the CHECK constraint rejected it with a raw 500.
   */
  async lockInventoryAtWarehouse(
    client: PoolClient,
    warehouseId: string,
    productId: string,
  ): Promise<InventoryForUpdateRow | null> {
    const { rows } = await client.query(
      `SELECT i.warehouse_id, i.product_id, i.quantity_on_hand - i.quantity_reserved AS quantity_available
       FROM inventory i
       WHERE i.warehouse_id = $1 AND i.product_id = $2
       FOR UPDATE`,
      [warehouseId, productId],
    );
    return (rows[0] as InventoryForUpdateRow | undefined) ?? null;
  },

  async reserveInventory(
    client: PoolClient,
    warehouseId: string,
    productId: string,
    quantity: number,
  ): Promise<void> {
    await client.query(
      `UPDATE inventory
       SET quantity_reserved = quantity_reserved + $3
       WHERE warehouse_id = $1 AND product_id = $2`,
      [warehouseId, productId, quantity],
    );
  },

  /** Inverse of reserveInventory — used when an override-split reduces a line's quantity. */
  async releaseReservation(
    client: PoolClient,
    warehouseId: string,
    productId: string,
    quantity: number,
  ): Promise<void> {
    await client.query(
      `UPDATE inventory
       SET quantity_reserved = quantity_reserved - $3
       WHERE warehouse_id = $1 AND product_id = $2`,
      [warehouseId, productId, quantity],
    );
  },

  async releaseAndConsumeInventory(
    client: PoolClient,
    warehouseId: string,
    productId: string,
    quantity: number,
  ): Promise<void> {
    await client.query(
      `UPDATE inventory
       SET quantity_on_hand = quantity_on_hand - $3,
           quantity_reserved = quantity_reserved - $3
       WHERE warehouse_id = $1 AND product_id = $2`,
      [warehouseId, productId, quantity],
    );
  },

  async insertFulfillment(
    client: PoolClient,
    input: { salesOrderId: string; warehouseId: string },
  ): Promise<Fulfillment> {
    const { rows } = await client.query(
      `INSERT INTO fulfillments (sales_order_id, warehouse_id) VALUES ($1, $2) RETURNING *`,
      [input.salesOrderId, input.warehouseId],
    );
    return rows[0] as Fulfillment;
  },

  async insertFulfillmentItem(
    client: PoolClient,
    input: { fulfillmentId: string; salesOrderItemId: string; quantity: number },
  ): Promise<FulfillmentItem> {
    const { rows } = await client.query(
      `INSERT INTO fulfillment_items (fulfillment_id, sales_order_item_id, quantity)
       VALUES ($1, $2, $3) RETURNING *`,
      [input.fulfillmentId, input.salesOrderItemId, input.quantity],
    );
    return rows[0] as FulfillmentItem;
  },

  async insertBackorder(
    client: PoolClient,
    input: { salesOrderId: string; salesOrderItemId: string; productId: string; quantity: number },
  ): Promise<void> {
    await client.query(
      `INSERT INTO backorders (sales_order_id, sales_order_item_id, product_id, quantity)
       VALUES ($1, $2, $3, $4)`,
      [input.salesOrderId, input.salesOrderItemId, input.productId, input.quantity],
    );
  },

  async addFulfilledQuantity(
    client: PoolClient,
    salesOrderItemId: string,
    quantity: number,
  ): Promise<void> {
    await client.query(
      `UPDATE sales_order_items SET fulfilled_quantity = fulfilled_quantity + $2 WHERE id = $1`,
      [salesOrderItemId, quantity],
    );
  },

  async updateSalesOrderStatus(
    client: PoolClient,
    salesOrderId: string,
    status: string,
  ): Promise<void> {
    await client.query('UPDATE sales_orders SET status = $2 WHERE id = $1', [salesOrderId, status]);
  },

  /** Deal-health scores are keyed by quotation, not sales order — resolve the link. */
  async findQuotationIdForSalesOrder(salesOrderId: string): Promise<string | null> {
    const { rows } = await db.query('SELECT quotation_id FROM sales_orders WHERE id = $1', [
      salesOrderId,
    ]);
    return (rows[0] as { quotation_id: string } | undefined)?.quotation_id ?? null;
  },

  async findById(id: string): Promise<Fulfillment | null> {
    const { rows } = await db.query('SELECT * FROM fulfillments WHERE id = $1', [id]);
    return (rows[0] as Fulfillment | undefined) ?? null;
  },

  async findByIdForUpdate(client: PoolClient, id: string): Promise<Fulfillment | null> {
    const { rows } = await client.query('SELECT * FROM fulfillments WHERE id = $1 FOR UPDATE', [
      id,
    ]);
    return (rows[0] as Fulfillment | undefined) ?? null;
  },

  async updateStatus(client: PoolClient, id: string, status: string): Promise<Fulfillment> {
    const { rows } = await client.query(
      'UPDATE fulfillments SET status = $2 WHERE id = $1 RETURNING *',
      [id, status],
    );
    return rows[0] as Fulfillment;
  },

  /** Item + its product_id, for override-split's inventory-delta math. */
  async findItemForFulfillment(
    client: PoolClient,
    fulfillmentId: string,
    salesOrderItemId: string,
  ): Promise<(FulfillmentItem & { product_id: string }) | null> {
    const { rows } = await client.query(
      `SELECT fi.*, soi.product_id
       FROM fulfillment_items fi
       JOIN sales_order_items soi ON soi.id = fi.sales_order_item_id
       WHERE fi.fulfillment_id = $1 AND fi.sales_order_item_id = $2
       FOR UPDATE OF fi`,
      [fulfillmentId, salesOrderItemId],
    );
    return (rows[0] as (FulfillmentItem & { product_id: string }) | undefined) ?? null;
  },

  async updateItemQuantity(
    client: PoolClient,
    id: string,
    quantity: number,
  ): Promise<FulfillmentItem> {
    const { rows } = await client.query(
      'UPDATE fulfillment_items SET quantity = $2 WHERE id = $1 RETURNING *',
      [id, quantity],
    );
    return rows[0] as FulfillmentItem;
  },

  async listItems(fulfillmentId: string): Promise<FulfillmentItem[]> {
    const { rows } = await db.query('SELECT * FROM fulfillment_items WHERE fulfillment_id = $1', [
      fulfillmentId,
    ]);
    return rows as FulfillmentItem[];
  },

  async listBySalesOrder(salesOrderId: string): Promise<Fulfillment[]> {
    const { rows } = await db.query(
      'SELECT * FROM fulfillments WHERE sales_order_id = $1 ORDER BY created_at ASC',
      [salesOrderId],
    );
    return rows as Fulfillment[];
  },

  async findFulfillmentItemsForShip(
    fulfillmentId: string,
  ): Promise<(FulfillmentItem & { product_id: string })[]> {
    const { rows } = await db.query(
      `SELECT fi.*, soi.product_id
       FROM fulfillment_items fi
       JOIN sales_order_items soi ON soi.id = fi.sales_order_item_id
       WHERE fi.fulfillment_id = $1`,
      [fulfillmentId],
    );
    return rows as (FulfillmentItem & { product_id: string })[];
  },

  async markFulfillmentShipped(client: PoolClient, fulfillmentId: string): Promise<Fulfillment> {
    const { rows } = await client.query(
      `UPDATE fulfillments SET status = 'SHIPPED', fulfilled_date = CURRENT_DATE WHERE id = $1 RETURNING *`,
      [fulfillmentId],
    );
    return rows[0] as Fulfillment;
  },

  async markFulfillmentItemsShipped(client: PoolClient, fulfillmentId: string): Promise<void> {
    await client.query(
      `UPDATE fulfillment_items SET status = 'SHIPPED' WHERE fulfillment_id = $1`,
      [fulfillmentId],
    );
  },

  async allItemsFulfilled(client: PoolClient, salesOrderId: string): Promise<boolean> {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS unfulfilled FROM sales_order_items
       WHERE sales_order_id = $1 AND fulfilled_quantity < quantity`,
      [salesOrderId],
    );
    return (rows[0] as { unfulfilled: number }).unfulfilled === 0;
  },
};
