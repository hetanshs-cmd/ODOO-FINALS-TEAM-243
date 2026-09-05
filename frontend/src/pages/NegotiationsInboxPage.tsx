/**
 * DealFlow360 — Sales-Rep Negotiations Inbox
 *
 * Every customer message sent from the portal (PortalMessagesPage) lands
 * in a real `negotiations`/`negotiation_messages` row on the backend now
 * (see useNegotiation.ts) — but until QuotationDetailPage's full migration
 * off the mock store lands (a much larger, separate piece of work), there
 * is no internal page that reads real negotiation data at all. This page
 * is the interim fix: a standalone inbox so a sales rep can actually see
 * and reply to those messages today, backed by GET /negotiations and
 * POST /negotiations/:id/messages.
 */
import React, { useState } from 'react';
import { MessageSquare, Send, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { toast } from '../components/ui/Toast';
import { negotiationService } from '../services';
import { ApiError } from '../services/httpClient';
import { ApiNegotiation, ApiNegotiationMessage } from '../services/apiTypes';
import { useAuth } from '../hooks/useAuth';
import { aiService } from '../services/ai/aiService';
import { AIResult } from '../services/ai/types';
import { AIDraftEditorModal } from '../components/ai/AIDraftEditorModal';

type ThreadSummary = ApiNegotiation & { quotation_number: string; customer_id: string };
type ThreadDetail = ApiNegotiation & { messages?: ApiNegotiationMessage[] };

export const NegotiationsInboxPage: React.FC = () => {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  // AI Insights — real local-model-backed reply draft, grounded in this
  // negotiation thread's live record via backend/src/modules/ai.
  const [aiDrafting, setAiDrafting] = useState(false);
  const [draftResult, setDraftResult] = useState<AIResult | null>(null);
  const [showDraftModal, setShowDraftModal] = useState(false);

  const loadThreads = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await negotiationService.listAll();
      setThreads(data);
    } catch {
      toast.error('Failed to load', 'Could not load the negotiations inbox.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const openThread = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const data = await negotiationService.getById(id);
      setDetail(data);
    } catch {
      toast.error('Failed to load', 'Could not load this conversation.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !replyText.trim()) return;
    setSending(true);
    try {
      await negotiationService.addMessage(selectedId, {
        message: replyText.trim(),
        message_type: 'TEXT',
      });
      setReplyText('');
      await openThread(selectedId);
      toast.success('Reply sent', 'Your reply has been sent to the customer.');
    } catch {
      toast.error('Failed to send', 'Your reply could not be delivered. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleDraftReply = async () => {
    if (!selectedId) return;
    setAiDrafting(true);
    try {
      const result = await aiService.getInsight('draft_negotiation_reply', selectedId);
      setDraftResult(result);
      setShowDraftModal(true);
    } catch (err) {
      toast.error('AI unavailable', err instanceof ApiError ? err.message : 'The local AI model is unavailable.');
    } finally {
      setAiDrafting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Negotiations Inbox"
        description="Real-time messages and counter-offers from customers, across every quotation you own."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1 overflow-hidden" padding="none">
          <div className="max-h-[70vh] overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="p-4 text-xs text-gray-500">Loading threads...</div>
            ) : threads.length === 0 ? (
              <div className="p-4 text-xs text-gray-500">No negotiation threads yet.</div>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => openThread(thread.id)}
                  className={`w-full text-left p-3 text-xs hover:bg-gray-50 transition-colors ${
                    selectedId === thread.id ? 'bg-[#F9F7F9]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">{thread.quotation_number}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {thread.status}
                    </span>
                  </div>
                  <div className="text-gray-400 text-[10px] mt-0.5">
                    {new Date(thread.created_at).toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="md:col-span-2">
          {!selectedId ? (
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Select a thread to view messages.
            </div>
          ) : detailLoading ? (
            <div className="text-xs text-gray-500">Loading conversation...</div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {(detail?.messages ?? []).length === 0 ? (
                  <p className="text-xs text-gray-500">No messages yet.</p>
                ) : (
                  detail?.messages?.map((msg) => {
                    const isMine = msg.sender_user_id === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={`p-2.5 rounded border text-xs ${
                          isMine
                            ? 'bg-[#F9F7F9] border-[#EADEE7] ml-8'
                            : 'bg-gray-50 border-gray-200 mr-8'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-800">
                            {isMine ? 'You' : 'Customer'}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-gray-700">{msg.message}</p>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleReply} className="flex gap-2 pt-2 border-t border-gray-100">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply to the customer..."
                  disabled={sending}
                  className="flex-1 text-xs bg-white border border-gray-300 rounded px-3 py-1.5 text-gray-800 focus:outline-none focus:border-[#714B67]"
                />
                <button
                  type="button"
                  onClick={handleDraftReply}
                  disabled={aiDrafting}
                  className="border border-[#EADEE7] text-[#714B67] hover:bg-[#F9F7F9] px-3 py-1.5 rounded text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> {aiDrafting ? 'Drafting…' : 'AI Draft'}
                </button>
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="bg-[#714B67] hover:bg-[#5A3A52] text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> {sending ? 'Sending...' : 'Reply'}
                </button>
              </form>
            </div>
          )}
        </Card>
      </div>

      {showDraftModal && draftResult?.summary && (
        <AIDraftEditorModal
          isOpen={showDraftModal}
          onClose={() => setShowDraftModal(false)}
          title="Draft Negotiation Reply"
          initialBody={draftResult.summary}
          actionButtonLabel="Use This Reply"
          onApplyOrSend={(body) => {
            setReplyText(body);
            setShowDraftModal(false);
          }}
        />
      )}
    </div>
  );
};
