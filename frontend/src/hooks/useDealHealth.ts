/**
 * DealFlow360 — Deal health alerts hook (real backend)
 *
 * GET /deal-health returns only OPEN alerts (see deal-health.repository.ts:
 * listOpenAlerts), so acting on one removes it from the next refetch rather
 * than leaving a resolved row in the list.
 */
import { useCallback, useEffect, useState } from 'react';
import { dealHealthService } from '../services';
import { ApiError } from '../services/httpClient';
import { ApiDealAlert, ListQuery } from '../services/apiTypes';

export function useDealHealthAlerts(query?: ListQuery) {
  const [alerts, setAlerts] = useState<ApiDealAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dealHealthService.listAlerts(query);
      setAlerts(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to load deal health alerts.', 'UNKNOWN_ERROR', 0)
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { alerts, loading, error, refetch };
}
