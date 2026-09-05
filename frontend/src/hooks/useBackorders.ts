/**
 * DealFlow360 — Backorders resource hook (real backend)
 */
import { useCallback, useEffect, useState } from 'react';
import { backorderService } from '../services';
import { ApiError } from '../services/httpClient';
import { ApiBackorder, ListQuery } from '../services/apiTypes';

export function useBackorders(query?: ListQuery) {
  const [backorders, setBackorders] = useState<ApiBackorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await backorderService.getAll(query);
      setBackorders(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Failed to load backorders.', 'UNKNOWN_ERROR', 0));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { backorders, loading, error, refetch };
}
