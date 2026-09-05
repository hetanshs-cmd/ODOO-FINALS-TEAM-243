import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Environment variable schema.
 * All required variables are validated at startup.
 * The application will NOT start if any required variable is missing.
 */
const envSchema = z.object({
  // Deliberately NOT defaulted. A missing NODE_ENV used to silently mean
  // "development", which made every production-only safeguard (the portal
  // magic-link devToken, the seed script's guard) fail open on a forgotten
  // env var. Failing to boot is the safe outcome.
  NODE_ENV: z.enum(['development', 'test', 'production'], {
    required_error: 'NODE_ENV is required (development | test | production)',
  }),
  PORT: z.string().default('4000').transform(Number),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters for security'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  BCRYPT_ROUNDS: z.string().default('12').transform(Number),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  // Explicit opt-in for returning the magic-link token in the API response.
  // Previously this was inferred from `NODE_ENV !== 'production'`, so any
  // environment that wasn't explicitly production handed out portal sessions
  // to anyone who knew a customer's email address.
  ALLOW_DEV_MAGIC_LINK: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  // Local LLM (Ollama) used by the /api/v1/ai/* routes — see
  // docs/technology-decisions.md. Defaults keep the app fully functional
  // with Ollama disabled or unreachable: aiService throws AI_UNAVAILABLE,
  // and the frontend falls back to its deterministic template adapter.
  OLLAMA_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('qwen2.5:3b-instruct'),
  OLLAMA_TIMEOUT_MS: z.string().default('20000').transform(Number),
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

// A production deployment must never hand out magic-link tokens over the API,
// regardless of what the env var says — defence in depth behind the explicit
// opt-in above.
if (parseResult.data.NODE_ENV === 'production' && parseResult.data.ALLOW_DEV_MAGIC_LINK) {
  console.error('❌ ALLOW_DEV_MAGIC_LINK cannot be enabled when NODE_ENV=production');
  process.exit(1);
}

export const config = parseResult.data;
export type Config = typeof config;
