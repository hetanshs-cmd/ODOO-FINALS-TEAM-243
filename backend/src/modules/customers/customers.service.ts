import { customersRepository, CustomerListRow } from './customers.repository';

export const customersService = {
  /**
   * Read-only directory for the sales org — distinct from the ADMIN-only
   * /admin/customers CRUD, which is unchanged. Unpaginated flat array, same
   * shape convention as the sibling /users directory (the frontend's
   * useCustomers hook expects `ApiCustomer[]`, not a paginated envelope).
   */
  async list(): Promise<CustomerListRow[]> {
    return customersRepository.list();
  },
};
