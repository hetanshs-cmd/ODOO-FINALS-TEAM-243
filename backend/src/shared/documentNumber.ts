import { randomBytes } from 'crypto';

/** Same shape as quotations' own generator (kept local there) — `PREFIX-YYYYMMDD-hex6`. */
export function generateDocumentNumber(prefix: string): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${today}-${suffix}`;
}
