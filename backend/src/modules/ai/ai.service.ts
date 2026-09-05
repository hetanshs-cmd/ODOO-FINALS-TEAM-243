import { AppError, Errors } from '../../errors/AppError';
import { AuthenticatedUser } from '../auth/auth.types';
import { quotationsService } from '../quotations/quotations.service';
import { approvalsService } from '../approvals/approvals.service';
import { dealHealthService } from '../deal-health/deal-health.service';
import { negotiationsService } from '../negotiations/negotiations.service';
import { reportingService } from '../reporting/reporting.service';
import { ollamaClient } from './ollama.client';
import { aiResultSchema, AIResultShape, ChatRequest, InsightRequest } from './ai.validator';

const SYSTEM_PROMPT = `You are the DealFlow360 workspace assistant, embedded inside a B2B sales
operations app (quotations, discount governance/approvals, fulfillment, billing,
deal health, customer negotiations). You are strictly workspace-grounded: only use
the JSON context you are given, never invent records, names, or numbers that
aren't in it. If the context doesn't contain enough information to answer, say so
plainly instead of guessing.

Always respond with ONLY a single JSON object matching this shape, no prose
outside the JSON:
{
  "summary": string,          // one or two sentence direct answer
  "bullets": string[],        // optional supporting detail, 0-5 short items
  "rationale": string,        // optional one-sentence "why", omit if not useful
  "confidence": "low"|"medium"|"high"
}`;

/**
 * Grounding data gathered per insight `type`, always through the relevant
 * module's already role-scoped service function (never raw repository
 * queries) so this module inherits existing authorization/tenant-scoping
 * instead of re-implementing it. See docs/api.md for each source endpoint.
 */
async function gatherContext(
  request: InsightRequest,
  requester: AuthenticatedUser,
): Promise<Record<string, unknown>> {
  const { type, entityId } = request;

  const needsQuotation = [
    'summarize_quotation',
    'explain_risk',
    'suggest_improvements',
    'draft_customer_message',
  ].includes(type);
  if (needsQuotation) {
    if (!entityId) {
      throw Errors.validationError([{ field: 'entityId', message: 'entityId is required for this insight type' }]);
    }
    return { task: type, quotation: await quotationsService.getWithItems(entityId, requester) };
  }

  if (type === 'explain_approval' || type === 'draft_approval_note') {
    if (!entityId) {
      throw Errors.validationError([{ field: 'entityId', message: 'entityId (approval request id) is required' }]);
    }
    return { task: type, approval: await approvalsService.getDetail(entityId, requester) };
  }

  if (type === 'summarize_deal_health' || type === 'draft_nudge') {
    const alerts = await dealHealthService.listOpenAlerts({ limit: 20 });
    return { task: type, openAlerts: alerts.items };
  }

  if (type === 'draft_negotiation_reply') {
    if (!entityId) {
      throw Errors.validationError([{ field: 'entityId', message: 'entityId (negotiation id) is required' }]);
    }
    return { task: type, negotiation: await negotiationsService.getDetail(entityId) };
  }

  if (type === 'summarize_report') {
    return { task: type, salesSummary: await reportingService.salesSummary({}) };
  }

  throw Errors.businessRuleViolation(`Unsupported insight type: ${type}`);
}

function parseAIResult(raw: string): AIResultShape {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError('AI_UNAVAILABLE', 503, 'AI model returned a non-JSON response.');
  }
  const result = aiResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError('AI_UNAVAILABLE', 503, 'AI model response did not match the expected shape.');
  }
  return result.data;
}

export const aiService = {
  /**
   * One-shot structured insight for a single use-case (quotation summary,
   * risk explanation, approval note draft, etc.) — see ai.validator.ts's
   * insightTypeSchema for the full list, mirroring the frontend's 8
   * contextualAIAdapter methods.
   */
  async getInsight(request: InsightRequest, requester: AuthenticatedUser): Promise<AIResultShape> {
    const context = await gatherContext(request, requester);
    const raw = await ollamaClient.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Task: ${request.type}${request.instructions ? `\nAdditional instructions: ${request.instructions}` : ''}\n\nWorkspace context (JSON):\n${JSON.stringify(context)}`,
        },
      ],
      { json: true },
    );
    return parseAIResult(raw);
  },

  /**
   * Multi-turn workspace chat. Grounds every reply in a small, role-scoped
   * snapshot of the requester's own open work, refreshed on every call
   * (not just the first message) so long conversations don't answer against
   * stale data. Purely navigational questions ("where is X") are answered
   * client-side before ever reaching this endpoint — see
   * frontend/src/services/ai/navAnswer.ts — so this only handles genuine
   * data questions.
   */
  async chat(request: ChatRequest, requester: AuthenticatedUser): Promise<AIResultShape> {
    const [approvals, alerts] = await Promise.all([
      approvalsService.list({ status: 'PENDING', limit: 10 }, requester),
      dealHealthService.listOpenAlerts({ limit: 10 }),
    ]);
    const context = { requesterRole: requester.role, pendingApprovals: approvals.items, openDealHealthAlerts: alerts.items };

    const raw = await ollamaClient.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Workspace context (JSON):\n${JSON.stringify(context)}` },
        ...request.messages.map((m) => ({ role: m.role, content: m.content }) as const),
      ],
      { json: true },
    );
    return parseAIResult(raw);
  },
};
