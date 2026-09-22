import { createServer } from 'node:http';
import { env } from './config/env';
import { Postgres } from './adapters/postgres';
import { KafkaAdapter } from './adapters/kafka';
import { RedisAdapter } from './adapters/redis';
import { createHttpApp } from './http/app';
import { catalogRoutes } from './application/context';

const db = new Postgres(env.DATABASE_URL);
const kafka = new KafkaAdapter(env.KAFKA_CLIENT_ID, env.KAFKA_BROKERS.split(',').map((x) => x.trim()));
const redis = new RedisAdapter(env.REDIS_URL);
let dependencyReady = false;


async function connectDependencies() {
  try {
    
    await redis.connect();
    dependencyReady = true;
    
  } catch (error) {
    dependencyReady = false;
    console.error('Dependency startup failed; readiness remains false:', error);
  }
}

const app = createHttpApp({ dbReady: () => db.ready(), dependencyReady: () => dependencyReady, routes: catalogRoutes(db, redis) });
const server = createServer(app);
server.listen(env.PORT, () => console.log('catalog listening on', env.PORT));
void connectDependencies();

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

