import { z } from 'zod';

// The 8 use-cases the frontend's contextualAIAdapter already implements as
// deterministic templates (see frontend/src/services/ai/types.ts). This
// endpoint upgrades all of them to a real model call, with the frontend
// falling back to the deterministic adapter if this call fails.
export const insightTypeSchema = z.enum([
  'summarize_quotation',
  'explain_risk',
  'suggest_improvements',
  'draft_customer_message',
  'explain_approval',
  'draft_approval_note',
  'summarize_deal_health',
  'draft_nudge',
  'draft_negotiation_reply',
  'summarize_report',
]);

export const insightRequestSchema = z.object({
  type: insightTypeSchema,
  entityId: z.string().uuid().optional(),
  instructions: z.string().max(500).optional(),
});

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(20),
});

// Shape the model is instructed to return (via Ollama's `format: 'json'`),
// mirroring the frontend's AIResult (frontend/src/services/ai/types.ts) so
// the same AIInsightPanel can render either a real or fallback result.
export const aiResultSchema = z.object({
  summary: z.string().optional(),
  bullets: z.array(z.string()).max(10).optional(),
  rationale: z.string().optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});

export type InsightType = z.infer<typeof insightTypeSchema>;
export type InsightRequest = z.infer<typeof insightRequestSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type AIResultShape = z.infer<typeof aiResultSchema>;
