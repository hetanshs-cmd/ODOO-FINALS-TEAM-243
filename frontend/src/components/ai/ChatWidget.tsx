import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Send, AlertCircle, RotateCw } from 'lucide-react';
import { aiService } from '../../services/ai/aiService';
import { answerNavQuestion } from '../../services/ai/navAnswer';
import { AIAction, AIResult, ChatMessage } from '../../services/ai/types';
import { ApiError } from '../../services/httpClient';

interface ThreadEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  result?: AIResult;
  error?: string;
}

const STORAGE_KEY = 'dealflow360.chatWidget.thread';

function loadThread(): ThreadEntry[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ThreadEntry[]) : [];
  } catch {
    return [];
  }
}

function saveThread(entries: ThreadEntry[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // sessionStorage unavailable (private mode etc.) — thread just won't persist across a refresh.
  }
}

/**
 * Floating workspace chatbot, mounted once in InternalShell so it's
 * available from every internal page — not just the dedicated Command
 * Center screen. Two answer paths:
 *  1. Navigation questions ("Where is the quotation page?") are answered
 *     instantly, client-side, from navRegistry — no network call, always
 *     correct, works even if the local AI model is down.
 *  2. Everything else goes to the real local-model-backed /api/v1/ai/chat
 *     endpoint (backend/src/modules/ai), grounded in the requester's own
 *     live workspace data.
 */
export const ChatWidget: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [thread, setThread] = useState<ThreadEntry[]>(() => loadThread());
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveThread(thread);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [thread]);

  const handleActionClick = (action: AIAction) => {
    if (action.type === 'navigate' && action.payload?.path) {
      navigate(action.payload.path);
      setIsOpen(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || isLoading) return;

    const userEntry: ThreadEntry = { id: `${Date.now()}-user`, role: 'user', content: query };
    setThread((prev) => [...prev, userEntry]);
    setInput('');

    // Fast path: navigation questions never touch the network.
    const navResult = answerNavQuestion(query);
    if (navResult) {
      setThread((prev) => [...prev, { id: `${Date.now()}-assistant`, role: 'assistant', content: navResult.summary || '', result: navResult }]);
      return;
    }

    setIsLoading(true);
    try {
      const history: ChatMessage[] = [...thread, userEntry]
        .filter((e) => e.role === 'user' || e.role === 'assistant')
        .map((e) => ({ role: e.role, content: e.content }));
      const result = await aiService.chat(history);
      setThread((prev) => [...prev, { id: `${Date.now()}-assistant`, role: 'assistant', content: result.summary || '', result }]);
    } catch (err) {
      setThread((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: '',
          error: err instanceof ApiError ? err.message : 'The local AI model is unavailable. It may not be running.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        title="Workspace Assistant"
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-[#714B67] hover:bg-[#5e3d55] text-white shadow-xl flex items-center justify-center transition-colors cursor-pointer"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div className="fixed bottom-20 right-5 z-40 w-[340px] max-h-[70vh] bg-white rounded-lg border border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden">
          <div className="px-3.5 py-2.5 bg-[#714B67] text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-bold">Workspace Assistant</span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
            {thread.length === 0 && (
              <div className="text-[11px] text-slate-400 leading-relaxed">
                Ask me anything about your workspace, or where to find a page — e.g. "Where is
                the quotation page?" or "Which deals need my attention today?"
              </div>
            )}
            {thread.map((entry) => (
              <div key={entry.id} className={entry.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                {entry.role === 'user' ? (
                  <div className="max-w-[85%] px-2.5 py-1.5 rounded-lg bg-[#F4EEF3] text-[#4A2F44] font-medium">
                    {entry.content}
                  </div>
                ) : entry.error ? (
                  <div className="max-w-[90%] px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>AI Assistance Temporarily Unavailable</span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-relaxed">{entry.error}</p>
                  </div>
                ) : (
                  <div className="max-w-[90%] px-2.5 py-2 rounded-lg bg-indigo-50/60 border border-indigo-100 space-y-1.5">
                    <p className="font-semibold text-indigo-950">{entry.content}</p>
                    {entry.result?.bullets && entry.result.bullets.length > 0 && (
                      <ul className="space-y-1 text-slate-700">
                        {entry.result.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-indigo-600 font-bold mt-0.5">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {entry.result?.suggestedActions?.map((act) => (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => handleActionClick(act)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-indigo-50 text-indigo-900 border border-indigo-300 font-semibold rounded text-[11px] cursor-pointer"
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="px-2.5 py-2 rounded-lg bg-indigo-50/60 border border-indigo-100 flex items-center gap-1.5 text-indigo-800">
                  <RotateCw className="w-3 h-3 animate-spin" />
                  <span>Thinking…</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-2.5 border-t border-[#E5E7EB] flex gap-1.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              disabled={isLoading}
              className="flex-1 text-xs bg-[#F9FAFB] border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#714B67] focus:bg-white"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-2.5 py-1.5 bg-[#714B67] hover:bg-[#5e3d55] disabled:opacity-50 text-white rounded flex items-center justify-center cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
