import { AppError, Errors } from '../../errors/AppError';
import { mapDbError } from '../../shared/crud/dbErrors';
import { withTransaction } from '../../shared/db/withTransaction';
import { roundMoney } from '../../shared/money';
import { generateDocumentNumber } from '../../shared/documentNumber';
import { insertAuditLog } from '../../shared/auditLog';
import { getPaginationParams, buildPaginatedResult, PaginatedResult } from '../../utils/pagination';
import { computeNextBillingDate } from './billingDates';
import { billingRepository } from './billing.repository';
import { paymentsRepository } from './payments.repository';
import { GenerateBillingResult, Invoice, InvoiceWithItems } from './billing.model';
import { Payment as PaymentRow } from './payments.model';

const INVOICE_DUE_NET_DAYS = 30;

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export const billingService = {
  /**
   * Billing split on confirm (docs/development-workflow.md Block 3): the
   * quotation lines behind a sales order are split by `billing_type` —
   * ONE_TIME lines become a single draft invoice, RECURRING lines become a
   * subscription with its first billing_schedules row. Both halves (when
   * both exist) are created in one transaction.
   *
   * Recurring lines have no direct link to the admin-configured
   * `subscription_plans` catalog in the schema, so the caller must supply
   * `planId` whenever the order contains recurring items — this is a
   * documented assumption, not a guess baked silently into the code.
   */
  async generateBillingForOrder(
    salesOrderId: string,
    planId?: string,
    actorId: string | null = null,
  ): Promise<GenerateBillingResult> {
    const order = await billingRepository.findSalesOrderForBilling(salesOrderId);
    if (!order) throw Errors.notFound('Sales order');

    const quotationItems = await billingRepository.listQuotationItemsWithProduct(
      order.quotation_id,
    );
    if (quotationItems.length === 0) {
      throw Errors.businessRuleViolation('Sales order has no billable items');
    }

    const oneTimeItems = quotationItems.filter((item) => item.billing_type === 'ONE_TIME');
    const recurringItems = quotationItems.filter((item) => item.billing_type === 'RECURRING');

    if (recurringItems.length > 0 && !planId) {
      throw Errors.businessRuleViolation(
        'Order contains recurring items — plan_id is required to create the subscription',
      );
    }

    const plan = planId ? await billingRepository.findSubscriptionPlan(planId) : null;
    if (planId && !plan) throw Errors.notFound('Subscription plan');

    try {
      return await withTransaction(async (client) => {
      const locked = await billingRepository.lockOrderForBilling(client, salesOrderId);
      if (!locked) throw Errors.notFound('Sales order');
      if (locked.status === 'CANCELLED') {
        throw Errors.businessRuleViolation('Cannot bill a cancelled sales order');
      }
      if (await billingRepository.hasBillingForOrder(client, salesOrderId)) {
        throw Errors.conflict('Billing has already been generated for this order');
      }
      if (await billingRepository.hasUnshippedOneTimeItems(client, salesOrderId)) {
        throw Errors.businessRuleViolation(
          'All one-time goods must be shipped before billing this order',
        );
      }
      let invoice: Invoice | null = null;
      if (oneTimeItems.length > 0) {
        // quotation_items.line_total already includes tax.
        const netAmount = (item: (typeof oneTimeItems)[number]) =>
          roundMoney(
            Number(item.quantity) * Number(item.unit_price) - Number(item.discount_amount),
          );

        invoice = await billingRepository.insertInvoice(client, {
          invoiceNumber: generateDocumentNumber('INV'),
          customerId: order.customer_id,
          salesOrderId,
          quotationId: order.quotation_id,
          dueDate: addDays(new Date(), INVOICE_DUE_NET_DAYS),
        });

        for (const item of oneTimeItems) {
          // invoice_items has no discount column (015_billing_invoices.sql) —
          // the quotation-line discount is netted into unit_price here so
          // quantity * unit_price already equals the discounted amount the
          // customer agreed to; tax_percent carries over unchanged.
          const effectiveUnitPrice =
            Number(item.quantity) > 0 ? roundMoney(netAmount(item) / Number(item.quantity)) : 0;
          await billingRepository.insertInvoiceItem(client, {
            invoiceId: invoice.id,
            productId: item.product_id,
            description: item.product_name,
            quantity: item.quantity,
            unitPrice: String(effectiveUnitPrice),
            taxPercent: item.tax_percent,
          });
        }

        // invoices stores no totals — read the just-inserted items back
        // through invoice_totals so the response carries subtotal/tax_total/total.
        const totals = await billingRepository.findInvoiceTotals(client, invoice.id);
        invoice = { ...invoice, ...totals, discount_total: '0.00' };
      }

      let subscription = null;
      if (recurringItems.length > 0 && plan) {
        const startDate = new Date().toISOString().slice(0, 10);
        const nextBillingDate = computeNextBillingDate(new Date(), plan.billing_frequency);
        const currentPrice = roundMoney(
          recurringItems.reduce((sum, item) => sum + Number(item.line_total), 0),
        );

        subscription = await billingRepository.insertSubscription(client, {
          customerId: order.customer_id,
          salesOrderId,
          quotationId: order.quotation_id,
          planId: plan.id,
          startDate,
          nextBillingDate,
          currentPrice,
        });

        for (const item of recurringItems) {
          await billingRepository.insertSubscriptionItem(client, {
            subscriptionId: subscription.id,
            productId: item.product_id,
            quantity: item.quantity,
            unitPrice: item.unit_price,
          });
        }

        await billingRepository.insertBillingSchedule(client, {
          subscriptionId: subscription.id,
          billingDate: nextBillingDate,
          amount: currentPrice,
        });
      }

      await insertAuditLog(client, {
        entityType: 'sales_order',
        entityId: salesOrderId,
        action: 'BILLING_GENERATED',
        actorId,
        newValue: { invoiceId: invoice?.id ?? null, subscriptionId: subscription?.id ?? null },
      });

      return { invoice, subscription };
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw mapDbError(err, 'Billing generation');
    }
  },

  async getInvoiceDetail(id: string): Promise<InvoiceWithItems & { payments: PaymentRow[] }> {
    const invoice = await billingRepository.findInvoiceById(id);
    if (!invoice) throw Errors.notFound('Invoice');
    const [items, payments] = await Promise.all([
      billingRepository.listInvoiceItems(id),
      paymentsRepository.listForInvoice(id),
    ]);
    return { ...invoice, items, payments };
  },

  async listInvoices(query: {
    status?: string;
    customer_id?: string;
    page?: unknown;
    limit?: unknown;
  }): Promise<PaginatedResult<Invoice>> {
    const pagination = getPaginationParams(query);
    const filters = { status: query.status, customerId: query.customer_id };
    const [items, total] = await Promise.all([
      billingRepository.listInvoices(filters, pagination.limit, pagination.offset),
      billingRepository.countInvoices(filters),
    ]);
    return buildPaginatedResult(items, total, pagination);
  },
};
