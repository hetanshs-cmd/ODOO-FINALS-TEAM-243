/**
 * DealFlow360 — Admin CRUD Service
 * Thin typed client over the generic /admin/* CRUD resources (see
 * backend/src/shared/crud + backend/src/modules/admin/*). Every resource
 * shares the same five verbs, so one factory covers all ten.
 *
 * All of these require the ADMIN role server-side (backend/src/modules/admin/admin.routes.ts).
 * A non-admin caller gets a 403 ApiError (`FORBIDDEN`) — callers should
 * catch ApiError and show a clean "you don't have access" message rather
 * than letting it surface as an unhandled crash.
 */

import { httpClient, ApiError, getListItems } from './httpClient';
import type {
  ListQuery,
  ApiWarehouse,
  ApiProduct,
  ApiProductCategory,
  ApiRecommendationRule,
  ApiDiscountRule,
  ApiApprovalLevel,
} from './apiTypes';

export function createAdminResource<T extends { id: string }>(resourcePath: string) {
  const base = `/admin/${resourcePath}`;
  return {
    // Every /admin/* list route returns the pagination envelope (see
    // shared/crud), never a bare array — getListItems unwraps .items so
    // this factory's own Promise<T[]> return type is actually true. Every
    // admin list page (warehouses, discount tiers, products, ...) had been
    // assigning the raw envelope straight into an array-typed state.
    async list(query?: ListQuery): Promise<T[]> {
      return getListItems<T>(base, { query });
    },
    async getById(id: string): Promise<T> {
      return httpClient.get<T>(`${base}/${id}`);
    },
    async create(data: Partial<T>): Promise<T> {
      return httpClient.post<T>(base, data);
    },
    async update(id: string, data: Partial<T>): Promise<T> {
      return httpClient.patch<T>(`${base}/${id}`, data);
    },
    async remove(id: string): Promise<void> {
      await httpClient.delete<void>(`${base}/${id}`);
    },
  };
}

export const adminService = {
  productCategories: createAdminResource<ApiProductCategory>('product-categories'),
  products: createAdminResource<ApiProduct>('products'),
  priceLists: createAdminResource('price-lists'),
  customers: createAdminResource('customers'),
  customerTiers: createAdminResource('customer-tiers'),
  discountRules: createAdminResource<ApiDiscountRule>('discount-rules'),
  approvalLevels: createAdminResource<ApiApprovalLevel>('approval-levels'),
  warehouses: createAdminResource<ApiWarehouse>('warehouses'),
  subscriptionPlans: createAdminResource('subscription-plans'),
  recommendationRules: createAdminResource<ApiRecommendationRule>('recommendation-rules'),
};

export function isForbiddenError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.isForbidden;
}

// TODO: no backend endpoint exists yet for a targeted "restock" action on a
// warehouse (only generic PATCH /admin/warehouses/:id for whole-record
// updates). Surfaced explicitly here so callers can disable/hide restock UI
// rather than silently no-op or fabricate a write.
export function isWarehouseRestockSupported(): boolean {
  return false;
}
