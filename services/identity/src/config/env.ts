import 'dotenv/config';
import { requireProductionEnv } from '@arcade/observability';
import { z } from 'zod';

const developmentJwtSecret = 'development-only-secret-change-me-now';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4001),
  DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/arcade_identity'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('arcade-identity'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  JWT_SECRET: z.string().min(32).default(developmentJwtSecret),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_ISSUER: z.string().min(1).default('arcade-identity'),
  JWT_AUDIENCE: z.string().min(1).default('arcade-web'),
  BOOTSTRAP_ADMIN_EMAIL: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.email().optional(),
  ),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && value.JWT_SECRET === developmentJwtSecret) {
    context.addIssue({
      code: 'custom',
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET must be explicitly configured in production',
    });
  }
});

export type Env = z.infer<typeof schema>;
export const parseEnv = (source: NodeJS.ProcessEnv): Env => {
  const parsed = schema.parse(source);
  requireProductionEnv(source, ['DATABASE_URL', 'REDIS_URL', 'KAFKA_BROKERS', 'JWT_SECRET']);
  return parsed;
};
export const env = parseEnv(process.env);

