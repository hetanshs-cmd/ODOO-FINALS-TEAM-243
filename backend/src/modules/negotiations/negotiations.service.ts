import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { roundMoney } from '../../shared/money';
import { discountEngineService } from '../discount-engine/discount-engine.service';
import { notificationsService } from '../notifications/notifications.service';
import { negotiationsRepository } from './negotiations.repository';
import { Negotiation } from './negotiations.model';

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

        const lineSubtotal = roundMoney(Number(item.quantity) * Number(item.unit_price));
        const discountAmount = roundMoney(lineSubtotal * (change.new_discount_percent / 100));
        const taxableAmount = roundMoney(lineSubtotal - discountAmount);
        const taxAmount = roundMoney(taxableAmount * (Number(item.tax_percent) / 100));
        const lineTotal = roundMoney(taxableAmount + taxAmount);

        await negotiationsRepository.updateQuotationItemDiscount(client, item.id, {
          discountPercent: change.new_discount_percent,
          discountAmount,
          lineTotal,
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

      await negotiationsRepository.recalculateQuotationTotals(client, negotiation.quotation_id);
      await negotiationsRepository.updateQuotationStatus(
        client,
        negotiation.quotation_id,
        'NEGOTIATION',
      );
      await negotiationsRepository.updateStatus(client, negotiationId, 'IN_PROGRESS');

      return negotiationsRepository.insertMessage(client, {
        negotiationId,
        senderUserId: dto.senderUserId,
        message: dto.message,
        messageType: 'COUNTER_OFFER',
      });
    });

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

    const reEvaluation = await discountEngineService.checkDiscounts(negotiation.quotation_id);
    return { message, reEvaluation };
  },
};
