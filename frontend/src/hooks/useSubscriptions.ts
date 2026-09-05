/**
 * DealFlow360 — Subscriptions resource hook (real backend)
 * Plain useState/useEffect data fetching — no React Query, per project
 * constraints. Exposes a manual refetch() rather than caching/revalidation.
 */
import { useCallback, useEffect, useState } from 'react';
import { subscriptionService } from '../services';
import { ApiError } from '../services/httpClient';
import { ApiSubscription, ListQuery } from '../services/apiTypes';

export function useSubscriptions(query?: ListQuery) {
  const [subscriptions, setSubscriptions] = useState<ApiSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await subscriptionService.getAll(query);
      setSubscriptions(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Failed to load subscriptions.', 'UNKNOWN_ERROR', 0));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { subscriptions, loading, error, refetch };
}

export function useSubscription(id: string | undefined) {
  const [subscription, setSubscription] = useState<ApiSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await subscriptionService.getById(id);
      setSubscription(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Failed to load subscription.', 'UNKNOWN_ERROR', 0));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { subscription, loading, error, refetch };
}
