/**
 * DealFlow360 — Invoices resource hook (real backend)
 */
import { useCallback, useEffect, useState } from 'react';
import { billingService } from '../services';
import { ApiError } from '../services/httpClient';
import { ApiInvoice, ListQuery } from '../services/apiTypes';

export function useInvoices(query?: ListQuery) {
  const [invoices, setInvoices] = useState<ApiInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await billingService.getInvoices(query);
      setInvoices(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Failed to load invoices.', 'UNKNOWN_ERROR', 0));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { invoices, loading, error, refetch };
}

export function useInvoice(id: string | undefined) {
  const [invoice, setInvoice] = useState<ApiInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setInvoice(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await billingService.getInvoiceById(id);
      setInvoice(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Failed to load invoice.', 'UNKNOWN_ERROR', 0));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { invoice, loading, error, refetch };
}
