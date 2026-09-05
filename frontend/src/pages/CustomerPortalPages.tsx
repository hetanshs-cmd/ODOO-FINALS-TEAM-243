/**
 * DealFlow360 — Customer Portal Pages (Screen 11)
 * Fully functional customer-facing negotiation interface, messages, and profile within PortalShell.
 * 
 * Strict Security Boundaries:
 * - Sanitizes quotation data via getCustomerVisibleQuotation.
 * - Hides all internal deal desk margins, risk scores, and approval chains.
 * - Prevents cross-customer URL tampering.
 * - Triggers canonical discount governance engine for counter-offers.
 */

import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building2,
  Mail,
  Phone,
  Check,
  Info,
  Layers,
  Repeat,
  Tag,
  ArrowRight,
} from 'lucide-react';
import { useDealStore } from '../hooks/useDealStore';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../components/ui/Toast';
import {
  getCustomerVisibleQuotation,
  getLineMessages,
  CustomerVisibleQuotation,
  CustomerVisibleLine,
} from '../domain/customer-portal';

// =========================================================================
// SCREEN 11: MY QUOTATION & NEGOTIATION INTERFACE
// =========================================================================

export const PortalQuotationPage: React.FC = () => {
  const { user } = useAuth();
  const {
    quotations,
    customers,
    negotiations,
    submitCustomerNegotiation,
    addNegotiationMessage,
    confirmQuotation,
  } = useDealStore();
  const [searchParams, setSearchParams] = useSearchParams();

  // Find customer record
  const currentCustomerId = user.customerId || 'CUST-008';
  const customerRecord = customers.find((c) => c.id === currentCustomerId);

  // All quotations belonging to this customer
  const customerQuotes = useMemo(() => {
    return quotations.filter((q) => q.customerId === currentCustomerId);
  }, [quotations, currentCustomerId]);

  // Selected quotation ID from query or default to primary quote
  const selectedQuoteId = searchParams.get('id') || customerQuotes[0]?.id || 'QT-2026-1042';

  // Target raw quotation
  const rawTargetQuote = quotations.find(
    (q) => q.id === selectedQuoteId || q.code === selectedQuoteId
  );

  // Cross-customer security validation (Prompt 45 & 46)
  const isUnauthorized = rawTargetQuote && rawTargetQuote.customerId !== currentCustomerId;

  // Sanitized customer-visible quotation (strips margins, risk scores, approval steps)
  const quote: CustomerVisibleQuotation | null = useMemo(() => {
    if (!rawTargetQuote || isUnauthorized) return null;
    return getCustomerVisibleQuotation(rawTargetQuote, currentCustomerId);
  }, [rawTargetQuote, currentCustomerId, isUnauthorized]);

  // UI States
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [lineQuestionText, setLineQuestionText] = useState<{ [lineId: string]: string }>({});
  const [showCounterOfferForm, setShowCounterOfferForm] = useState<boolean>(false);
  const [targetLineForOffer, setTargetLineForOffer] = useState<string>('all');
  const [counterDiscount, setCounterDiscount] = useState<number>(12);
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState<string>('2026-09-20');
  const [negotiationMessage, setNegotiationMessage] = useState<string>(
    'We are ready to finalize our enterprise agreement if we can adjust the hardware discount to 12% and secure delivery by 20 Sep 2026.'
  );
  const [isSubmittingOffer, setIsSubmittingOffer] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState<boolean>(false);
  const [isConfirming, setIsConfirming] = useState<boolean>(false);

  // Cross-Customer Security Access Denied Screen (Prompt Section 46)
  if (isUnauthorized) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-200">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h1>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          You don't have authorization to view quotation <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 font-mono text-xs">{selectedQuoteId}</code>.
          This commercial proposal was prepared for another organization.
        </p>
        <button
          onClick={() => {
            if (customerQuotes.length > 0) {
              setSearchParams({ id: customerQuotes[0].id });
            }
          }}
          className="inline-flex items-center gap-2 bg-[#714B67] hover:bg-[#5A3A52] text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer shadow-sm"
        >
          <span>Return to My Authorized Quotation</span>
          <ArrowRight className="w-4 h-4" />
        </button>
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
        <p className="text-xs text-gray-500 mb-4">
          There are currently no open commercial proposals prepared for {customerRecord?.name || 'your organization'}.
        </p>
      </div>
    );
  }

  // Handle line item question submission
  const handleSendLineQuestion = (lineId: string) => {
    const text = lineQuestionText[lineId]?.trim();
    if (!text) return;

    addNegotiationMessage({
      quotationId: quote.id,
      lineId,
      message: text,
      authorName: user.name,
      authorRole: 'Customer',
    });

    setLineQuestionText((prev) => ({ ...prev, [lineId]: '' }));
    toast.success('Question Submitted', 'Your question has been sent directly to Sarah Chen and your account team.');
  };

  // Handle counter-offer submission (Executes Path A or Path B governance!)
  const handleCounterOfferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (counterDiscount < 0 || counterDiscount > 100) {
      toast.error('Invalid Discount', 'Please specify a discount percentage between 0% and 100%.');
      return;
    }

    setIsSubmittingOffer(true);

    try {
      const result = submitCustomerNegotiation({
        quotationId: quote.id,
        counterDiscount,
        requestedDeliveryDate,
        message: negotiationMessage,
        lineId: targetLineForOffer === 'all' ? undefined : targetLineForOffer,
        customerActor: { id: user.id, name: user.name },
      });

      setIsSubmittingOffer(false);
      setShowCounterOfferForm(false);

      if (result.path === 'approval_required') {
        // Path B: Exceeds governance limits -> Routed for internal re-approval
        toast.info(
          'Counter-Offer Submitted for Review',
          'Your requested commercial terms have been received and are now being reviewed by our sales desk.'
        );
      } else {
        // Path A: Within governance limits -> Automatically accepted!
        toast.success(
          'Counter-Offer Accepted',
          'Your requested discount has been applied within approved terms. The quotation is ready for confirmation.'
        );
      }
    } catch (err: any) {
      setIsSubmittingOffer(false);
      toast.error('Submission Failed', err?.message || 'Unable to submit counter-offer.');
    }
  };

  // Handle digital quotation confirmation
  const handleConfirmQuotation = () => {
    if (!confirmCheckbox) {
      toast.error('Confirmation Required', 'Please check the box to confirm acceptance of commercial terms.');
      return;
    }

    setIsConfirming(true);

    try {
      confirmQuotation(quote.id, { id: user.id, name: user.name });
      setIsConfirming(false);
      setShowConfirmModal(false);
      toast.success(
        'Quotation Confirmed!',
        `Thank you, ${user.name}. Quotation ${quote.code} is confirmed. Order is moving to fulfillment preparation.`
      );
    } catch (err: any) {
      setIsConfirming(false);
      toast.error('Confirmation Blocked', err?.message || 'Unable to confirm quotation at this time.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Multi-quotation switcher tabs (if customer has more than one proposal) */}
      {customerQuotes.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-gray-500 font-medium">Your Proposals:</span>
          {customerQuotes.map((cq) => (
            <button
              key={cq.id}
              onClick={() => setSearchParams({ id: cq.id })}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer border ${
                cq.id === quote.id
                  ? 'bg-[#714B67] text-white border-[#714B67]'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cq.code} {cq.stage === 'Confirmed' ? '(Confirmed)' : cq.stage === 'Negotiation' ? '(Review)' : ''}
            </button>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. QUOTATION HEADER CARD (Prompt Section 7)                               */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                Quotation {quote.code}
              </h1>
              {/* Customer-facing status badge */}
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  quote.isConfirmed
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : quote.isUnderReview
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : quote.stage === 'Approved'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-purple-50 text-purple-700 border-purple-200'
                }`}
              >
                {quote.customerFacingStatus}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-600">
              <span className="font-medium text-gray-800">{quote.customerName}</span>
              <span className="text-gray-300">•</span>
              <span>Prepared by <strong className="text-gray-800">{quote.repName}</strong> (Account Executive)</span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1 text-gray-600">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                Valid until: <strong className="text-gray-800">{quote.validUntilDate}</strong>
              </span>
              {quote.requestedDeliveryDate && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-[#714B67] font-medium">
                    Requested Delivery: {quote.requestedDeliveryDate}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action CTAs: Request Changes & Confirm Quotation */}
          <div className="flex items-center gap-2.5">
            {quote.canNegotiate && (
              <button
                id="portal-btn-request-changes"
                type="button"
                onClick={() => setShowCounterOfferForm(!showCounterOfferForm)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer shadow-2xs"
              >
                <Tag className="w-3.5 h-3.5 text-[#714B67]" />
                <span>{showCounterOfferForm ? 'Close Form' : 'Request Changes'}</span>
              </button>
            )}

            <button
              id="portal-btn-confirm-quotation"
              type="button"
              disabled={!quote.canConfirm}
              onClick={() => setShowConfirmModal(true)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold transition-all shadow-sm ${
                quote.canConfirm
                  ? 'bg-[#714B67] hover:bg-[#5A3A52] text-white cursor-pointer active:scale-98'
                  : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
              }`}
              title={
                quote.isConfirmed
                  ? 'Quotation already confirmed'
                  : quote.isUnderReview
                  ? "This quotation can't be confirmed while your requested changes are under review."
                  : 'Confirm and lock commercial terms'
              }
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{quote.isConfirmed ? 'Quotation Confirmed' : 'Confirm Quotation'}</span>
            </button>
          </div>
        </div>

        {/* Status Explanation Banner (Prompt Section 8 & 9) */}
        <div
          className={`mt-4 p-3 rounded-md text-xs border flex items-start gap-2.5 ${
            quote.isConfirmed
              ? 'bg-blue-50/70 border-blue-200 text-blue-900'
              : quote.isUnderReview
              ? 'bg-amber-50/70 border-amber-200 text-amber-900'
              : 'bg-[#F9F7F9] border-[#EADEE7] text-[#5A3A52]'
          }`}
        >
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-current opacity-80" />
          <div className="flex-1 leading-relaxed">
            <p className="font-semibold">{quote.statusExplanation}</p>
            {quote.isUnderReview && (
              <p className="text-[11px] text-amber-700 mt-0.5">
                Quotation confirmation is temporarily paused while our commercial team reviews your proposed adjustments. We will notify you via the messages tab once complete.
              </p>
            )}
            {quote.isConfirmed && (
              <p className="text-[11px] text-blue-700 mt-0.5">
                Thank you for your business. The commercial agreement is locked and order transmission has been scheduled.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. REQUEST CHANGES / COUNTER-OFFER FORM (Prompt Section 18-24)             */}
      {/* ========================================================================= */}
      {showCounterOfferForm && quote.canNegotiate && (
        <div className="bg-white rounded-lg border border-[#714B67]/30 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#714B67]" />
              <h2 className="text-sm font-bold text-gray-900">
                Submit Commercial Change Request / Counter-Offer
              </h2>
            </div>
            <span className="text-[11px] text-gray-500">
              Evaluated in real-time against commercial governance
            </span>
          </div>

          <form onSubmit={handleCounterOfferSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Target Line Selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Target Proposal Item
                </label>
                <select
                  value={targetLineForOffer}
                  onChange={(e) => setTargetLineForOffer(e.target.value)}
                  className="w-full text-xs bg-white border border-gray-300 rounded px-2.5 py-1.5 text-gray-800 focus:outline-none focus:border-[#714B67]"
                >
                  <option value="all">Entire Commercial Proposal</option>
                  {quote.lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.productName} ({l.discountPercent}% current)
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  Choose specific line or whole proposal
                </span>
              </div>

              {/* Counter-Offer Discount */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Requested Discount (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={counterDiscount}
                    onChange={(e) => setCounterDiscount(Number(e.target.value))}
                    className="w-full text-xs bg-white border border-gray-300 rounded px-2.5 py-1.5 text-gray-800 focus:outline-none focus:border-[#714B67]"
                    placeholder="e.g. 12"
                  />
                  <span className="absolute right-3 top-1.5 text-xs text-gray-400">%</span>
                </div>
                <span className="text-[10px] text-gray-500 mt-0.5 block">
                  Tip: 12% is within approved limits (Path A). 18% triggers internal re-approval (Path B).
                </span>
              </div>

              {/* Delivery Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Requested Delivery Date
                </label>
                <input
                  type="date"
                  value={requestedDeliveryDate}
                  onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                  className="w-full text-xs bg-white border border-gray-300 rounded px-2.5 py-1.5 text-gray-800 focus:outline-none focus:border-[#714B67]"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  Requested target completion date
                </span>
              </div>
            </div>

            {/* Message / Commercial Rationale */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Commercial Note / Justification
              </label>
              <textarea
                rows={2}
                value={negotiationMessage}
                onChange={(e) => setNegotiationMessage(e.target.value)}
                className="w-full text-xs bg-white border border-gray-300 rounded p-2.5 text-gray-800 focus:outline-none focus:border-[#714B67]"
                placeholder="Explain the reason for this counter-proposal..."
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCounterOfferForm(false)}
                className="px-3 py-1.5 rounded text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                id="portal-btn-submit-counter-offer"
                type="submit"
                disabled={isSubmittingOffer}
                className="inline-flex items-center gap-1.5 bg-[#714B67] hover:bg-[#5A3A52] text-white px-4 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
              >
                <Send className="w-3 h-3" />
                <span>{isSubmittingOffer ? 'Evaluating...' : 'Submit Counter-Offer'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. COMMERCIAL REVIEW TABLE & LINE ITEMS (Prompt Section 11-16)            */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Commercial Line Items Review
            </span>
          </div>
          <span className="text-xs text-gray-500">
            {quote.lines.length} {quote.lines.length === 1 ? 'item' : 'items'} total
          </span>
        </div>

        {/* Lines Table */}
        <div className="divide-y divide-gray-200">
          {quote.lines.map((line: CustomerVisibleLine) => {
            const isExpanded = expandedLineId === line.id;
            const lineQuestions = getLineMessages(negotiations, quote.id, line.id);

            return (
              <div key={line.id} className="p-4 sm:p-5 hover:bg-gray-50/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Item Description */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">
                        {line.productName}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          line.isSubscription
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : line.category === 'Services'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {line.isSubscription ? 'Subscription' : line.category}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500 mt-1">
                      <span>
                        {line.quantity} × ${line.unitPrice.toLocaleString()}
                        {line.isSubscription && ` / ${line.recurringCycle || 'month'}`}
                      </span>
                      {line.discountPercent > 0 && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-[#059669] font-medium">
                            Discount: {line.discountPercent}%
                            {line.previousDiscountPercent !== undefined && line.previousDiscountPercent !== line.discountPercent && (
                              <span className="text-gray-400 line-through ml-1 text-[10px]">
                                {line.previousDiscountPercent}%
                              </span>
                            )}
                          </span>
                        </>
                      )}
                      {line.isSubscription && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-purple-600 flex items-center gap-1 font-medium">
                            <Repeat className="w-3 h-3" />
                            Recurring {line.recurringCycle || 'monthly'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Line Total & Ask Question Action */}
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-gray-900">
                        ${line.lineTotal.toLocaleString()}
                        {line.isSubscription && <span className="text-xs text-gray-500 font-normal"> / mo</span>}
                      </span>
                      <div className="text-[10px] text-gray-400">Line Total</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedLineId(isExpanded ? null : line.id)}
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer ${
                        isExpanded
                          ? 'bg-[#F3EDF2] text-[#714B67] border-[#D8C2D3]'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                      title="Ask a question or view conversation on this line"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {lineQuestions.length > 0 ? `Discussion (${lineQuestions.length})` : 'Ask Question'}
                      </span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Inline Question & Discussion Drawer (Prompt Section 14-16) */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-gray-100 bg-[#F9FAFB] rounded p-3.5 space-y-3">
                    <div className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[#714B67]" />
                      <span>Item Discussion & Clarifications</span>
                    </div>

                    {/* Existing Questions & Responses */}
                    {lineQuestions.length > 0 ? (
                      <div className="space-y-2.5">
                        {lineQuestions.map((q) => (
                          <div key={q.id} className="bg-white p-2.5 rounded border border-gray-200 text-xs space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-gray-800">{q.authorName || q.customerName}</span>
                              <span className="text-gray-400">
                                {new Date(q.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-gray-700">{q.message}</p>

                            {/* Response from Rep */}
                            {q.response && (
                              <div className="mt-2 pt-2 border-t border-gray-100 pl-3 border-l-2 border-l-[#714B67] bg-[#FDFBFD] p-2 rounded">
                                <div className="flex items-center justify-between text-[10px] text-[#714B67] font-semibold">
                                  <span>{quote.repName} (Account Executive)</span>
                                  {q.respondedAt && (
                                    <span className="text-gray-400">
                                      {new Date(q.respondedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-700 text-xs mt-0.5">{q.response}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-500 italic">
                        No previous questions on this line item. Type your inquiry below.
                      </p>
                    )}

                    {/* Line Question Input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={lineQuestionText[line.id] || ''}
                        onChange={(e) =>
                          setLineQuestionText((prev) => ({ ...prev, [line.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendLineQuestion(line.id);
                        }}
                        placeholder={`e.g. Can you confirm whether installation is included with ${line.productName}?`}
                        className="flex-1 text-xs bg-white border border-gray-300 rounded px-3 py-1.5 text-gray-800 focus:outline-none focus:border-[#714B67]"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendLineQuestion(line.id)}
                        className="bg-[#714B67] hover:bg-[#5A3A52] text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer shrink-0"
                      >
                        Submit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. TOTALS & COMMERCIAL BREAKDOWN (Prompt Section 12)                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Commercial Terms & SLA Notes */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-[#714B67]" />
            <span>Commercial Terms & Guarantee</span>
          </div>

          <div className="text-xs text-gray-600 space-y-2 leading-relaxed">
            <p>
              • <strong>Fulfillment & Delivery:</strong> Standard delivery timeline is 7–10 business days upon digital signature. Priority allocation applied for Gold Tier accounts.
            </p>
            <p>
              • <strong>Subscription Billing:</strong> Cloud analytics seats activate upon hardware delivery confirmation. Monthly recurring billing commences on the 1st of each calendar month.
            </p>
            <p>
              • <strong>Warranty & Support:</strong> 3-year hardware advance replacement and 24/7 enterprise technical support included under Enterprise Services agreement.
            </p>
          </div>
        </div>

        {/* Pricing Summary Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs space-y-3">
          <div className="text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-100">
            Commercial Financial Summary
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>One-Time Hardware & Services Subtotal:</span>
              <span className="font-semibold text-gray-800">
                ${quote.oneTimeSubtotal.toLocaleString()}
              </span>
            </div>

            {quote.recurringMonthlySubtotal > 0 && (
              <div className="flex justify-between text-purple-700 font-medium">
                <span className="flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  Monthly Recurring Subscription Subtotal:
                </span>
                <span className="font-bold">
                  ${quote.recurringMonthlySubtotal.toLocaleString()} / mo
                </span>
              </div>
            )}

            <div className="flex justify-between text-[#059669] font-medium">
              <span>Commercial Discount Savings:</span>
              <span className="font-bold">
                -${quote.totalDiscount.toLocaleString()}
              </span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Applicable State & Local Tax (Estimated):</span>
              <span className="font-semibold text-gray-800">
                ${quote.tax.toLocaleString()}
              </span>
            </div>

            <div className="pt-2.5 border-t border-gray-200 flex justify-between items-baseline">
              <div>
                <span className="text-sm font-extrabold text-gray-900">Total Contract Value:</span>
                <div className="text-[10px] text-gray-400">Includes all goods, deployment & licenses</div>
              </div>
              <span className="text-lg font-black text-[#714B67]">
                ${quote.grandTotal.toLocaleString()}
              </span>
            </div>

            {/* First Invoice Projection */}
            <div className="mt-3 p-2.5 bg-gray-50 rounded border border-gray-200 flex justify-between items-center text-xs">
              <span className="text-gray-600">Estimated First Invoice:</span>
              <span className="font-bold text-gray-900">
                ${quote.firstInvoiceEstimate.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. CONFIRMATION MODAL (Prompt Section 35-41)                               */}
      {/* ========================================================================= */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl border border-gray-200 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
              <div className="w-8 h-8 rounded-full bg-[#F3EDF2] text-[#714B67] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Confirm Commercial Proposal {quote.code}
                </h3>
                <p className="text-[11px] text-gray-500">Prepared for {quote.customerName}</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              By confirming, you agree to the line items, agreed discounts, payment terms, and recurring billing schedule outlined in proposal <strong>{quote.code}</strong>.
            </p>

            <div className="bg-gray-50 p-3 rounded border border-gray-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Contract Amount:</span>
                <strong className="text-gray-900">${quote.grandTotal.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Authorizing Representative:</span>
                <strong className="text-gray-900">{user.name}</strong>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-gray-700 cursor-pointer pt-1">
              <input
                id="portal-confirm-checkbox"
                type="checkbox"
                checked={confirmCheckbox}
                onChange={(e) => setConfirmCheckbox(e.target.checked)}
                className="mt-0.5 rounded border-gray-300 text-[#714B67] focus:ring-[#714B67]"
              />
              <span className="leading-tight">
                I confirm that I am authorized to accept commercial terms and commit purchase orders on behalf of <strong>{quote.customerName}</strong>.
              </span>
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
                id="portal-confirm-modal-submit"
                type="button"
                disabled={!confirmCheckbox || isConfirming}
                onClick={handleConfirmQuotation}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold transition-all ${
                  confirmCheckbox && !isConfirming
                    ? 'bg-[#714B67] hover:bg-[#5A3A52] text-white cursor-pointer shadow-sm'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
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

export const PortalMessagesPage: React.FC = () => {
  const { user } = useAuth();
  const { quotations, negotiations, addNegotiationMessage } = useDealStore();
  const currentCustomerId = user.customerId || 'CUST-008';

  // Customer's primary quotation
  const customerQuote =
    quotations.find((q) => q.customerId === currentCustomerId) || quotations[0];

  // All messages / negotiation records for this customer's quotation
  const customerMessages = useMemo(() => {
    return negotiations.filter(
      (n) => n.customerId === currentCustomerId || n.quotationId === customerQuote?.id
    );
  }, [negotiations, currentCustomerId, customerQuote]);

  const [newMessageText, setNewMessageText] = useState<string>('');
  const [selectedTargetLine, setSelectedTargetLine] = useState<string>('general');

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !customerQuote) return;

    addNegotiationMessage({
      quotationId: customerQuote.id,
      lineId: selectedTargetLine === 'general' ? undefined : selectedTargetLine,
      message: newMessageText.trim(),
      authorName: user.name,
      authorRole: 'Customer',
    });

    setNewMessageText('');
    toast.success('Message Dispatched', 'Your message has been sent to your account team.');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#714B67]" />
            <span>Commercial Inquiries & Discussion</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Direct communication channel with your assigned Account Executive (Sarah Chen).
          </p>
        </div>

        <div className="text-xs bg-gray-50 px-3 py-1.5 rounded border border-gray-200 text-gray-600">
          Proposal: <strong>{customerQuote?.code || 'QT-2026-1042'}</strong>
        </div>
      </div>

      {/* Message Composer */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-2xs">
        <form onSubmit={handleSendMessage} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-full sm:w-64">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Relates to
              </label>
              <select
                value={selectedTargetLine}
                onChange={(e) => setSelectedTargetLine(e.target.value)}
                className="w-full text-xs bg-white border border-gray-300 rounded px-2.5 py-1.5 text-gray-800 focus:outline-none focus:border-[#714B67]"
              >
                <option value="general">General Commercial Proposal</option>
                {customerQuote?.lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    Item: {l.productName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Your Question / Inquiry
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Ask a question regarding delivery timelines, commercial terms, or line items..."
                  className="flex-1 text-xs bg-white border border-gray-300 rounded px-3 py-1.5 text-gray-800 focus:outline-none focus:border-[#714B67]"
                />
                <button
                  type="submit"
                  className="bg-[#714B67] hover:bg-[#5A3A52] text-white px-4 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Chronological Message Thread */}
      <div className="space-y-3">
        {customerMessages.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-xs text-gray-500">
            No message history recorded yet. Use the input above to ask your account executive a question.
          </div>
        ) : (
          customerMessages.map((msg) => {
            const targetLine = customerQuote?.lines.find((l) => l.id === msg.lineId);

            return (
              <div
                key={msg.id}
                className="bg-white rounded-lg border border-gray-200 p-4 shadow-2xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">
                      {msg.authorName || msg.customerName}
                    </span>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                      {msg.authorRole || 'Customer'}
                    </span>
                    {targetLine && (
                      <span className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded">
                        Item: {targetLine.productName}
                      </span>
                    )}
                    {msg.type === 'discount_counter' && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
                        Counter-Offer: {msg.requestedDiscount}%
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-gray-400">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-gray-700 leading-relaxed">{msg.message}</p>

                {/* Account Executive Response */}
                {msg.response && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100 pl-3 border-l-2 border-l-[#714B67] bg-[#FDFBFD] p-2.5 rounded">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#714B67]">
                        Sarah Chen (Account Executive)
                      </span>
                      {msg.respondedAt && (
                        <span className="text-gray-400 text-[10px]">
                          {new Date(msg.respondedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-700 mt-1">{msg.response}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// =========================================================================
// SCREEN 11: CUSTOMER PROFILE TAB (/portal/profile) (Prompt Section 43-44)
// =========================================================================

export const PortalProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { customers } = useDealStore();
  const currentCustomerId = user.customerId || 'CUST-008';
  const customer = customers.find((c) => c.id === currentCustomerId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#F3EDF2] text-[#714B67] flex items-center justify-center font-bold text-base">
            {user.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{user.name}</h1>
            <p className="text-xs text-gray-500">
              {user.title || 'Director of Procurement'} • {customer?.company || customer?.name || 'Enterprise Customer'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Organization Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-100">
            <Building2 className="w-4 h-4 text-[#714B67]" />
            <span>Organization Procurement Profile</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-gray-400 block text-[11px]">Company / Entity:</span>
              <span className="font-semibold text-gray-800">{customer?.company || customer?.name}</span>
            </div>

            <div>
              <span className="text-gray-400 block text-[11px]">Enterprise Account Tier:</span>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                {customer?.tier || 'Gold'} Tier Partner
              </span>
            </div>

            <div>
              <span className="text-gray-400 block text-[11px]">Industry Sector:</span>
              <span className="font-medium text-gray-700">{customer?.industry || 'Industrial Automation'}</span>
            </div>

            <div>
              <span className="text-gray-400 block text-[11px]">Primary Procurement Contact:</span>
              <span className="font-medium text-gray-700">{customer?.contactPerson || user.name}</span>
            </div>

            <div>
              <span className="text-gray-400 block text-[11px]">Billing Address:</span>
              <span className="font-medium text-gray-700">{customer?.billingAddress || '450 Precision Way, Detroit, MI 48201'}</span>
            </div>

            <div>
              <span className="text-gray-400 block text-[11px]">Shipping / Fulfillment Facility:</span>
              <span className="font-medium text-gray-700">{customer?.shippingAddress || 'Plant 2 Receiving, 452 Precision Way, Detroit, MI 48201'}</span>
            </div>
          </div>
        </div>

        {/* Assigned Account Executive & Support */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider pb-2 border-b border-gray-100">
            <Mail className="w-4 h-4 text-[#714B67]" />
            <span>Assigned Account Executive</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-[#F9F7F9] rounded border border-[#EADEE7] space-y-1">
              <div className="font-bold text-gray-900 text-sm">Sarah Chen</div>
              <div className="text-[#714B67] text-[11px] font-medium">Enterprise Account Executive</div>
              <div className="text-gray-500 text-[11px]">Direct Coverage: Industrial Systems & IoT Automation</div>
            </div>

            <div className="space-y-2 text-gray-600">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                <span>sarah.chen@dealflow.demo</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                <span>+1 (555) 432-8800 ext. 204</span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-500 leading-relaxed">
              For urgent procurement inquiries, custom contract terms, or billing adjustments, reach out directly to your account executive.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
