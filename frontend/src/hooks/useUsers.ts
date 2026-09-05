/**
 * DealFlow360 — Users resource hook (real backend)
 * id/name/role directory (GET /users) used for approver/assignee/sales-rep
 * display names across list pages.
 */
import { useCallback, useEffect, useState } from 'react';
import { userService } from '../services';
import { ApiError } from '../services/httpClient';
import { ApiUser, ListQuery } from '../services/apiTypes';

export function useUsers(query?: ListQuery) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userService.getAll(query);
      setUsers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Failed to load users.', 'UNKNOWN_ERROR', 0));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { users, loading, error, refetch };
}
