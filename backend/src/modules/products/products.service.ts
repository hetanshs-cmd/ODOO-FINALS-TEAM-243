import { productsRepository, ProductListRow } from './products.repository';

export const productsService = {
  /**
   * Read-only directory for the sales org — distinct from the ADMIN-only
   * /admin/products CRUD, which is unchanged.
   */
  async list(): Promise<ProductListRow[]> {
    return productsRepository.list();
  },
};
