import {
  AIService,
  AIResult,
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

export interface AIServiceConfig {
  enabled: boolean;
  simulateError: boolean;
  proxyUrl?: string;
  cacheTtlMs: number;
}

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

  private async executeWithCache<T>(
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
    return this.executeWithCache(cacheKey, context.quotation.updatedAt, () =>
      contextualAIAdapter.summarizeQuotation(context)
    );
  }

  async explainRisk(context: QuotationAIContext): Promise<AIResult> {
    const cacheKey = `quote_risk_${context.quotation.id}`;
    return this.executeWithCache(cacheKey, context.quotation.updatedAt, () =>
      contextualAIAdapter.explainRisk(context)
    );
  }

  async suggestImprovements(context: QuotationAIContext): Promise<AIResult> {
    const cacheKey = `quote_improvements_${context.quotation.id}`;
    return this.executeWithCache(cacheKey, context.quotation.updatedAt, () =>
      contextualAIAdapter.suggestImprovements(context)
    );
  }

  async draftCustomerMessage(context: FollowUpAIContext, instructions?: string): Promise<AIResult> {
    // Drafting is usually dynamic and on-demand
    if (!this.config.enabled || this.config.simulateError) {
      throw new Error('AI service unavailable for drafting.');
    }
    return contextualAIAdapter.draftCustomerMessage(context, instructions);
  }

  async explainApproval(context: ApprovalAIContext): Promise<AIResult> {
    const cacheKey = `approval_summary_${context.quotation.id}`;
    return this.executeWithCache(cacheKey, context.quotation.updatedAt, () =>
      contextualAIAdapter.explainApproval(context)
    );
  }

  async draftApprovalNote(context: ApprovalAIContext): Promise<AIResult> {
    if (!this.config.enabled || this.config.simulateError) {
      throw new Error('AI service unavailable for drafting.');
    }
    return contextualAIAdapter.draftApprovalNote(context);
  }

  async summarizeDealHealth(context: DealHealthAIContext): Promise<AIResult> {
    const cacheKey = `deal_health_summary_${context.flags.length}_${context.stalledCount}_${context.discountDeviationCount}`;
    return this.executeWithCache(cacheKey, undefined, () =>
      contextualAIAdapter.summarizeDealHealth(context)
    );
  }

  async draftNudge(context: DealHealthNudgeContext): Promise<AIResult> {
    if (!this.config.enabled || this.config.simulateError) {
      throw new Error('AI service unavailable for drafting.');
    }
    return contextualAIAdapter.draftNudge(context);
  }

  async draftNegotiationReply(context: NegotiationAIContext): Promise<AIResult> {
    if (!this.config.enabled || this.config.simulateError) {
      throw new Error('AI service unavailable for drafting.');
    }
    return contextualAIAdapter.draftNegotiationReply(context);
  }

  async summarizeReport(context: ReportAIContext): Promise<AIResult> {
    const filterKey = `${context.period}_${context.repName || 'all'}_${context.productCategory || 'all'}_${context.metrics.totalQuotes}`;
    return this.executeWithCache(`report_${filterKey}`, undefined, () =>
      contextualAIAdapter.summarizeReport(context)
    );
  }

  async answerWorkspaceQuestion(context: WorkspaceAIContext, query: string): Promise<AIResult> {
    if (!this.config.enabled) {
      throw new Error('AI Command Center is currently disabled.');
    }
    if (this.config.simulateError) {
      throw new Error('Failed to reach workspace query index.');
    }
    // Command center query
    return contextualAIAdapter.answerWorkspaceQuestion(context, query);
  }
}

export const aiService = new AIServiceImpl();
