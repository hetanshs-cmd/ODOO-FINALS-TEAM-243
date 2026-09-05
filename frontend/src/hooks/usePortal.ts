/**
 * DealFlow360 — Customer portal resource hooks (real backend)
 *
 * Every request here is scoped server-side to the portal token's customerId,
 * so these never take a customer id and never filter by one client-side.
 */
import { useCallback, useEffect, useState } from 'react';
import { portalService } from '../services';
import { ApiError } from '../services/httpClient';
import {
  ApiQuotation,
  ApiPortalQuotation,
  ApiPortalProfile,
  ApiPortalNegotiation,
} from '../services/apiTypes';

export function usePortalQuotations() {
  const [quotations, setQuotations] = useState<ApiQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setQuotations(await portalService.getQuotations());
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to load your quotations.', 'UNKNOWN_ERROR', 0)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { quotations, loading, error, refetch };
}

export function usePortalQuotation(id: string | undefined) {
  const [quotation, setQuotation] = useState<ApiPortalQuotation | null>(null);
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
      setQuotation(await portalService.getQuotationById(id));
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to load this quotation.', 'UNKNOWN_ERROR', 0)
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { quotation, loading, error, refetch };
}

export function usePortalProfile() {
  const [profile, setProfile] = useState<ApiPortalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProfile(await portalService.getProfile());
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to load your profile.', 'UNKNOWN_ERROR', 0)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { profile, loading, error, refetch };
}

export function usePortalNegotiations() {
  const [negotiations, setNegotiations] = useState<ApiPortalNegotiation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNegotiations(await portalService.getNegotiations());
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to load your messages.', 'UNKNOWN_ERROR', 0)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { negotiations, loading, error, refetch };
}
