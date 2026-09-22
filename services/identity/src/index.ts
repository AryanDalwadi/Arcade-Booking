import { createServer } from 'node:http';
import { env } from './config/env';
import { Postgres } from './adapters/postgres';
import { KafkaAdapter } from './adapters/kafka';
import { RedisAdapter } from './adapters/redis';
import { createHttpApp } from './http/app';
import { bootstrapAdmin, identityRoutes } from './application/context';

const db = new Postgres(env.DATABASE_URL);
const kafka = new KafkaAdapter(env.KAFKA_CLIENT_ID, env.KAFKA_BROKERS.split(',').map((x) => x.trim()));
const redis = new RedisAdapter(env.REDIS_URL);
let dependencyReady = true;


async function connectDependencies() {
  try {
    
    
    dependencyReady = true;
    
  } catch (error) {
    dependencyReady = false;
    console.error('Dependency startup failed; readiness remains false:', error);
  }
}

const app = createHttpApp({ dbReady: () => db.ready(), dependencyReady: () => dependencyReady, routes: identityRoutes(db, env) });
const server = createServer(app);
async function start() {
  if (env.BOOTSTRAP_ADMIN_EMAIL) {
    const found = await bootstrapAdmin(db, env.BOOTSTRAP_ADMIN_EMAIL);
    if (!found) {
      console.warn('Bootstrap admin user was not found:', env.BOOTSTRAP_ADMIN_EMAIL);
    }
  }
  server.listen(env.PORT, () => console.log('identity listening on', env.PORT));
  void connectDependencies();
}
void start().catch((error) => {
  console.error('Identity startup failed:', error);
  process.exit(1);
});

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log('Shutting down after', signal);
  
  server.close(async () => {
    await Promise.allSettled([db.close(), kafka.close(), redis.close()]);
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

