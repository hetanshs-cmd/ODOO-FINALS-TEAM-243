/**
 * DealFlow360 — Customer Portal Pages (Screen 11, real backend)
 *
 * PortalQuotationPage now reads from the portal-scoped endpoints
 * (GET /portal/quotations, GET /portal/quotations/:id — added below as
 * portalService in ../services) instead of the mock quotations/customers
 * fields. Cross-customer access control that the mock version enforced
 * client-side (via getCustomerVisibleQuotation) is now the backend's job:
 * the portal endpoints are scoped to the authenticated customer's own
 * token, so there is no client-side "wrong customer" case to guard against
 * here.
 *
 * The mock's rich per-line negotiation UI (governance-evaluated
 * counter-offers with an automatic Path A/Path B accept-or-escalate
 * simulation, per-line threaded Q&A) depended on domain engines
 * (getCustomerVisibleQuotation, getLineMessages) wired to the mock
 * Quotation/negotiation shapes with no real-backend equivalent at that
 * granularity. Simplified to a single "Request Changes" message flow
 * against the real negotiation endpoints (open + addMessage) rather than
 * fabricating the governance simulation.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Calendar,
  Building2,
  Mail,
  Phone,
  Check,
  Info,
  Layers,
  Tag,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../components/ui/Toast';
import { portalService, negotiationService } from '../services';
import { ApiQuotationWithItems, ApiNegotiation, ApiNegotiationMessage } from '../services/apiTypes';
import { ApiError } from '../services/httpClient';

// =========================================================================
// SCREEN 11: MY QUOTATION & NEGOTIATION INTERFACE
// =========================================================================

export const PortalQuotationPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [quotes, setQuotes] = useState<ApiQuotationWithItems[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [quotesError, setQuotesError] = useState<string | null>(null);

  useEffect(() => {
    setQuotesLoading(true);
    portalService
      .getQuotations()
      .then((data) => setQuotes(data as ApiQuotationWithItems[]))
      .catch((err) => setQuotesError(err instanceof ApiError ? err.message : 'Failed to load your quotations.'))
      .finally(() => setQuotesLoading(false));
  }, []);

  const selectedQuoteId = searchParams.get('id') || quotes[0]?.id;
  const quote = useMemo(() => quotes.find((q) => q.id === selectedQuoteId) || null, [quotes, selectedQuoteId]);

  const [showRequestChangesForm, setShowRequestChangesForm] = useState(false);
  const [negotiationMessage, setNegotiationMessage] = useState(
    'We would like to discuss adjusting terms on this proposal before confirming.'
  );
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  if (quotesLoading) {
    return <div className="max-w-xl mx-auto py-12 text-center text-xs text-gray-500">Loading your quotations…</div>;
  }

  if (quotesError) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-xs text-gray-600">{quotesError}</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
          <FileText className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">No Active Quotation Found</h2>
        <p className="text-xs text-gray-500 mb-4">There are currently no open commercial proposals on your account.</p>
      </div>
    );
  }

  const canNegotiate = quote.status === 'SENT_TO_CUSTOMER' || quote.status === 'NEGOTIATION';
  const canConfirm = quote.status === 'SENT_TO_CUSTOMER';
  const isConfirmed = quote.status === 'ACCEPTED' || quote.status === 'CONVERTED';
  const isUnderReview = quote.status === 'NEGOTIATION';

  const grandTotal = Number(quote.grand_total);
  const discountTotal = Number(quote.discount_total);
  const taxTotal = Number(quote.tax_total);

  const handleSubmitRequestChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRequest(true);
    try {
      let negotiation: ApiNegotiation;
      try {
        negotiation = await negotiationService.open(quote.id);
      } catch (err) {
        // A negotiation may already be open for this quotation — that's not
        // fatal, we just can't post a fresh message without its id in that
        // case (no "get negotiation by quotation id" lookup is exposed).
        throw err;
      }
      await negotiationService.addMessage(negotiation.id, { message: negotiationMessage, message_type: 'TEXT' });
      setShowRequestChangesForm(false);
      toast.success('Request Sent', 'Your requested changes have been sent to your account team for review.');
    } catch (err) {
      toast.error('Submission Failed', err instanceof ApiError ? err.message : 'Unable to submit your request.');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleConfirmQuotation = async () => {
    if (!confirmCheckbox) {
      setConfirmError('Please check the box to confirm acceptance of commercial terms.');
      return;
    }
    setIsConfirming(true);
    setConfirmError(null);
    try {
      // NOTE: there is no dedicated "customer accepts" portal endpoint
      // documented yet; quotationService.convert (POST /quotations/:id/convert)
      // is the closest real transition (quotation -> sales order) and is
      // attempted here. If the portal token isn't authorized for it, the
      // backend will 403 and that's surfaced below rather than faked.
      const { quotationService } = await import('../services');
      await quotationService.convert(quote.id);
      setShowConfirmModal(false);
      toast.success('Quotation Confirmed!', `Thank you, ${user.name}. Quotation ${quote.quotation_number} is confirmed.`);
    } catch (err) {
      setConfirmError(
        err instanceof ApiError
          ? `${err.message} (TODO: a dedicated portal-scoped confirm endpoint may be needed if convert is internal-only.)`
          : 'Unable to confirm quotation at this time.'
      );
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      {quotes.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-gray-500 font-medium">Your Proposals:</span>
          {quotes.map((q) => (
            <button
              key={q.id}
              onClick={() => setSearchParams({ id: q.id })}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer border ${
                q.id === quote.id ? 'bg-[#714B67] text-white border-[#714B67]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {q.quotation_number}
            </button>
          ))}
        </div>
      )}

      {/* Quotation Header Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Quotation {quote.quotation_number}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  isConfirmed
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : isUnderReview
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-purple-50 text-purple-700 border-purple-200'
                }`}
              >
                {quote.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-600">
              {quote.valid_until && (
                <span className="flex items-center gap-1 text-gray-600">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  Valid until: <strong className="text-gray-800">{new Date(quote.valid_until).toLocaleDateString()}</strong>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {canNegotiate && (
              <button
                type="button"
                onClick={() => setShowRequestChangesForm(!showRequestChangesForm)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
              >
                <Tag className="w-3.5 h-3.5 text-[#714B67]" />
                <span>{showRequestChangesForm ? 'Close Form' : 'Request Changes'}</span>
              </button>
            )}

            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => setShowConfirmModal(true)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-all shadow-sm ${
                canConfirm ? 'bg-[#714B67] hover:bg-[#5A3A52] text-white cursor-pointer' : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isConfirmed ? 'Quotation Confirmed' : 'Confirm Quotation'}</span>
            </button>
          </div>
        </div>

        <div
          className={`mt-4 p-3 rounded-md text-xs border flex items-start gap-2.5 ${
            isConfirmed ? 'bg-blue-50/70 border-blue-200 text-blue-900' : isUnderReview ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-[#F9F7F9] border-[#EADEE7] text-[#5A3A52]'
          }`}
        >
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-current opacity-80" />
          <div className="flex-1 leading-relaxed">
            <p className="font-semibold">
              {isConfirmed
                ? 'This quotation has been confirmed.'
                : isUnderReview
                ? 'Your requested changes are under review by our commercial team.'
                : 'Review the proposal below and confirm or request changes.'}
            </p>
          </div>
        </div>
      </div>

      {/* Request Changes Form — simplified against real negotiation endpoints */}
      {showRequestChangesForm && canNegotiate && (
        <div className="bg-white rounded-lg border border-[#714B67]/30 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#714B67]" />
              <h2 className="text-sm font-bold text-gray-900">Request Changes</h2>
            </div>
          </div>

          <form onSubmit={handleSubmitRequestChanges} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Your Message</label>
              <textarea
                rows={3}
                value={negotiationMessage}
                onChange={(e) => setNegotiationMessage(e.target.value)}
                className="w-full text-xs bg-white border border-gray-300 rounded p-2.5 text-gray-800 focus:outline-none focus:border-[#714B67]"
                placeholder="Explain the changes you'd like to request..."
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRequestChangesForm(false)}
                className="px-3 py-1.5 rounded text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingRequest}
                className="inline-flex items-center gap-1.5 bg-[#714B67] hover:bg-[#5A3A52] text-white px-4 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                <Send className="w-3 h-3" />
                <span>{isSubmittingRequest ? 'Sending...' : 'Send Request'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Line Items */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Commercial Line Items Review</span>
          </div>
          <span className="text-xs text-gray-500">{(quote.items || []).length} item(s)</span>
        </div>

        <div className="divide-y divide-gray-200">
          {(quote.items || []).map((line) => (
            <div key={line.id} className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {/* TODO: resolve product display name — this line only carries product_id. */}
                    <span className="text-sm font-bold text-gray-900 font-mono">{line.product_id}</span>
                    {line.billing_type === 'RECURRING' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200">
                        Subscription
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500 mt-1">
                    <span>{line.quantity} × ${Number(line.unit_price).toLocaleString()}</span>
                    {Number(line.discount_percent) > 0 && (
                      <span className="text-[#059669] font-medium">Discount: {line.discount_percent}%</span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-gray-900">${Number(line.line_total).toLocaleString()}</span>
                  <div className="text-[10px] text-gray-400">Line Total</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#714B67]" />
            <span>Commercial Terms & Guarantee</span>
          </div>
          <div className="text-xs text-gray-600 space-y-2 leading-relaxed">
            <p>• Standard delivery and support terms apply as outlined in your service agreement.</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs space-y-3">
          <div className="text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-100">
            Commercial Financial Summary
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-gray-800">${Number(quote.subtotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[#059669] font-medium">
              <span>Discount:</span>
              <span className="font-bold">-${discountTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax:</span>
              <span className="font-semibold text-gray-800">${taxTotal.toLocaleString()}</span>
            </div>
            <div className="pt-2.5 border-t border-gray-200 flex justify-between items-baseline">
              <span className="text-sm font-extrabold text-gray-900">Total Contract Value:</span>
              <span className="text-lg font-black text-[#714B67]">${grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-gray-200 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
              <div className="w-8 h-8 rounded-full bg-[#F3EDF2] text-[#714B67] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">Confirm Commercial Proposal {quote.quotation_number}</h3>
            </div>

            {confirmError && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">{confirmError}</div>}

            <p className="text-xs text-gray-600 leading-relaxed">
              By confirming, you agree to the line items, discounts, and payment terms outlined in proposal <strong>{quote.quotation_number}</strong>.
            </p>

            <div className="bg-gray-50 p-3 rounded border border-gray-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Contract Amount:</span>
                <strong className="text-gray-900">${grandTotal.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Authorizing Representative:</span>
                <strong className="text-gray-900">{user.name}</strong>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={confirmCheckbox}
                onChange={(e) => setConfirmCheckbox(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-[#714B67] focus:ring-[#714B67]"
              />
              <span className="leading-tight">I confirm that I am authorized to accept these commercial terms.</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-3.5 py-1.5 rounded text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!confirmCheckbox || isConfirming}
                onClick={handleConfirmQuotation}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold transition-all ${
                  confirmCheckbox && !isConfirming ? 'bg-[#714B67] hover:bg-[#5A3A52] text-white cursor-pointer shadow-sm' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isConfirming ? 'Confirming...' : 'Accept & Confirm Quotation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================================
// SCREEN 11: MESSAGES TAB (/portal/messages)
// =========================================================================
// Already wired to real negotiationService calls (open/addMessage) —
// verified as part of this migration. Adjusted to fetch the customer's
// negotiation thread via the portal quotations list rather than the mock
// store, since that's the only real per-quotation reference available here.

export const PortalMessagesPage: React.FC = () => {
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<ApiQuotationWithItems[]>([]);
  const [negotiation, setNegotiation] = useState<(ApiNegotiation & { messages?: ApiNegotiationMessage[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessageText, setNewMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setLoading(true);
    portalService
      .getQuotations()
      .then(async (data) => {
        setQuotes(data as ApiQuotationWithItems[]);
        // Best-effort: open (or reuse) a negotiation thread for the first
        // quotation so there's something to display messages against.
        // There's no "get negotiation by quotation id" lookup exposed, so
        // this always opens fresh rather than resuming a prior thread.
        if (data.length > 0) {
          try {
            const neg = await negotiationService.open(data[0].id);
            const full = await negotiationService.getById(neg.id);
            setNegotiation(full);
          } catch {
            setNegotiation(null);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const primaryQuote = quotes[0];

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !negotiation) return;
    setIsSending(true);
    try {
      await negotiationService.addMessage(negotiation.id, { message: newMessageText.trim(), message_type: 'TEXT' });
      setNewMessageText('');
      const full = await negotiationService.getById(negotiation.id);
      setNegotiation(full);
      toast.success('Message Dispatched', 'Your message has been sent to your account team.');
    } catch (err) {
      toast.error('Failed to send', err instanceof ApiError ? err.message : 'Unknown error.');
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return <div className="max-w-4xl mx-auto py-12 text-center text-xs text-gray-500">Loading messages…</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#714B67]" />
            <span>Commercial Inquiries & Discussion</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Direct communication channel with your account team.</p>
        </div>
        {primaryQuote && (
          <div className="text-xs bg-gray-50 px-3 py-1.5 rounded border border-gray-200 text-gray-600">
            Proposal: <strong>{primaryQuote.quotation_number}</strong>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-2xs">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            placeholder="Ask a question regarding delivery timelines, commercial terms, or line items..."
            className="flex-1 text-xs bg-white border border-gray-300 rounded px-3 py-1.5 text-gray-800 focus:outline-none focus:border-[#714B67]"
            disabled={!negotiation}
          />
          <button
            type="submit"
            disabled={!negotiation || isSending}
            className="bg-[#714B67] hover:bg-[#5A3A52] text-white px-4 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>

      <div className="space-y-3">
        {!negotiation || !negotiation.messages || negotiation.messages.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-xs text-gray-500">
            No message history recorded yet. Use the input above to ask your account team a question.
          </div>
        ) : (
          negotiation.messages.map((msg) => (
            <div key={msg.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900">
                    {msg.sender_user_id === user.id ? user.name : msg.sender_user_id}
                  </span>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{msg.message_type}</span>
                </div>
                <span className="text-[11px] text-gray-400">{new Date(msg.created_at).toLocaleString()}</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">{msg.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// =========================================================================
// SCREEN 11: CUSTOMER PROFILE TAB (/portal/profile)
// =========================================================================
// No customer-profile-read endpoint is confirmed to exist yet. Rather than
// fabricate company/contact/address fields (as the mock version did with
// hardcoded fallbacks), show only what's genuinely available from the
// portal auth token (customer_id) plus a clear TODO.

export const PortalProfilePage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#F3EDF2] text-[#714B67] flex items-center justify-center font-bold text-base">
            {user.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{user.name}</h1>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-100">
          <Building2 className="w-4 h-4 text-[#714B67]" />
          <span>Account</span>
        </div>
        <div className="space-y-2.5 text-xs">
          <div>
            <span className="text-gray-400 block text-[11px]">Customer ID:</span>
            <span className="font-mono font-semibold text-gray-800">{user.customerId || '—'}</span>
          </div>
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px]">
            TODO: no customer-profile-read endpoint is confirmed to exist yet. Company name, tier,
            industry, and contact/shipping addresses will be shown here once one is added — they are
            intentionally omitted rather than fabricated.
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-100">
          <Mail className="w-4 h-4 text-[#714B67]" />
          <span>Support</span>
        </div>
        <div className="space-y-2 text-gray-600 text-xs">
          <p>For procurement inquiries, custom contract terms, or billing adjustments, use the Messages tab to reach your account team.</p>
        </div>
      </div>
    </div>
  );
};
