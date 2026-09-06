import { Errors } from '../../errors/AppError';
import { withTransaction } from '../../shared/db/withTransaction';
import { insertAuditLog } from '../../shared/auditLog';
import { discountEngineService } from '../discount-engine/discount-engine.service';
import { salesOrdersService } from '../sales-orders/sales-orders.service';
import { SalesOrderWithItems } from '../sales-orders/sales-orders.model';
import { portalRepository } from './portal.repository';

/**
 * States a customer is allowed to confirm from. APPROVED means governance
 * already cleared it; SUBMITTED/NEGOTIATION mean it still has to survive a
 * fresh discount check before it can be accepted.
 */
const CONFIRMABLE_STATUSES = new Set(['SUBMITTED', 'NEGOTIATION', 'APPROVED']);

export interface ConfirmQuotationResult {
  quotationId: string;
  status: 'ACCEPTED' | 'PENDING_APPROVAL';
  /** Null when the confirmation re-entered the approval queue instead of converting. */
  salesOrder: SalesOrderWithItems | null;
  requiresApproval: boolean;
}

export const portalService = {
  async listQuotations(customerId: string) {
    return portalRepository.listQuotationsForCustomer(customerId);
  },

  async getQuotation(id: string, customerId: string) {
    const quotation = await portalRepository.findQuotationForCustomer(id, customerId);
    if (!quotation) throw Errors.notFound('Quotation');
    return quotation;
  },

  async listInvoices(customerId: string) {
    return portalRepository.listInvoicesForCustomer(customerId);
  },

  async getInvoice(id: string, customerId: string) {
    const invoice = await portalRepository.findInvoiceForCustomer(id, customerId);
    if (!invoice) throw Errors.notFound('Invoice');
    return invoice;
  },

  async getProfile(customerId: string) {
    const profile = await portalRepository.findProfileForCustomer(customerId);
    if (!profile) throw Errors.notFound('Customer');
    return profile;
  },

  async listNegotiations(customerId: string) {
    return portalRepository.listNegotiationsForCustomer(customerId);
  },

  /**
   * FR9 — customer confirmation.
   *
   * The customer accepting a quotation must not be a way to bypass discount
   * governance: anything still in SUBMITTED/NEGOTIATION is re-run through the
   * discount engine first. If the negotiated discounts now breach a ceiling,
   * the quotation silently re-enters the approval queue and is NOT accepted.
   * Only a quotation the engine clears (or one already APPROVED) moves to
   * ACCEPTED and is converted into a sales order.
   *
   * This is the missing producer of the ACCEPTED status — without it, nothing
   * in the system could ever reach the state `convert` requires.
   */
  async confirmQuotation(id: string, customerId: string): Promise<ConfirmQuotationResult> {
    const initialStatus = await withTransaction(async (client) => {
      const quotation = await portalRepository.findQuotationForConfirmForUpdate(
        client,
        id,
        customerId,
      );
      // Scoped by customer_id, so another customer's quotation reads as absent.
      if (!quotation) throw Errors.notFound('Quotation');
      if (!CONFIRMABLE_STATUSES.has(quotation.status)) {
        throw Errors.businessRuleViolation(
          `Cannot confirm a quotation in status ${quotation.status}`,
        );
      }
      return quotation.status;
    });

    // Re-run governance unless the approval chain already cleared this
    // quotation. checkDiscounts owns the status transition to APPROVED or
    // PENDING_APPROVAL and creates the approval request when one is needed.
    let clearedStatus: string = initialStatus;
    if (initialStatus !== 'APPROVED') {
      const evaluation = await discountEngineService.checkDiscounts(id);
      clearedStatus = evaluation.status;
    }

    if (clearedStatus !== 'APPROVED') {
      return {
        quotationId: id,
        status: 'PENDING_APPROVAL',
        salesOrder: null,
        requiresApproval: true,
      };
    }

    await withTransaction(async (client) => {
      const accepted = await portalRepository.markQuotationAccepted(client, id);
      if (!accepted) throw Errors.notFound('Quotation');
      await insertAuditLog(client, {
        entityType: 'quotation',
        entityId: id,
        action: 'QUOTATION_ACCEPTED_BY_CUSTOMER',
        // Portal confirmation is customer-initiated; there is no internal
        // users.id acting here, which is exactly the case actorId models.
        actorId: null,
        oldValue: { status: initialStatus },
        newValue: { status: 'ACCEPTED' },
      });
    });

    const salesOrder = await salesOrdersService.convertFromQuotation(id);

    return { quotationId: id, status: 'ACCEPTED', salesOrder, requiresApproval: false };
  },
};
