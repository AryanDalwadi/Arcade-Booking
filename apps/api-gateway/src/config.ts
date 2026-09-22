import 'dotenv/config';
import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(8080),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16).default('local-only-change-me'),
  JWT_ISSUER: z.string().optional(),
  JWT_AUDIENCE: z.string().optional(),
  IDENTITY_SERVICE_URL: z.string().url().default('http://localhost:4001'),
  CATALOG_SERVICE_URL: z.string().url().default('http://localhost:4002'),
  BOOKING_SERVICE_URL: z.string().url().default('http://localhost:4003'),
  PAYMENT_SERVICE_URL: z.string().url().default('http://localhost:4004'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_STORE: z.enum(['memory', 'redis']).default('memory'),
  REDIS_URL: z.string().url().optional(),
  TRUST_PROXY: booleanString.default(false),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export type GatewayConfig = z.infer<typeof envSchema> & { corsOrigins: string[] };

export function loadConfig(source: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid gateway environment: ${details}`);
  }
  if (parsed.data.RATE_LIMIT_STORE === 'redis' && !parsed.data.REDIS_URL) {
    throw new Error('Invalid gateway environment: REDIS_URL is required when RATE_LIMIT_STORE=redis');
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET === 'local-only-change-me') {
    throw new Error('Invalid gateway environment: JWT_SECRET must be set in production');
  }
  return {
    ...parsed.data,
    corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
  };
}
