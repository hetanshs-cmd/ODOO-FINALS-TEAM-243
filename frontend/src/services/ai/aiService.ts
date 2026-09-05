import {
  AIService,
  AIResult,
  ChatMessage,
  QuotationAIContext,
  ApprovalAIContext,
  DealHealthAIContext,
  DealHealthNudgeContext,
  FollowUpAIContext,
  NegotiationAIContext,
  ReportAIContext,
  WorkspaceAIContext,
} from './types';
import { contextualAIAdapter } from './adapters/contextualAIAdapter';
import { httpClient, ApiError } from '../httpClient';

export interface AIServiceConfig {
  enabled: boolean;
  simulateError: boolean;
  proxyUrl?: string;
  cacheTtlMs: number;
}

export type InsightType =
  | 'summarize_quotation'
  | 'explain_risk'
  | 'suggest_improvements'
  | 'draft_customer_message'
  | 'explain_approval'
  | 'draft_approval_note'
  | 'summarize_deal_health'
  | 'draft_nudge'
  | 'draft_negotiation_reply'
  | 'summarize_report';

class AIServiceImpl implements AIService {
  private config: AIServiceConfig = {
    enabled: true,
    simulateError: false,
    proxyUrl: typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AI_PROXY_URL ? String((import.meta as any).env.VITE_AI_PROXY_URL) : undefined,
    cacheTtlMs: 5 * 60 * 1000, // 5 minutes cache
  };

  // Memory cache: key -> { result, cachedAt, entityUpdatedAt }
  private cache = new Map<string, { result: AIResult; cachedAt: number; entityUpdatedAt?: string }>();

  public setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public setSimulateError(simulate: boolean) {
    this.config.simulateError = simulate;
  }

  public invalidateCache(entityId?: string) {
    if (!entityId) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(entityId)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Checks if a cached result is stale relative to the current entity updatedAt
   */
  public isResultStale(entityId: string, actionType: string, currentUpdatedAt?: string): boolean {
    const key = `${entityId}_${actionType}`;
    const cached = this.cache.get(key);
    if (!cached) return false;
    if (currentUpdatedAt && cached.entityUpdatedAt && cached.entityUpdatedAt !== currentUpdatedAt) {
      return true;
    }
    return false;
  }

  /**
   * Tries the real local-model backend first (backend/src/modules/ai) —
   * grounded in live PostgreSQL data, not the local mock store. On ANY
   * failure (network error, AI_UNAVAILABLE, Ollama not running) this
   * returns null so the caller falls back to the deterministic
   * contextualAIAdapter, which never fails and always renders something.
   */
  private async tryBackend(type: InsightType, entityId?: string, instructions?: string): Promise<AIResult | null> {
    if (!this.config.enabled || this.config.simulateError) return null;
    try {
      const result = await httpClient.post<AIResult>('/ai/insight', { type, entityId, instructions });
      return { ...result, timestamp: Date.now() };
    } catch (err) {
      // Expected/frequent when Ollama isn't installed/running locally —
      // not an error worth surfacing, the deterministic fallback covers it.
      return null;
    }
  }

  private async executeWithCache(
    cacheKey: string,
    entityUpdatedAt: string | undefined,
    actionFn: () => Promise<AIResult>
  ): Promise<AIResult> {
    if (!this.config.enabled) {
      throw new Error('AI assistance is disabled in workspace settings.');
    }

    if (this.config.simulateError) {
      throw new Error('AI service connection timed out.');
    }

    const existing = this.cache.get(cacheKey);
    if (existing) {
      const isExpired = Date.now() - existing.cachedAt > this.config.cacheTtlMs;
      const isEntityStale = entityUpdatedAt && existing.entityUpdatedAt && existing.entityUpdatedAt !== entityUpdatedAt;

      if (!isExpired && !isEntityStale) {
        return {
          ...existing.result,
          stale: false,
        };
      }
      if (!isExpired && isEntityStale) {
        return {
          ...existing.result,
          stale: true,
        };
      }
    }

    // Small realistic delay (180ms) for smooth enterprise feel
    await new Promise((res) => setTimeout(res, 180));

    const freshResult = await actionFn();
    this.cache.set(cacheKey, {
      result: freshResult,
      cachedAt: Date.now(),
      entityUpdatedAt,
    });

    return freshResult;
  }

  async summarizeQuotation(context: QuotationAIContext): Promise<AIResult> {
    const cacheKey = `quote_summary_${context.quotation.id}`;
    return this.executeWithCache(cacheKey, context.quotation.updatedAt, async () =>
      (await this.tryBackend('summarize_quotation', context.quotation.id)) ??
      contextualAIAdapter.summarizeQuotation(context)
    );
  }

  async explainRisk(context: QuotationAIContext): Promise<AIResult> {
    const cacheKey = `quote_risk_${context.quotation.id}`;
    return this.executeWithCache(cacheKey, context.quotation.updatedAt, async () =>
      (await this.tryBackend('explain_risk', context.quotation.id)) ??
      contextualAIAdapter.explainRisk(context)
    );
  }

  async suggestImprovements(context: QuotationAIContext): Promise<AIResult> {
    const cacheKey = `quote_improvements_${context.quotation.id}`;
    return this.executeWithCache(cacheKey, context.quotation.updatedAt, async () =>
      (await this.tryBackend('suggest_improvements', context.quotation.id)) ??
      contextualAIAdapter.suggestImprovements(context)
    );
  }

  async draftCustomerMessage(context: FollowUpAIContext, instructions?: string): Promise<AIResult> {
    // Drafting is usually dynamic and on-demand
    if (!this.config.enabled || this.config.simulateError) {
      throw new Error('AI service unavailable for drafting.');
    }
    return (
      (await this.tryBackend('draft_customer_message', context.quotationId, instructions)) ??
      contextualAIAdapter.draftCustomerMessage(context, instructions)
    );
  }

  async explainApproval(context: ApprovalAIContext): Promise<AIResult> {
    const cacheKey = `approval_summary_${context.approvalRequestId || context.quotation.id}`;
    return this.executeWithCache(cacheKey, context.quotation.updatedAt, async () =>
      (await this.tryBackend('explain_approval', context.approvalRequestId)) ??
      contextualAIAdapter.explainApproval(context)
    );
  }

  async draftApprovalNote(context: ApprovalAIContext): Promise<AIResult> {
    if (!this.config.enabled || this.config.simulateError) {
      throw new Error('AI service unavailable for drafting.');
    }
    return (
      (await this.tryBackend('draft_approval_note', context.approvalRequestId)) ??
      contextualAIAdapter.draftApprovalNote(context)
    );
  }

  async summarizeDealHealth(context: DealHealthAIContext): Promise<AIResult> {
    const cacheKey = `deal_health_summary_${context.flags.length}_${context.stalledCount}_${context.discountDeviationCount}`;
    return this.executeWithCache(cacheKey, undefined, async () =>
      (await this.tryBackend('summarize_deal_health')) ?? contextualAIAdapter.summarizeDealHealth(context)
    );
  }

  async draftNudge(context: DealHealthNudgeContext): Promise<AIResult> {
    if (!this.config.enabled || this.config.simulateError) {
      throw new Error('AI service unavailable for drafting.');
    }
    return (await this.tryBackend('draft_nudge')) ?? contextualAIAdapter.draftNudge(context);
  }

  async draftNegotiationReply(context: NegotiationAIContext): Promise<AIResult> {
    if (!this.config.enabled || this.config.simulateError) {
      throw new Error('AI service unavailable for drafting.');
    }
    return (
      (await this.tryBackend('draft_negotiation_reply', context.negotiationId)) ??
      contextualAIAdapter.draftNegotiationReply(context)
    );
  }

  async summarizeReport(context: ReportAIContext): Promise<AIResult> {
    const filterKey = `${context.period}_${context.repName || 'all'}_${context.productCategory || 'all'}_${context.metrics.totalQuotes}`;
    return this.executeWithCache(`report_${filterKey}`, undefined, async () =>
      (await this.tryBackend('summarize_report')) ?? contextualAIAdapter.summarizeReport(context)
    );
  }

  async answerWorkspaceQuestion(context: WorkspaceAIContext, query: string): Promise<AIResult> {
    if (!this.config.enabled) {
      throw new Error('AI Command Center is currently disabled.');
    }
    if (this.config.simulateError) {
      throw new Error('Failed to reach workspace query index.');
    }
    // Command center query — same conversational backend as the chat
    // widget, single-shot (no history).
    try {
      const result = await httpClient.post<AIResult>('/ai/chat', { messages: [{ role: 'user', content: query }] });
      return { ...result, timestamp: Date.now() };
    } catch {
      return contextualAIAdapter.answerWorkspaceQuestion(context, query);
    }
  }

  /**
   * Direct real-backend insight call with no deterministic-adapter fallback
   * and no mock-shaped context required — for screens that only have real
   * API data available (e.g. the API-backed QuotationDetailPage) and would
   * otherwise have to fabricate mock-only fields (blended risk score,
   * upsell opportunities, etc.) just to satisfy the legacy context types.
   * On failure this throws, so the caller shows the honest "AI
   * temporarily unavailable" state instead of a faked answer.
   */
  async getInsight(type: InsightType, entityId?: string, instructions?: string): Promise<AIResult> {
    if (!this.config.enabled) {
      throw new Error('AI assistance is disabled in workspace settings.');
    }
    if (this.config.simulateError) {
      throw new ApiError('Simulated AI failure.', 'AI_UNAVAILABLE', 503);
    }
    const result = await httpClient.post<AIResult>('/ai/insight', { type, entityId, instructions });
    return { ...result, timestamp: Date.now() };
  }

  /**
   * Multi-turn workspace chat backing the floating ChatWidget. No local
   * fallback here on purpose — a fake conversation would be worse than an
   * honest "AI chat unavailable" state (see AIInsightPanel's error path).
   */
  async chat(messages: ChatMessage[]): Promise<AIResult> {
    if (!this.config.enabled) {
      throw new Error('AI Command Center is currently disabled.');
    }
    if (this.config.simulateError) {
      throw new ApiError('Simulated AI chat failure.', 'AI_UNAVAILABLE', 503);
    }
    const result = await httpClient.post<AIResult>('/ai/chat', { messages });
    return { ...result, timestamp: Date.now() };
  }
}

export const aiService = new AIServiceImpl();
