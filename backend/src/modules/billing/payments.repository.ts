import { PoolClient } from 'pg';
import { db } from '../../config/database';
import { Payment } from './payments.model';

export const paymentsRepository = {
  async insert(
    client: PoolClient,
    input: {
      invoiceId: string;
      customerId: string;
      amount: number;
      paymentMethod: string;
      transactionReference: string | null;
    },
  ): Promise<Payment> {
    const { rows } = await client.query(
      `INSERT INTO payments (invoice_id, customer_id, amount, payment_method, transaction_reference, status, paid_at)
       VALUES ($1, $2, $3, $4, $5, 'SUCCESS', now())
       RETURNING *`,
      [
        input.invoiceId,
        input.customerId,
        input.amount,
        input.paymentMethod,
        input.transactionReference,
      ],
    );
    return rows[0] as Payment;
  },

  async listForInvoice(invoiceId: string): Promise<Payment[]> {
    const { rows } = await db.query(
      'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC',
      [invoiceId],
    );
    return rows as Payment[];
  },

  async sumSuccessfulForInvoice(client: PoolClient, invoiceId: string): Promise<number> {
    const { rows } = await client.query(
      `SELECT COALESCE(SUM(amount), 0)::float8 AS total FROM payments
       WHERE invoice_id = $1 AND status = 'SUCCESS'`,
      [invoiceId],
    );
    return (rows[0] as { total: number }).total;
  },
};
