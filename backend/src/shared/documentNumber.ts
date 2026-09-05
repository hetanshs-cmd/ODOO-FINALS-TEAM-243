import { randomBytes } from 'crypto';

/** `PREFIX-YYYYMMDD-hex6` — used by quotations, sales-orders, and billing for their document numbers. */
export function generateDocumentNumber(prefix: string): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${today}-${suffix}`;
}
