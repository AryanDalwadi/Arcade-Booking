import 'dotenv/config';
import { requireProductionEnv } from '@arcade/observability';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4004),
  DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/arcade_payment'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('arcade-payment'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
});

export type Env = z.infer<typeof schema>;
export const parseEnv = (source: NodeJS.ProcessEnv): Env => {
  const parsed = schema.parse(source);
  requireProductionEnv(source, ['DATABASE_URL', 'REDIS_URL', 'KAFKA_BROKERS']);
  return parsed;
};
export const env = parseEnv(process.env);

