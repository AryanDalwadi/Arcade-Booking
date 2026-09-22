import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4002),
  DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/arcade_catalog'),
  KAFKA_BROKERS: z.string().default('localhost:9092'),
  KAFKA_CLIENT_ID: z.string().default('arcade-catalog'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
});

export type Env = z.infer<typeof schema>;
export const parseEnv = (source: NodeJS.ProcessEnv): Env => schema.parse(source);
export const env = parseEnv(process.env);

