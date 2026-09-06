/**
 * DealFlow360 — Customers resource hook (real backend)
 * Read-only directory (GET /customers), distinct from the ADMIN-only
 * /admin/customers CRUD exposed via adminService.customers.
 */
import { useCallback, useEffect, useState } from 'react';
import { customerService } from '../services';
import { ApiError } from '../services/httpClient';
import { ApiCustomer, ListQuery } from '../services/apiTypes';

export function useCustomers(query?: ListQuery, enabled = true) {
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await customerService.getAll(query);
      setCustomers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Failed to load customers.', 'UNKNOWN_ERROR', 0));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query), enabled]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { customers, loading, error, refetch };
}
