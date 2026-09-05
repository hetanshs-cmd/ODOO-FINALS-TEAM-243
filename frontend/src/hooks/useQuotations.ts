/**
 * DealFlow360 — Quotations resource hook (real backend)
 * Plain useState/useEffect data fetching — no React Query, per project
 * constraints. Exposes a manual refetch() rather than caching/revalidation.
 */
import { useCallback, useEffect, useState } from 'react';
import { quotationService } from '../services';
import { ApiError } from '../services/httpClient';
import { ApiQuotation, ApiQuotationWithItems, ListQuery } from '../services/apiTypes';

export function useQuotations(query?: ListQuery) {
  const [quotations, setQuotations] = useState<ApiQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await quotationService.getAll(query);
      setQuotations(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Failed to load quotations.', 'UNKNOWN_ERROR', 0));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { quotations, loading, error, refetch };
}

export function useQuotation(id: string | undefined) {
  const [quotation, setQuotation] = useState<ApiQuotationWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setQuotation(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await quotationService.getById(id);
      setQuotation(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Failed to load quotation.', 'UNKNOWN_ERROR', 0));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { quotation, loading, error, refetch };
}
