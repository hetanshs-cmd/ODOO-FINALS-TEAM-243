import { Errors } from '../../errors/AppError';
import { getPaginationParams, buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { creditNotesRepository } from './credit-notes.repository';
import { CreditNote, CreditNoteStatus } from './credit-notes.model';

// PENDING -> APPLIED (credited against a future invoice) or VOIDED
// (cancelled without ever being applied). Once resolved either way, the
// decision is final — matches deal_alerts' one-way status pattern.
const VALID_TRANSITIONS: Record<CreditNoteStatus, CreditNoteStatus[]> = {
  PENDING: ['APPLIED', 'VOIDED'],
  APPLIED: [],
  VOIDED: [],
};

export const creditNotesService = {
  async list(query: {
    status?: string;
    customer_id?: string;
    subscription_id?: string;
    page?: unknown;
    limit?: unknown;
  }): Promise<PaginatedResult<CreditNote>> {
    const pagination = getPaginationParams(query);
    const filters = {
      status: query.status,
      customerId: query.customer_id,
      subscriptionId: query.subscription_id,
    };
    const [items, total] = await Promise.all([
      creditNotesRepository.list(filters, pagination.limit, pagination.offset),
      creditNotesRepository.count(filters),
    ]);
    return buildPaginatedResult(items, total, pagination);
  },

  async getById(id: string): Promise<CreditNote> {
    const creditNote = await creditNotesRepository.findById(id);
    if (!creditNote) throw Errors.notFound('Credit note');
    return creditNote;
  },

  async updateStatus(id: string, status: CreditNoteStatus): Promise<CreditNote> {
    const creditNote = await creditNotesRepository.findById(id);
    if (!creditNote) throw Errors.notFound('Credit note');
    if (!VALID_TRANSITIONS[creditNote.status].includes(status)) {
      throw Errors.businessRuleViolation(
        `Cannot move a credit note from ${creditNote.status} to ${status}`,
      );
    }
    const updated = await creditNotesRepository.updateStatus(id, status);
    if (!updated) throw Errors.notFound('Credit note');
    return updated;
  },
};
