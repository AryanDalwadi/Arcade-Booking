import { createServer } from 'node:http';
import { installShutdown, log, publicConfig } from '@arcade/observability';
import { env } from './config/env';
import { Postgres } from './adapters/postgres';
import { KafkaAdapter } from './adapters/kafka';
import { RedisAdapter } from './adapters/redis';
import { createHttpApp } from './http/app';
import { analyticsRoutes, handleEvent } from './application/context';

const db = new Postgres(env.DATABASE_URL);
const kafka = new KafkaAdapter(env.KAFKA_CLIENT_ID, env.KAFKA_BROKERS.split(',').map((x) => x.trim()));
const redis = new RedisAdapter(env.REDIS_URL);
let dependencyReady = false;
let acceptingTraffic = true;

async function connectDependencies() {
  try {
    await kafka.consume(['arcade.booking.created.v1','arcade.payment.completed.v1','arcade.payment.failed.v1','arcade.inventory.reserved.v1','arcade.inventory.rejected.v1'], (event) => handleEvent(db, event));
    dependencyReady = true;
  } catch (error) {
    dependencyReady = false;
    log('error', 'dependency.startup.failed', {
      service: 'analytics',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const app = createHttpApp({
  dbReady: () => db.ready(),
  dependencyReady: () => dependencyReady,
  acceptingTraffic: () => acceptingTraffic,
  routes: analyticsRoutes(db),
});
const server = createServer(app);
server.listen(env.PORT, () => log('info', 'service.listen', {
  service: 'analytics',
  port: env.PORT,
  config: publicConfig(env),
}));
void connectDependencies();

installShutdown(server, {
  service: 'analytics',
  stopAccepting: () => {
    acceptingTraffic = false;
  },
  closeResources: async () => {
    await Promise.allSettled([db.close(), kafka.close(), redis.close()]);
  },
});
