import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { insertAuditLog } from '../../shared/auditLog';
import { runPostCommit } from '../../shared/postCommit';
import { getPaginationParams, buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { discountEngineService } from '../discount-engine/discount-engine.service';
import { notificationsService } from '../notifications/notifications.service';
import { negotiationsRepository } from './negotiations.repository';
import { Negotiation } from './negotiations.model';
import { AuthenticatedUser } from '../auth/auth.types';

const ACTIONABLE_STATUSES = new Set(['OPEN', 'IN_PROGRESS']);

interface CounterOfferChange {
  quotation_item_id: string;
  new_discount_percent: number;
}

interface AddMessageDto {
  senderUserId: string;
  message: string;
  messageType: 'TEXT' | 'COUNTER_OFFER';
  changes?: CounterOfferChange[];
  /** Set only for portal callers — enforces row-level tenant isolation. */
  portalCustomerId?: string;
}

export const negotiationsService = {
  /**
   * Sales-rep-facing inbox — every negotiation thread across the caller's
   * own quotations (or all of them for managers/admins), most recent
   * first, so a rep can find a customer's message without already knowing
   * which quotation it's on.
   */
  async listAll(
    query: { page?: unknown; limit?: unknown },
    requester: AuthenticatedUser,
  ): Promise<PaginatedResult<Negotiation & { quotation_number: string; customer_id: string }>> {
    const pagination = getPaginationParams(query);
    const filters = { salesRepId: requester.role === 'SALES_REP' ? requester.id : undefined };
    const [items, total] = await Promise.all([
      negotiationsRepository.listAll(filters, pagination.limit, pagination.offset),
      negotiationsRepository.countAll(filters),
    ]);
    return buildPaginatedResult(items, total, pagination);
  },

  async open(
    quotationId: string,
    initiatedBy: string,
    portalCustomerId?: string,
  ): Promise<Negotiation> {
    const quotation = await negotiationsRepository.findQuotationForNegotiation(quotationId);
    if (!quotation) throw Errors.notFound('Quotation');
    if (portalCustomerId && quotation.customer_id !== portalCustomerId) {
      throw Errors.forbidden();
    }
    return negotiationsRepository.insertNegotiation({ quotationId, initiatedBy });
  },

  /**
   * Lets either side (sales rep or portal customer) find the existing
   * negotiation thread for a quotation without already knowing its id, so
   * a page load can resume a conversation instead of always creating a new
   * thread via `open`. Most recent first; each thread's messages are
   * included so the caller doesn't need a second round-trip per thread.
   */
  async listForQuotation(quotationId: string, portalCustomerId?: string) {
    const quotation = await negotiationsRepository.findQuotationForNegotiation(quotationId);
    if (!quotation) throw Errors.notFound('Quotation');
    if (portalCustomerId && quotation.customer_id !== portalCustomerId) {
      throw Errors.forbidden();
    }
    const negotiations = await negotiationsRepository.listByQuotationId(quotationId);
    return Promise.all(
      negotiations.map(async (negotiation) => ({
        ...negotiation,
        messages: await negotiationsRepository.listMessages(negotiation.id),
      })),
    );
  },

  async getDetail(id: string, portalCustomerId?: string) {
    const negotiation = await negotiationsRepository.findByIdWithCustomer(id);
    if (!negotiation) throw Errors.notFound('Negotiation');
    if (portalCustomerId && negotiation.customer_id !== portalCustomerId) {
      throw Errors.forbidden();
    }
    const [messages, changes] = await Promise.all([
      negotiationsRepository.listMessages(id),
      negotiationsRepository.listChanges(id),
    ]);
    return { ...negotiation, messages, changes };
  },

  /**
   * A COUNTER_OFFER message applies the proposed discount changes to the
   * quotation's items, logs each change, and moves both the negotiation and
   * the quotation into NEGOTIATION — then, once that's committed, re-runs
   * the discount engine (docs/development-workflow.md Block 4: "a thin
   * wrapper, not new logic") so a breach silently reappears in the approval
   * queue instead of requiring a separate manual re-check.
   */
  async addMessage(negotiationId: string, dto: AddMessageDto) {
    const negotiation = await negotiationsRepository.findByIdWithCustomer(negotiationId);
    if (!negotiation) throw Errors.notFound('Negotiation');
    if (dto.portalCustomerId && negotiation.customer_id !== dto.portalCustomerId) {
      throw Errors.forbidden();
    }
    if (!ACTIONABLE_STATUSES.has(negotiation.status)) {
      throw Errors.businessRuleViolation(
        `Cannot post a message on a negotiation in status ${negotiation.status}`,
      );
    }

    if (dto.messageType !== 'COUNTER_OFFER') {
      const message = await withTransaction((client) =>
        negotiationsRepository.insertMessage(client, {
          negotiationId,
          senderUserId: dto.senderUserId,
          message: dto.message,
          messageType: dto.messageType,
        }),
      );
      return { message, reEvaluation: null };
    }

    const changes = dto.changes ?? [];
    const message = await withTransaction(async (client) => {
      for (const change of changes) {
        const item = await negotiationsRepository.findQuotationItemForChange(
          change.quotation_item_id,
        );
        if (!item || item.quotation_id !== negotiation.quotation_id) {
          throw Errors.businessRuleViolation(
            `Quotation item ${change.quotation_item_id} does not belong to this negotiation's quotation`,
          );
        }

        // discount_amount/line_total are never stored — quotation_item_amounts
        // recomputes them from discount_percent on every read (006_quotations.sql).
        await negotiationsRepository.updateQuotationItemDiscount(client, item.id, {
          discountPercent: change.new_discount_percent,
        });

        await negotiationsRepository.insertChange(client, {
          negotiationId,
          quotationItemId: item.id,
          fieldName: 'discount_percent',
          oldValue: item.discount_percent,
          newValue: String(change.new_discount_percent),
          changedBy: dto.senderUserId,
        });
      }

      await negotiationsRepository.updateQuotationStatus(
        client,
        negotiation.quotation_id,
        'NEGOTIATION',
      );
      await negotiationsRepository.updateStatus(client, negotiationId, 'IN_PROGRESS');

      await insertAuditLog(client, {
        entityType: 'quotation',
        entityId: negotiation.quotation_id,
        action: 'NEGOTIATION_COUNTER_OFFER',
        actorId: dto.senderUserId,
        newValue: { negotiationId, changes },
      });

      return negotiationsRepository.insertMessage(client, {
        negotiationId,
        senderUserId: dto.senderUserId,
        message: dto.message,
        messageType: 'COUNTER_OFFER',
      });
    });

    // The counter-offer itself is already committed at this point — a
    // failure in either follow-up must not surface as a 500 for a request
    // that already succeeded.
    await runPostCommit('negotiations.addMessage.notify', async () => {
      const quotation = await negotiationsRepository.findQuotationForNegotiation(
        negotiation.quotation_id,
      );
      if (quotation) {
        await notificationsService.notify({
          userId: quotation.sales_rep_id,
          type: 'NEGOTIATION_COUNTER_OFFER',
          title: 'Customer submitted a counter-offer',
          message: `A counter-offer was submitted on quotation ${negotiation.quotation_id}`,
          referenceType: 'quotation',
          referenceId: negotiation.quotation_id,
        });
      }
    });

    const reEvaluation = await discountEngineService.checkDiscounts(negotiation.quotation_id);
    return { message, reEvaluation };
  },
};
