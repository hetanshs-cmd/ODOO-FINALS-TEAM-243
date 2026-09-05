import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Environment variable schema.
 * All required variables are validated at startup.
 * The application will NOT start if any required variable is missing.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.string().default('4000').transform(Number),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  BCRYPT_ROUNDS: z.string().default('12').transform(Number),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
});

/**
 * Parsed and validated environment configuration.
 * Import this instead of using process.env directly.
 */
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parseResult.error.format());
  process.exit(1);
}

export const config = parseResult.data;
export type Config = typeof config;
