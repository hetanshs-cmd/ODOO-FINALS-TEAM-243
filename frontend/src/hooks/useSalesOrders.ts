/**
 * DealFlow360 — Sales Orders resource hook (real backend)
 * SalesOrder is a real, distinct entity from Quotation — see
 * frontend/src/types/index.ts and backend/src/modules/sales-orders.
 */
import { useCallback, useEffect, useState } from 'react';
import { salesOrderService } from '../services';
import { ApiError } from '../services/httpClient';
import { ListQuery } from '../services/apiTypes';
import { SalesOrder } from '../types';

export function useSalesOrders(query?: ListQuery) {
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await salesOrderService.getAll(query);
      setSalesOrders(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Failed to load sales orders.', 'UNKNOWN_ERROR', 0));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { salesOrders, loading, error, refetch };
}

export function useSalesOrder(id: string | undefined) {
  const [salesOrder, setSalesOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setSalesOrder(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await salesOrderService.getById(id);
      setSalesOrder(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Failed to load sales order.', 'UNKNOWN_ERROR', 0));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { salesOrder, loading, error, refetch };
}
