import { config } from '../../config/env';
import { AppError } from '../../errors/AppError';

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Thin wrapper around Ollama's local HTTP API (http://localhost:11434 by
 * default — see docs/technology-decisions.md for why Ollama was chosen: a
 * fully local, team-owned model runtime with zero new npm dependencies,
 * since Node >=22 ships a global `fetch`).
 *
 * A hung local model must never hang an API request, so every call is
 * bounded by OLLAMA_TIMEOUT_MS via AbortController. Any failure (timeout,
 * connection refused, malformed response) surfaces as a single AI_UNAVAILABLE
 * AppError so callers don't need to know Ollama-specific failure shapes —
 * the frontend already has a graceful fallback path for this error.
 */
export const ollamaClient = {
  async chat(messages: OllamaChatMessage[], options?: { json?: boolean }): Promise<string> {
    if (!config.OLLAMA_ENABLED) {
      throw new AppError('AI_UNAVAILABLE', 503, 'AI assistance is disabled on this server.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.OLLAMA_TIMEOUT_MS);

    try {
      const response = await fetch(`${config.OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.OLLAMA_MODEL,
          messages,
          stream: false,
          ...(options?.json ? { format: 'json' } : {}),
        }),
      });

      if (!response.ok) {
        throw new AppError(
          'AI_UNAVAILABLE',
          503,
          `AI model request failed with status ${response.status}.`,
        );
      }

      const body = (await response.json()) as { message?: { content?: string } };
      const content = body.message?.content;
      if (!content) {
        throw new AppError('AI_UNAVAILABLE', 503, 'AI model returned an empty response.');
      }
      return content;
    } catch (err) {
      if (err instanceof AppError) throw err;
      const isAbort = err instanceof Error && err.name === 'AbortError';
      throw new AppError(
        'AI_UNAVAILABLE',
        503,
        isAbort
          ? 'AI model timed out. It may not be running locally.'
          : 'Could not reach the local AI model. It may not be running.',
      );
    } finally {
      clearTimeout(timeout);
    }
  },
};
