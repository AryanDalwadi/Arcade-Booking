import { createServer } from 'node:http';
import { installShutdown, log, publicConfig } from '@arcade/observability';
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
let acceptingTraffic = true;

async function connectDependencies() {
  try {
    dependencyReady = true;
  } catch (error) {
    dependencyReady = false;
    log('error', 'dependency.startup.failed', {
      service: 'identity',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const app = createHttpApp({
  dbReady: () => db.ready(),
  dependencyReady: () => dependencyReady,
  acceptingTraffic: () => acceptingTraffic,
  routes: identityRoutes(db, env),
});
const server = createServer(app);
async function start() {
  if (env.BOOTSTRAP_ADMIN_EMAIL) {
    const found = await bootstrapAdmin(db, env.BOOTSTRAP_ADMIN_EMAIL);
    if (!found) {
      log('warn', 'bootstrap.admin.missing', { service: 'identity' });
    }
  }
  server.listen(env.PORT, () => log('info', 'service.listen', {
    service: 'identity',
    port: env.PORT,
    config: publicConfig(env),
  }));
  void connectDependencies();
}
void start().catch((error) => {
  log('error', 'service.start.failed', {
    service: 'identity',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});

installShutdown(server, {
  service: 'identity',
  stopAccepting: () => {
    acceptingTraffic = false;
  },
  closeResources: async () => {
    await Promise.allSettled([db.close(), kafka.close(), redis.close()]);
  },
});
