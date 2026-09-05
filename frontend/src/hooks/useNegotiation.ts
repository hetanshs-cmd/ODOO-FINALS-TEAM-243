/**
 * DealFlow360 — Negotiation thread hook (real backend)
 *
 * Shared by both the customer portal (PortalMessagesPage) and the internal
 * sales-rep negotiation panel, so a message either side sends actually
 * reaches the other through the backend (POST /negotiations/:id/messages)
 * instead of only updating a local mock store — that mismatch was the root
 * cause of customer messages never reaching the sales rep.
 */
import { useCallback, useEffect, useState } from 'react';
import { negotiationService } from '../services';
import { ApiError } from '../services/httpClient';
import { ApiNegotiation, ApiNegotiationMessage } from '../services/apiTypes';

type NegotiationWithMessages = ApiNegotiation & { messages: ApiNegotiationMessage[] };

export function useNegotiation(quotationId: string | undefined) {
  const [negotiation, setNegotiation] = useState<NegotiationWithMessages | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const refetch = useCallback(async () => {
    if (!quotationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const threads = await negotiationService.listForQuotation(quotationId);
      const active =
        threads.find((n) => n.status === 'OPEN' || n.status === 'IN_PROGRESS') ??
        threads[0] ??
        null;
      setNegotiation(active);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError('Failed to load negotiation.', 'UNKNOWN_ERROR', 0));
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!quotationId || !message.trim()) return;
      setSending(true);
      try {
        // Resumes the existing OPEN/IN_PROGRESS thread if one exists,
        // otherwise opens a new one — see negotiationService.openOrResume.
        const thread = negotiation ?? (await negotiationService.openOrResume(quotationId));
        await negotiationService.addMessage(thread.id, { message: message.trim(), message_type: 'TEXT' });
        await refetch();
      } catch (err) {
        setError(err instanceof ApiError ? err : new ApiError('Failed to send message.', 'UNKNOWN_ERROR', 0));
        throw err;
      } finally {
        setSending(false);
      }
    },
    [quotationId, negotiation, refetch],
  );

  return {
    negotiation,
    messages: negotiation?.messages ?? [],
    loading,
    sending,
    error,
    sendMessage,
    refetch,
  };
}
