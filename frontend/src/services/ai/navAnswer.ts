import { findNavEntry } from '../../config/navRegistry';
import { AIResult } from './types';

/**
 * Trigger words that signal a "where is X" / navigation-help question, as
 * opposed to a genuine data question ("which deals need attention"). Kept
 * deliberately narrow: a false negative just falls through to the real LLM
 * (still correct, just slower); a false positive would answer a data
 * question with a nav pointer, which is worse.
 */
const NAV_QUESTION_PATTERN = /\bwhere\b|\bhow do i (get|find|open|navigate)|\bfind\b.*\bpage\b|\bnavigate to\b/i;

/**
 * Client-side, no-network answer for navigation questions ("Where is the
 * quotation page?"). Instant and always correct (backed by navRegistry, not
 * a model guess), and works even if the local AI model is completely down.
 * Returns null when the query isn't recognized as a nav question or no
 * matching page is found — the caller should fall back to the real chat
 * endpoint in that case.
 */
export function answerNavQuestion(query: string): AIResult | null {
  if (!NAV_QUESTION_PATTERN.test(query)) return null;

  const entry = findNavEntry(query);
  if (!entry) return null;

  return {
    summary: `${entry.label} is in ${entry.location}.`,
    suggestedActions: [
      {
        id: `nav-${entry.id}`,
        label: `Go to ${entry.label}`,
        type: 'navigate',
        payload: { path: entry.path },
      },
    ],
    confidence: 'high',
    timestamp: Date.now(),
  };
}
