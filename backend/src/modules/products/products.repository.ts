import { db } from '../../config/database';

export interface ProductListRow {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category_id: string;
  product_type: string;
  base_price: string;
  unit: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const productsRepository = {
  /**
   * Flat, unpaginated array — same shape convention as the sibling
   * /customers and /users directories (frontend's ApiProduct[] contract,
   * see services/index.ts::productService.getAll). Deliberately omits
   * cost_price: margin data stays admin/finance-only even though every
   * internal role can browse the catalog.
   */
  async list(): Promise<ProductListRow[]> {
    const { rows } = await db.query(
      `SELECT id, sku, name, description, category_id, product_type,
              base_price, unit, status, created_at, updated_at
       FROM products
       ORDER BY name ASC`,
    );
    return rows as ProductListRow[];
  },
};
