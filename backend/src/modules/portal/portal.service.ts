import { Errors } from '../../errors/AppError';
import { portalRepository } from './portal.repository';

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
};
