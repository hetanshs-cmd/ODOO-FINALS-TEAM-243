import React, { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, X, Send, FileText } from 'lucide-react';
import { toast } from '../ui/Toast';

interface AIDraftEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  initialSubject?: string;
  initialBody: string;
  recipientLabel?: string;
  onApplyOrSend?: (editedBody: string, editedSubject?: string) => void;
  actionButtonLabel?: string;
}

export const AIDraftEditorModal: React.FC<AIDraftEditorModalProps> = ({
  isOpen,
  onClose,
  title = 'AI Draft Editor',
  initialSubject = '',
  initialBody = '',
  recipientLabel,
  onApplyOrSend,
  actionButtonLabel = 'Use This Draft',
}) => {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSubject(initialSubject);
    setBody(initialBody);
    setCopied(false);
  }, [initialSubject, initialBody, isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    const fullText = subject ? `Subject: ${subject}\n\n${body}` : body;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success('Copied to Clipboard', 'Draft text ready to paste.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    if (onApplyOrSend) {
      onApplyOrSend(body, subject);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
      <div
        id="ai-draft-editor-modal"
        className="bg-white rounded-lg border border-[#E5E7EB] shadow-2xl max-w-xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between bg-indigo-50/40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="text-[11px] text-slate-500">
                Review and customize this AI-generated draft before saving or dispatching.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto text-xs">
          {recipientLabel && (
            <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
              <strong>Target:</strong> {recipientLabel}
            </div>
          )}

          {initialSubject !== undefined && initialSubject !== '' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-600 focus:outline-hidden font-medium text-slate-900"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Message Content (Editable)</label>
            <textarea
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-indigo-600 focus:outline-hidden font-mono text-slate-800 leading-relaxed"
            />
          </div>

          <div className="p-2.5 bg-indigo-50/50 rounded border border-indigo-100 text-[11px] text-indigo-900 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>Customer privacy guaranteed: Internal margins and risk scores are omitted from external messages.</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-[#E5E7EB] bg-slate-50 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded bg-white hover:bg-slate-100 text-slate-700 font-medium transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-100 font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#714B67] hover:bg-[#5e3d55] text-white font-semibold rounded shadow-2xs transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{actionButtonLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
