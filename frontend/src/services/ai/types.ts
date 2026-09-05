import { Quotation, QuotationLine, ApprovalStep, DealHealthFlag, Customer, User, UserRole, ReportPeriod } from '../../types';

export type AIConfidence = 'low' | 'medium' | 'high';

export interface AIAction {
  id: string;
  label: string;
  type:
    | 'add_product'
    | 'navigate'
    | 'draft_message'
    | 'review_discount'
    | 'open_approval'
    | 'draft_note'
    | 'nudge_rep'
    | 'filter_view';
  payload?: Record<string, any>;
}

export interface AIResult {
  summary?: string;
  bullets?: string[];
  rationale?: string;
  suggestedActions?: AIAction[];
  confidence?: AIConfidence;
  sourceRefs?: string[];
  timestamp?: number;
  stale?: boolean;
  entityId?: string;
  error?: string;
}

export interface QuotationAIContext {
  quotation: Quotation;
  customerTier: string;
  customerName: string;
  lines: QuotationLine[];
  blendedRiskLevel: string;
  blendedRiskScore: number;
  approvalRequired: boolean;
  requiredApprovers: string[];
  marginPercent: number;
  profit: number;
  grandTotal: number;
  upsellOpportunities?: string[];
  lastActivityAt?: string;
  userRole: UserRole;
}

export interface ApprovalAIContext {
  /** Approval request id — used as the grounding key for the real backend AI call. */
  approvalRequestId?: string;
  quotation: Quotation;
  customerName: string;
  customerTier: string;
  quoteTotalValue: number;
  marginPercent: number;
  approvalChain: string[];
  currentActiveRole: string;
  flaggedLines: {
    productName: string;
    category: string;
    discountPercent: number;
    allowedLimit: number;
    overBy: number;
    lineTotal: number;
  }[];
  worstLineOverBy: number;
  auditReasons: string[];
  userRole: UserRole;
}

export interface DealHealthAIContext {
  flags: DealHealthFlag[];
  totalQuotations: number;
  stalledCount: number;
  discountDeviationCount: number;
  deliveryRiskCount: number;
  userRole: UserRole;
}

export interface DealHealthNudgeContext {
  flag: DealHealthFlag;
  repName?: string;
  customerName?: string;
  quotationCode?: string;
  reason?: string;
}

export interface FollowUpAIContext {
  /** Quotation id — used as the grounding key for the real backend AI call. */
  quotationId?: string;
  quotationCode: string;
  customerName: string;
  repName: string;
  stage: string;
  lastActivityAt?: string;
  pendingIssue?: string;
  totalAmount: number;
}

export interface NegotiationAIContext {
  /** Negotiation id — used as the grounding key for the real backend AI call. */
  negotiationId?: string;
  quotationCode: string;
  customerName: string;
  requestedDiscount?: number;
  requestedDeliveryDate?: string;
  customerComment?: string;
  repName?: string;
  isCustomerFacing: boolean;
}

export interface ReportAIContext {
  period: ReportPeriod;
  dateRange: { start?: string; end?: string };
  salesTeam?: string;
  repId?: string;
  repName?: string;
  productCategory?: string;
  metrics: {
    totalQuotes: number;
    totalPipelineValue: number;
    avgApprovalHours: number;
    avgDiscountGiven: number;
    blendedGrossMargin: number;
    winRatePercent: number;
  };
  topUpsellProduct?: string;
}

export interface WorkspaceAIContext {
  query: string;
  quotations: Quotation[];
  approvalSteps: ApprovalStep[];
  dealHealthFlags: DealHealthFlag[];
  customers: Customer[];
  users: User[];
  userRole: UserRole;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIService {
  summarizeQuotation(context: QuotationAIContext): Promise<AIResult>;
  explainRisk(context: QuotationAIContext): Promise<AIResult>;
  suggestImprovements(context: QuotationAIContext): Promise<AIResult>;
  draftCustomerMessage(context: FollowUpAIContext, instructions?: string): Promise<AIResult>;
  explainApproval(context: ApprovalAIContext): Promise<AIResult>;
  draftApprovalNote(context: ApprovalAIContext): Promise<AIResult>;
  summarizeDealHealth(context: DealHealthAIContext): Promise<AIResult>;
  draftNudge(context: DealHealthNudgeContext): Promise<AIResult>;
  draftNegotiationReply(context: NegotiationAIContext): Promise<AIResult>;
  summarizeReport(context: ReportAIContext): Promise<AIResult>;
  answerWorkspaceQuestion(context: WorkspaceAIContext, query: string): Promise<AIResult>;
  chat(messages: ChatMessage[]): Promise<AIResult>;
}
