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

import { httpClient, ApiError } from './httpClient';
import type { ListQuery } from './apiTypes';

export function createAdminResource<T extends { id: string }>(resourcePath: string) {
  const base = `/admin/${resourcePath}`;
  return {
    async list(query?: ListQuery): Promise<T[]> {
      return httpClient.get<T[]>(base, { query });
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
  productCategories: createAdminResource('product-categories'),
  products: createAdminResource('products'),
  priceLists: createAdminResource('price-lists'),
  customers: createAdminResource('customers'),
  customerTiers: createAdminResource('customer-tiers'),
  discountRules: createAdminResource('discount-rules'),
  approvalLevels: createAdminResource('approval-levels'),
  warehouses: createAdminResource('warehouses'),
  subscriptionPlans: createAdminResource('subscription-plans'),
  recommendationRules: createAdminResource('recommendation-rules'),
};

export function isForbiddenError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.isForbidden;
}
