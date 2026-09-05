/**
 * DealFlow360 — Approvals resource hook (real backend)
 */
import { useCallback, useEffect, useState } from 'react';
import { approvalService } from '../services';
import { ApiError } from '../services/httpClient';
import { ApiApprovalRequest, ListQuery } from '../services/apiTypes';

export function useApprovals(query?: ListQuery) {
  const [approvals, setApprovals] = useState<ApiApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await approvalService.getAll(query);
      setApprovals(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Failed to load approvals.', 'UNKNOWN_ERROR', 0));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { approvals, loading, error, refetch };
}
