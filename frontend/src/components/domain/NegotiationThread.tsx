import React, { useState } from 'react';
import { MessageSquare, Calendar, Send, ShieldAlert } from 'lucide-react';
import { NegotiationRequest } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface NegotiationThreadProps {
  requests: NegotiationRequest[];
  onSubmitReply?: (comment: string) => void;
  className?: string;
}

export const NegotiationThread: React.FC<NegotiationThreadProps> = ({
  requests,
  onSubmitReply,
  className = '',
}) => {
  const [replyText, setReplyText] = useState('');

  const handleSend = () => {
    if (!replyText.trim() || !onSubmitReply) return;
    onSubmitReply(replyText);
    setReplyText('');
  };

  return (
    <div className={`bg-white rounded border border-slate-200 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
        <MessageSquare className="w-4 h-4 text-blue-900" />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-800">
          Commercial Negotiation Thread
        </h4>
      </div>

      <div className="space-y-3 mb-4 max-h-72 overflow-y-auto pr-1">
        {requests.map((req) => (
          <div key={req.id} className="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-semibold text-slate-900">{req.customerName}</span>
              <span className="text-[11px] text-slate-400">
                {new Date(req.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed">{req.comment}</p>
            {(req.counterDiscountPercent || req.requestedDeliveryDate) && (
              <div className="mt-2 pt-2 border-t border-slate-200 flex flex-wrap items-center gap-3 text-[11px] font-mono">
                {req.counterDiscountPercent && (
                  <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Counter Discount: {req.counterDiscountPercent}%
                  </span>
                )}
                {req.requestedDeliveryDate && (
                  <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Req. Delivery: {req.requestedDeliveryDate}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {onSubmitReply && (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Type a negotiation response..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={handleSend}>
            Send
          </Button>
        </div>
      )}
    </div>
  );
};

export interface CounterOfferFormProps {
  currentDiscountPercent: number;
  allowedLimitPercent: number;
  onSubmit: (counterDiscount: number, requestedDate: string, comment: string) => void;
  isLoading?: boolean;
}

export const CounterOfferForm: React.FC<CounterOfferFormProps> = ({
  currentDiscountPercent,
  allowedLimitPercent,
  onSubmit,
  isLoading = false,
}) => {
  const [discount, setDiscount] = useState(currentDiscountPercent + 2);
  const [date, setDate] = useState('');
  const [comment, setComment] = useState('');

  const willTriggerApproval = discount > allowedLimitPercent;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(discount, date, comment);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white rounded border border-slate-200 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
          Propose Negotiation Terms
        </h4>
        <span className="text-xs text-slate-500 font-mono">Current: {currentDiscountPercent}%</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Counter Discount (%)"
          type="number"
          min={0}
          max={50}
          value={discount}
          onChange={(e) => setDiscount(Number(e.target.value))}
          required
        />
        <Input
          label="Requested Delivery Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">
          Rationale / Procurement Notes
        </label>
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Explain budget limits, delivery urgency, or multi-year commitment..."
          className="w-full text-xs p-2 border border-slate-300 rounded focus:ring-1 focus:ring-blue-800"
          required
        />
      </div>

      {willTriggerApproval && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded flex items-center gap-2 text-xs text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Counter-offer of {discount}% exceeds allowed ceiling ({allowedLimitPercent}%). Submitting will route this quote back into governance approval.
          </span>
        </div>
      )}

      <Button type="submit" variant="primary" size="sm" className="w-full" isLoading={isLoading}>
        Submit Counter-Offer
      </Button>
    </form>
  );
};
