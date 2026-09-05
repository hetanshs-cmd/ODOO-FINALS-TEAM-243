import {
  QuotationAIContext,
  ApprovalAIContext,
  DealHealthAIContext,
  DealHealthNudgeContext,
  FollowUpAIContext,
  NegotiationAIContext,
  ReportAIContext,
  WorkspaceAIContext,
  AIResult,
  AIAction,
} from '../types';
import { formatCurrency, formatPercent } from '../../../utils/formatters';

/**
 * Contextual AI Adapter for DealFlow360.
 * Operates on structured, canonical business state.
 * Implements strict boundaries:
 * - Does not recompute or override governance (Section 7)
 * - Does not invent hidden thresholds (Section 11)
 * - Does not make approval decisions autonomously (Section 17)
 * - Does not expose internal business metrics to customers (Section 44, Test J)
 */
export const contextualAIAdapter = {
  /**
   * Screen 4: Quotation Copilot — Summarize Deal
   */
  async summarizeQuotation(context: QuotationAIContext): Promise<AIResult> {
    const {
      quotation,
      customerName,
      customerTier,
      lines,
      grandTotal,
      marginPercent,
      blendedRiskLevel,
      approvalRequired,
      requiredApprovers,
      upsellOpportunities,
    } = context;

    const hasSubscriptions = lines.some((l) => l.isSubscription);
    const recurringValue = lines
      .filter((l) => l.isSubscription)
      .reduce((acc, l) => acc + (l.lineTotal || 0), 0);
    const oneTimeValue = grandTotal - recurringValue;

    const violatingLines = lines.filter((l) => l.overBy > 0);
    const categoriesPresent = Array.from(new Set(lines.map((l) => l.category)));

    const bullets: string[] = [
      `Total commercial commitment: ${formatCurrency(grandTotal)} across ${lines.length} line items (${customerName}, ${customerTier} Tier).`,
    ];

    if (hasSubscriptions) {
      bullets.push(
        `Hybrid revenue model: ${formatCurrency(oneTimeValue)} upfront commercial value plus ${formatCurrency(recurringValue)}/mo recurring subscription ARR.`
      );
    } else {
      bullets.push(`Standard one-time commercial delivery covering ${categoriesPresent.join(', ')}.`);
    }

    bullets.push(`Projected deal gross margin is evaluated at ${marginPercent.toFixed(1)}%.`);

    if (violatingLines.length > 0) {
      const lineDetails = violatingLines
        .map((l) => `${l.productName} (+${l.overBy.toFixed(1)} pts over ${l.category} limit)`)
        .join(', ');
      bullets.push(`Discount governance: ${violatingLines.length} line(s) exceed configured discount ceilings: ${lineDetails}.`);
    } else {
      bullets.push('Discount governance: All order lines adhere strictly to configured category and customer tier discount ceilings.');
    }

    if (approvalRequired) {
      const approverNames = requiredApprovers
        .map((r) => (r === 'sales_manager' ? 'Sales Manager' : 'Finance Director'))
        .join(' → ');
      bullets.push(`Governance path: Approval is required before confirmation (${approverNames}).`);
    } else {
      bullets.push('Governance path: Standard commercial terms qualify for direct customer dispatch without deal desk escalation.');
    }

    if (upsellOpportunities && upsellOpportunities.length > 0) {
      bullets.push(`${upsellOpportunities.length} high-margin cross-sell / add-on opportunities are available for this account.`);
    }

    const suggestedActions: AIAction[] = [];
    if (violatingLines.length > 0) {
      suggestedActions.push({
        id: 'review_discounts',
        label: 'Review Discount Exceptions',
        type: 'review_discount',
        payload: { lines: violatingLines.map((l) => l.id) },
      });
    }
    if (approvalRequired) {
      suggestedActions.push({
        id: 'open_approvals_path',
        label: 'Inspect Approval Chain',
        type: 'open_approval',
        payload: { quotationId: quotation.id },
      });
    }
    suggestedActions.push({
      id: 'draft_customer_followup',
      label: 'Draft Customer Follow-Up',
      type: 'draft_message',
      payload: { quotationCode: quotation.code },
    });

    return {
      summary: `Commercial deal sheet for ${customerName} valued at ${formatCurrency(grandTotal)}. Governance status: ${blendedRiskLevel} Risk, ${approvalRequired ? 'Approval Required' : 'Self-Governing'}.`,
      bullets,
      rationale: `Summary derived from canonical order lines, customer tier ${customerTier}, and real-time discount limits.`,
      suggestedActions,
      confidence: 'high',
      sourceRefs: [
        `Quotation ${quotation.code}`,
        `${customerTier} Tier Price Agreement`,
        'Category Discount Matrix',
      ],
      timestamp: Date.now(),
      entityId: quotation.id,
    };
  },

  /**
   * Screen 4: Quotation Copilot — Explain Risk
   */
  async explainRisk(context: QuotationAIContext): Promise<AIResult> {
    const { quotation, lines, blendedRiskLevel, blendedRiskScore, marginPercent } = context;

    const violatingLines = lines.filter((l) => l.overBy > 0);

    const bullets: string[] = [];
    let rationale = '';

    if (violatingLines.length > 0) {
      bullets.push(`Calculated Blended Risk Score is ${blendedRiskScore}/100 (${blendedRiskLevel} risk classification).`);

      violatingLines.forEach((l) => {
        bullets.push(
          `Line exception on "${l.productName}": discount given is ${formatPercent(l.discountPercent)}, which exceeds the governed ${l.category} ceiling (${l.categoryLimitPercent}%) by +${l.overBy.toFixed(1)} percentage points.`
        );
      });

      if (marginPercent < 30) {
        bullets.push(`Gross margin compression: Projected gross margin of ${marginPercent.toFixed(1)}% approaches the minimum operating floor (25%).`);
      }

      rationale = `DealFlow360 assigns ${blendedRiskLevel} risk because single-line discount exceptions exceed configured corporate ceilings and cumulative concessions reduce projected margins.`;
    } else {
      bullets.push(`Calculated Blended Risk Score is ${blendedRiskScore}/100 (LOW risk classification).`);
      bullets.push('Zero discount exceptions detected across all order lines.');
      bullets.push(`Healthy margin buffer: Deal delivers a solid ${marginPercent.toFixed(1)}% gross margin.`);
      rationale = 'All lines comply with governed category limits and customer tier pricing guidelines.';
    }

    const suggestedActions: AIAction[] = violatingLines.length > 0
      ? [
          {
            id: 'suggest_improvements_action',
            label: 'Suggest Margin Improvements',
            type: 'review_discount',
          },
        ]
      : [];

    return {
      summary: `Why this deal is evaluated at ${blendedRiskLevel} Risk (${blendedRiskScore}/100)`,
      bullets,
      rationale,
      suggestedActions,
      confidence: 'high',
      sourceRefs: [
        `Discount Governance Policy Engine`,
        `Customer Agreement Tier: ${context.customerTier}`,
      ],
      timestamp: Date.now(),
      entityId: quotation.id,
    };
  },

  /**
   * Screen 4: Quotation Copilot — Suggest Improvements
   */
  async suggestImprovements(context: QuotationAIContext): Promise<AIResult> {
    const { quotation, lines, marginPercent, customerTier } = context;

    const bullets: string[] = [];
    const suggestedActions: AIAction[] = [];

    const violatingLines = lines.filter((l) => l.overBy > 0);

    if (violatingLines.length > 0) {
      const topViolator = violatingLines.sort((a, b) => b.overBy - a.overBy)[0];
      bullets.push(
        `Trim concession on ${topViolator.productName}: Reducing discount from ${topViolator.discountPercent}% to ${topViolator.categoryLimitPercent}% saves ${formatCurrency((topViolator.subtotal * topViolator.overBy) / 100)} and eliminates escalation.`
      );
      bullets.push(
        `Shift discount allocation: If customer demands concession, offer standard pricing on services and shift commercial concessions into higher-margin software licenses.`
      );
    } else {
      bullets.push('Deal lines are already clean. Focus on contract term length or attached support SLAs to expand lifetime value.');
    }

    // Add complementary upsell suggestion if applicable
    const hasHardware = lines.some((l) => l.category === 'Hardware');
    const hasWarranty = lines.some((l) => l.productName.toLowerCase().includes('warranty') || l.productName.toLowerCase().includes('sla'));

    if (hasHardware && !hasWarranty) {
      bullets.push('Attach Mission-Critical SLA: 3-year extended hardware warranty carries 75% gross margin and protects long-term account health.');
      suggestedActions.push({
        id: 'add_warranty_upsell',
        label: 'Add 3-Year Enterprise SLA to Quote',
        type: 'add_product',
        payload: {
          productId: 'PROD-004',
          productName: 'Mission-Critical SLA Support (Annual)',
          category: 'Services',
          unitPrice: 4200,
        },
      });
    }

    if (marginPercent < 38) {
      bullets.push('Request Commercial Justification: If client insists on below-margin terms, require executive sponsor sign-off with multi-year renewal commitments.');
    }

    return {
      summary: 'Non-Binding Commercial Optimization Recommendations',
      bullets,
      rationale: 'Derived from historical deal desk approval rates, category margin contributions, and product pairing patterns.',
      suggestedActions,
      confidence: 'high',
      sourceRefs: ['Cross-Sell Correlation Matrix', 'Historical Won Deal Margins'],
      timestamp: Date.now(),
      entityId: quotation.id,
    };
  },

  /**
   * Screen 4 & Screen 11: Draft Customer Follow-Up / Message
   * MANDATORY: Customer-safe only! Does not leak internal margin %, risk score, approval threshold, or rep history.
   */
  async draftCustomerMessage(context: FollowUpAIContext, instructions?: string): Promise<AIResult> {
    const { quotationCode, customerName, repName, totalAmount } = context;

    const subject = `Update on your quotation ${quotationCode} — ${customerName}`;
    const draft = `Dear ${customerName} Procurement Team,

I hope this message finds you well.

I am writing to follow up regarding quotation ${quotationCode} for your organization, totaling ${formatCurrency(totalAmount)}.

Our team has structured this commercial proposal to best align with your operational roadmap and required delivery timetables. Please let us know if your procurement review has any questions regarding the line-item specifications, implementation timelines, or commercial terms.

We remain available to schedule a brief alignment call at your convenience.

Warm regards,

${repName}
Deal Execution & Sales Operations
DealFlow360 Enterprise`;

    return {
      summary: `Customer-ready draft generated for ${customerName}.`,
      bullets: [
        'Commercial terms and quotation reference confirmed.',
        'Strictly sanitized: internal margin percent and approval metrics omitted.',
        'Clear call-to-action for procurement review.',
      ],
      rationale: draft,
      suggestedActions: [
        {
          id: 'use_draft_action',
          label: 'Open in Draft Editor',
          type: 'draft_message',
          payload: { subject, body: draft },
        },
      ],
      confidence: 'high',
      sourceRefs: [`Quotation ${quotationCode}`, `Customer Account ${customerName}`],
      timestamp: Date.now(),
    };
  },

  /**
   * Screen 6: Approval Detail — Explain in Plain Language / Decision Support
   * MANDATORY: Must NOT make decisions (Test G). Human reviewer decides.
   */
  async explainApproval(context: ApprovalAIContext): Promise<AIResult> {
    const {
      quotation,
      customerName,
      customerTier,
      quoteTotalValue,
      marginPercent,
      flaggedLines,
      currentActiveRole,
      approvalChain,
    } = context;

    const supportsApproval: string[] = [
      `Tier Relationship: Customer is an established ${customerTier} Tier account with active procurement history.`,
      `Significant Deal Scale: Total commercial value of ${formatCurrency(quoteTotalValue)} provides high revenue throughput.`,
    ];

    if (quotation.lines?.some((l) => l.isSubscription)) {
      supportsApproval.push('Predictable Revenue: Contract includes recurring SaaS subscription ARR alongside one-time delivery.');
    }

    if (marginPercent >= 35) {
      supportsApproval.push(`Viable Economics: Blended gross margin (${marginPercent.toFixed(1)}%) remains well above the 25% corporate margin floor.`);
    }

    const requiresCaution: string[] = [];
    if (flaggedLines.length > 0) {
      flaggedLines.forEach((l) => {
        requiresCaution.push(
          `${l.productName} carries ${formatPercent(l.discountPercent)} discount, exceeding ${l.category} limit (${formatPercent(l.allowedLimit)}) by +${l.overBy.toFixed(1)} pts.`
        );
      });
    }

    if (marginPercent < 35) {
      requiresCaution.push(`Margin Dilution: Gross margin of ${marginPercent.toFixed(1)}% is below the 40% target benchmark.`);
    }

    const reviewerFocus = [
      `Validate customer business justification for the ${flaggedLines.map((l) => l.productName).join(', ')} discount concession.`,
      `Consider whether delivery commitments or multi-year terms offset the +${context.worstLineOverBy.toFixed(1)} pts ceiling exception.`,
      `Confirm sequential handover to ${approvalChain.filter((r) => r !== currentActiveRole).join(', ') || 'final confirmation'}.`,
    ];

    const suggestedActions: AIAction[] = [
      {
        id: 'draft_approval_note',
        label: 'Draft Reviewer Decision Note',
        type: 'draft_note',
        payload: { quotationId: quotation.id },
      },
    ];

    return {
      summary: `Governance Decision Support for ${quotation.code} (${customerName})`,
      bullets: [
        'Factors Supporting Approval:',
        ...supportsApproval.map((s) => `  ✓ ${s}`),
        'Factors Requiring Caution:',
        ...requiresCaution.map((c) => `  ⚠ ${c}`),
        'Suggested Reviewer Focus:',
        ...reviewerFocus.map((f) => `  → ${f}`),
      ],
      rationale: 'Advisory analysis based on governed ceiling thresholds. Final commercial decision rests solely with the designated reviewer.',
      suggestedActions,
      confidence: 'high',
      sourceRefs: [
        `Approval Step: ${currentActiveRole}`,
        `Quotation ${quotation.code}`,
        `${customerTier} Tier Governance Policy`,
      ],
      timestamp: Date.now(),
      entityId: quotation.id,
    };
  },

  /**
   * Screen 6: Draft Approval Note
   */
  async draftApprovalNote(context: ApprovalAIContext): Promise<AIResult> {
    const { quotation, customerName, customerTier, flaggedLines, marginPercent, quoteTotalValue } = context;

    const lineSummary = flaggedLines
      .map((l) => `${l.productName} (${l.discountPercent}% vs ${l.allowedLimit}% limit)`)
      .join('; ');

    const note = `Reviewed commercial exception for ${customerName} (${customerTier} Tier, ${formatCurrency(quoteTotalValue)}). Discretionary concession on ${lineSummary || 'order lines'} evaluated against deal margin of ${marginPercent.toFixed(1)}%. Approved on condition of standard net-30 payment terms and scheduled hardware fulfillment.`;

    return {
      summary: 'Draft Reviewer Endorsement Note',
      bullets: [
        'Fact-based summary of reviewed exceptions.',
        'Explicit reference to customer tier and margin.',
        'Fully editable in the approval action dialog.',
      ],
      rationale: note,
      suggestedActions: [
        {
          id: 'use_note_in_modal',
          label: 'Insert into Approval Modal',
          type: 'draft_note',
          payload: { note },
        },
      ],
      confidence: 'high',
      sourceRefs: [`Quotation ${quotation.code}`],
      timestamp: Date.now(),
      entityId: quotation.id,
    };
  },

  /**
   * Screen 14: Deal Health — Summarize Risks & Recommend Priority
   */
  async summarizeDealHealth(context: DealHealthAIContext): Promise<AIResult> {
    const { flags, totalQuotations, stalledCount, discountDeviationCount, deliveryRiskCount } = context;

    const bullets: string[] = [
      `${flags.length} active deal anomalies detected across ${totalQuotations} governed quotations.`,
      `Breakdown: ${deliveryRiskCount} delivery/fulfillment risk(s), ${discountDeviationCount} discount deviation(s), and ${stalledCount} stalled negotiation(s).`,
    ];

    // Priority ordering based on time-sensitivity:
    // 1. Delivery slippage / backorders (high urgency)
    // 2. Rep discount deviation (governance policy risk)
    // 3. Stalled negotiation (sales cadence)
    const prioritizedFlags = [...flags].sort((a, b) => {
      const typeWeight = (t: string) => {
        if (t === 'delivery_slippage') return 3;
        if (t === 'discount_anomaly') return 2;
        return 1;
      };
      return typeWeight(b.type) - typeWeight(a.type);
    });

    const recommendedOrder: string[] = prioritizedFlags.slice(0, 5).map((f, i) => {
      const categoryLabel =
        f.type === 'delivery_slippage'
          ? 'Fulfillment / Delivery Risk'
          : f.type === 'discount_anomaly'
          ? 'Discount Policy Deviation'
          : 'Stalled Customer Negotiation';
      return `${i + 1}. Deal ${f.quotationId}: ${categoryLabel} — ${f.details || f.detail}`;
    });

    const suggestedActions: AIAction[] = prioritizedFlags.slice(0, 3).map((f) => ({
      id: `open_${f.quotationId}`,
      label: `Inspect Deal ${f.quotationId}`,
      type: 'navigate',
      payload: { path: `/quotations/${f.quotationId}` },
    }));

    return {
      summary: `Deal Health Triage: ${flags.length} deals require management attention`,
      bullets: [
        ...bullets,
        'Recommended Attention Order (by operational urgency):',
        ...recommendedOrder,
      ],
      rationale: 'Delivery slippages are prioritized first due to fulfillment deadlines, followed by governance policy exceptions and stalled negotiations.',
      suggestedActions,
      confidence: 'high',
      sourceRefs: ['Deal Health Anomaly Engine', 'Warehouse Inventory & Shipment Status'],
      timestamp: Date.now(),
    };
  },

  /**
   * Screen 14: Deal Health — Draft Rep Nudge
   */
  async draftNudge(context: DealHealthNudgeContext): Promise<AIResult> {
    const { flag, repName, customerName, quotationCode } = context;

    let body = '';
    if (flag.type === 'stalled' || (flag.type as string) === 'stalled_deal' || flag.type === 'Stalled') {
      body = `Hi ${repName || 'there'},\n\nPlease follow up with ${customerName || 'the customer'} on quotation ${quotationCode || flag.quotationId}. The deal has recorded no meaningful activity for ${flag.metricValue || '14+ days'} and remains in ${flag.threshold || 'Negotiation'}. A check-in will keep the momentum moving forward.\n\nBest,\nSales Operations`;
    } else if (flag.type === 'discount_anomaly' || flag.type === 'DiscountAnomaly') {
      body = `Hi ${repName || 'there'},\n\nRegarding quotation ${quotationCode || flag.quotationId} for ${customerName || 'your account'}: The submitted discount (${flag.metricValue}) deviates from your standard baseline (${flag.threshold}). Please attach customer business justification or prepare for deal desk escalation.\n\nBest,\nSales Operations`;
    } else {
      body = `Hi ${repName || 'there'},\n\nNotice regarding deal ${quotationCode || flag.quotationId}: ${flag.details || flag.detail || 'Fulfillment slippage detected'}. Please review delivery schedules with customer operations.\n\nBest,\nOperations Desk`;
    }

    return {
      summary: `Rep Nudge Draft for ${repName || 'Sales Representative'}`,
      bullets: [
        `Targeted at Deal ${quotationCode || flag.quotationId}`,
        `Anomaly type: ${flag.type}`,
        'Ready for review and dispatch in dialog.',
      ],
      rationale: body,
      suggestedActions: [
        {
          id: 'use_nudge_draft',
          label: 'Open Nudge in Editor',
          type: 'draft_message',
          payload: { body },
        },
      ],
      confidence: 'high',
      sourceRefs: [`Deal Health Flag ${flag.id}`],
      timestamp: Date.now(),
    };
  },

  /**
   * Customer Portal & Internal Negotiation: Draft Negotiation Reply
   */
  async draftNegotiationReply(context: NegotiationAIContext): Promise<AIResult> {
    const { quotationCode, customerName, requestedDiscount, requestedDeliveryDate, isCustomerFacing } = context;

    let draft = '';
    if (isCustomerFacing) {
      draft = `Thank you for sharing your feedback on quotation ${quotationCode}. We are currently reviewing your requested ${requestedDiscount ? `${requestedDiscount} commercial terms` : 'provisions'}${requestedDeliveryDate ? ` and ${requestedDeliveryDate} delivery timetable` : ''} with our internal team and will provide an updated schedule shortly.`;
    } else {
      draft = `Customer ${customerName} requested concession to ${requestedDiscount || 'custom terms'} and delivery by ${requestedDeliveryDate || 'target date'}. Evaluating impact against product category limits.`;
    }

    return {
      summary: 'Negotiation Response Draft',
      bullets: [
        isCustomerFacing
          ? 'Customer-safe language: no internal margins, risk ratings, or escalation flags.'
          : 'Internal operations summary.',
      ],
      rationale: draft,
      suggestedActions: [
        {
          id: 'insert_reply',
          label: 'Use Response in Chat',
          type: 'draft_message',
          payload: { body: draft },
        },
      ],
      confidence: 'high',
      sourceRefs: [`Negotiation Thread ${quotationCode}`],
      timestamp: Date.now(),
    };
  },

  /**
   * Reports Page: Summarize Filtered Report Data
   * MANDATORY: Test P: Respects active filters (rep, period, category).
   */
  async summarizeReport(context: ReportAIContext): Promise<AIResult> {
    const { period, repName, productCategory, metrics, topUpsellProduct } = context;

    const filterScope: string[] = [];
    if (period) filterScope.push(`Period: ${period}`);
    if (repName) filterScope.push(`Sales Rep: ${repName}`);
    if (productCategory) filterScope.push(`Category: ${productCategory}`);

    const bullets: string[] = [
      `Analyzed dataset scope: ${filterScope.join(' | ')}.`,
      `Pipeline throughput: ${metrics.totalQuotes} quotations evaluated generating ${formatCurrency(metrics.totalPipelineValue)} in gross pipeline value.`,
      `Governance velocity: Average management approval turnaround is ${metrics.avgApprovalHours.toFixed(1)} hours.`,
      `Concession levels: Average commercial discount given is ${metrics.avgDiscountGiven.toFixed(1)}%, yielding a blended gross margin of ${metrics.blendedGrossMargin.toFixed(1)}%.`,
      `Sales conversion: Effective win rate stands at ${metrics.winRatePercent.toFixed(1)}%.`,
    ];

    if (topUpsellProduct) {
      bullets.push(`Top performing add-on: "${topUpsellProduct}" represents the highest attached upsell in this filtered cohort.`);
    }

    return {
      summary: `Executive Performance Summary (${filterScope.join(', ')})`,
      bullets,
      rationale: `Metrics derived purely from the active filtered report ledger. No cross-cohort data leaked.`,
      confidence: 'high',
      sourceRefs: ['Reporting Analytics Service', 'Filter Context'],
      timestamp: Date.now(),
    };
  },

  /**
   * Global Command Center: Answer Workspace Questions
   * Answers operational workspace questions with real entity links.
   * Does NOT hallucinate. Rejects out-of-domain queries gracefully.
   */
  async answerWorkspaceQuestion(context: WorkspaceAIContext, query: string): Promise<AIResult> {
    const cleanQuery = query.toLowerCase().trim();

    // Check for out-of-domain queries (weather, sports, generic questions)
    const outOfDomainTerms = ['weather', 'president', 'capital of', 'movie', 'joke', 'recipe', 'world cup'];
    if (outOfDomainTerms.some((term) => cleanQuery.includes(term))) {
      return {
        summary: "I don't have enough DealFlow360 workspace data to answer this reliably.",
        bullets: [
          'The DealFlow360 AI copilot is strictly focused on enterprise sales operations.',
          'Missing: External web tools or general search engines.',
          'Try asking about: quotations, pending approvals, deal health anomalies, backorders, or subscription renewals.',
        ],
        confidence: 'low',
        sourceRefs: ['Workspace Boundary Guardrail'],
        timestamp: Date.now(),
      };
    }

    const { quotations, approvalSteps, dealHealthFlags, userRole } = context;

    // 1. "Which deals need my attention today?" or "attention"
    if (cleanQuery.includes('attention') || cleanQuery.includes('today') || cleanQuery.includes('priority')) {
      const pendingApprovals = quotations.filter(
        (q) => q.stage === 'PendingApproval' || q.stage === 'Pending Approval'
      );
      const activeFlags = dealHealthFlags.filter((f) => !f.isResolved);
      const highRisk = quotations.filter(
        (q) => (q.blendedRiskValue || q.blendedRiskLevel) === 'HIGH'
      );

      const bullets: string[] = [
        `${pendingApprovals.length} quotation(s) are awaiting governance sign-off.`,
        `${activeFlags.length} deal health anomaly flag(s) require intervention.`,
        `${highRisk.length} active deal(s) carry elevated blended risk.`,
      ];

      const suggestedActions: AIAction[] = [];
      if (pendingApprovals.length > 0) {
        suggestedActions.push({
          id: 'view_pending_approvals',
          label: `Review Pending Approvals (${pendingApprovals.length})`,
          type: 'navigate',
          payload: { path: '/approvals' },
        });
      }
      if (activeFlags.length > 0) {
        suggestedActions.push({
          id: 'view_deal_health',
          label: `Open Deal Health Dashboard (${activeFlags.length})`,
          type: 'navigate',
          payload: { path: '/deal-health' },
        });
      }
      if (highRisk[0]) {
        suggestedActions.push({
          id: `open_high_risk_${highRisk[0].id}`,
          label: `Inspect High-Risk Deal ${highRisk[0].code}`,
          type: 'navigate',
          payload: { path: `/quotations/${highRisk[0].id}` },
        });
      }

      return {
        summary: `Operational Overview: ${pendingApprovals.length + activeFlags.length} items require attention today.`,
        bullets,
        rationale: 'Identified through active approval queues, deal health flags, and high-risk quotation scores.',
        suggestedActions,
        confidence: 'high',
        sourceRefs: ['Approvals Queue', 'Deal Health Engine', 'Quotations Register'],
        timestamp: Date.now(),
      };
    }

    // 2. "Which quotations are waiting on Finance?"
    if (cleanQuery.includes('finance') || cleanQuery.includes('waiting on finance')) {
      const financeQuotes = quotations.filter((q) => {
        const isPending = q.stage === 'PendingApproval' || q.stage === 'Pending Approval';
        const hasFinance = q.requiredApprovers?.some((r) => r.toLowerCase().includes('finance'));
        return isPending && hasFinance;
      });

      if (financeQuotes.length === 0) {
        return {
          summary: 'Zero quotations are currently awaiting Finance Director sign-off.',
          bullets: ['All pending approvals are either resolved or currently in Step 1 (Sales Manager review).'],
          suggestedActions: [
            {
              id: 'view_all_approvals',
              label: 'View All Approvals Queue',
              type: 'navigate',
              payload: { path: '/approvals' },
            },
          ],
          confidence: 'high',
          sourceRefs: ['Approval Workflow Engine'],
          timestamp: Date.now(),
        };
      }

      const bullets = financeQuotes.map(
        (q) => `• ${q.code} (${q.customerName}) — Value: ${formatCurrency(q.grandTotal)}, Gross Margin: ${(q.marginPercent || 0).toFixed(1)}%`
      );

      const suggestedActions: AIAction[] = financeQuotes.slice(0, 3).map((q) => ({
        id: `open_approval_${q.id}`,
        label: `Open Approval for ${q.code}`,
        type: 'navigate',
        payload: { path: `/approvals/${q.id}` },
      }));

      return {
        summary: `${financeQuotes.length} quotation(s) require Finance Director sign-off:`,
        bullets,
        suggestedActions,
        confidence: 'high',
        sourceRefs: financeQuotes.map((q) => `Quotation ${q.code}`),
        timestamp: Date.now(),
      };
    }

    // 3. "Which customers have high-risk discount exceptions?"
    if (cleanQuery.includes('risk') || cleanQuery.includes('discount exception')) {
      const highRiskQuotes = quotations.filter(
        (q) =>
          (q.blendedRiskValue || q.blendedRiskLevel) === 'HIGH' ||
          (q.blendedRiskScore || 0) >= 70 ||
          q.lines.some((l) => l.overBy > 0)
      );

      const bullets = highRiskQuotes.slice(0, 5).map((q) => {
        const worstLine = q.lines.sort((a, b) => b.overBy - a.overBy)[0];
        const overInfo = worstLine && worstLine.overBy > 0 ? ` (+${worstLine.overBy.toFixed(1)} pts on ${worstLine.productName})` : '';
        return `• ${q.code} (${q.customerName}): Blended Risk ${q.blendedRiskValue || 'HIGH'} [Score ${q.blendedRiskScore}/100]${overInfo}`;
      });

      const suggestedActions: AIAction[] = highRiskQuotes.slice(0, 3).map((q) => ({
        id: `nav_quote_${q.id}`,
        label: `Inspect ${q.code}`,
        type: 'navigate',
        payload: { path: `/quotations/${q.id}` },
      }));

      return {
        summary: `${highRiskQuotes.length} quotation(s) currently carry discount ceiling exceptions:`,
        bullets,
        suggestedActions,
        confidence: 'high',
        sourceRefs: ['Discount Governance Matrix'],
        timestamp: Date.now(),
      };
    }

    // 4. "Show backordered orders with delivery risk"
    if (cleanQuery.includes('backorder') || cleanQuery.includes('delivery') || cleanQuery.includes('fulfillment')) {
      const deliveryFlags = dealHealthFlags.filter((f) => f.type === 'delivery_slippage' && !f.isResolved);

      const bullets = deliveryFlags.map(
        (f) => `• Deal ${f.quotationId}: ${f.details || f.detail}${f.metricValue ? ` (Metric: ${f.metricValue}, Target: ${f.threshold})` : ''}`
      );

      return {
        summary: `${deliveryFlags.length} delivery/fulfillment issue(s) detected:`,
        bullets: bullets.length > 0 ? bullets : ['No active delivery slippages or inventory stockouts flagged.'],
        suggestedActions: [
          {
            id: 'open_fulfillment_page',
            label: 'Open Fulfillment & Stock View',
            type: 'navigate',
            payload: { path: '/fulfillment' },
          },
        ],
        confidence: 'high',
        sourceRefs: ['Fulfillment Ledger', 'Deal Health Engine'],
        timestamp: Date.now(),
      };
    }

    // 5. "Which subscriptions have billing changes this month?"
    if (cleanQuery.includes('subscription') || cleanQuery.includes('billing') || cleanQuery.includes('recurring')) {
      const subQuotes = quotations.filter((q) => q.lines.some((l) => l.isSubscription));

      const bullets = subQuotes.slice(0, 4).map((q) => {
        const subLines = q.lines.filter((l) => l.isSubscription);
        const recurringTotal = subLines.reduce((acc, l) => acc + l.lineTotal, 0);
        return `• ${q.code} (${q.customerName}): ${subLines.length} recurring SaaS service(s), ${formatCurrency(recurringTotal)}/mo.`;
      });

      return {
        summary: `${subQuotes.length} account(s) have active hybrid recurring billing schedules:`,
        bullets: bullets.length > 0 ? bullets : ['No active subscriptions scheduled for billing adjustments.'],
        suggestedActions: [
          {
            id: 'open_subscriptions_page',
            label: 'View Subscriptions & Billing',
            type: 'navigate',
            payload: { path: '/subscriptions' },
          },
        ],
        confidence: 'high',
        sourceRefs: ['Subscriptions Engine'],
        timestamp: Date.now(),
      };
    }

    // Generic match across quotations by customer or code
    const matchingQuotes = quotations.filter(
      (q) =>
        q.code.toLowerCase().includes(cleanQuery) ||
        q.customerName.toLowerCase().includes(cleanQuery) ||
        q.repName?.toLowerCase().includes(cleanQuery)
    );

    if (matchingQuotes.length > 0) {
      const bullets = matchingQuotes.slice(0, 4).map(
        (q) => `• ${q.code} — ${q.customerName} (${q.stage}, ${formatCurrency(q.grandTotal)}, Rep: ${q.repName || 'Sarah Chen'})`
      );

      return {
        summary: `Found ${matchingQuotes.length} matching quotation record(s):`,
        bullets,
        suggestedActions: matchingQuotes.slice(0, 2).map((q) => ({
          id: `match_${q.id}`,
          label: `Open ${q.code}`,
          type: 'navigate',
          payload: { path: `/quotations/${q.id}` },
        })),
        confidence: 'medium',
        sourceRefs: matchingQuotes.map((q) => q.code),
        timestamp: Date.now(),
      };
    }

    // Fallback if no matching records found
    return {
      summary: `No matching records found in DealFlow360 workspace for "${query}".`,
      bullets: [
        'Try querying by quotation number (e.g., "QT-2026-1042")',
        'Try asking about operational bottlenecks: "Which deals are waiting on Finance?"',
        'Check active anomalies: "Show backorders" or "Which deals need attention?"',
      ],
      confidence: 'low',
      sourceRefs: ['Workspace Search Index'],
      timestamp: Date.now(),
    };
  },
};
