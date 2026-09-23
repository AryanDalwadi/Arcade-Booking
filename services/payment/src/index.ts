import { createServer } from 'node:http';
import { installShutdown, log, publicConfig } from '@arcade/observability';
import { env } from './config/env';
import { Postgres } from './adapters/postgres';
import { KafkaAdapter } from './adapters/kafka';
import { RedisAdapter } from './adapters/redis';
import { createHttpApp } from './http/app';
import { expirePendingPayments, handleInventoryReserved, paymentRoutes } from './application/context';
import { RazorpayOrderGateway, SimulatedOrderGateway } from './adapters/razorpay';

const orderGateway = env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET
  ? new RazorpayOrderGateway(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET)
  : new SimulatedOrderGateway();
const publicKeyId = env.RAZORPAY_KEY_ID ?? 'rzp_test_simulated';
const db = new Postgres(env.DATABASE_URL);
const kafka = new KafkaAdapter(env.KAFKA_CLIENT_ID, env.KAFKA_BROKERS.split(',').map((x) => x.trim()));
const redis = new RedisAdapter(env.REDIS_URL);
let dependencyReady = false;
let acceptingTraffic = true;
let relayTimer: NodeJS.Timeout | undefined;
let expireTimer: NodeJS.Timeout | undefined;
async function relayOutbox() {
  const pending = await db.query<{event_id:string;topic:string;payload:unknown}>(
    'SELECT event_id,topic,payload FROM outbox WHERE published_at IS NULL ORDER BY created_at LIMIT 50',
  );
  for (const row of pending.rows) {
    await kafka.publish(row.topic, row.payload);
    await db.query('UPDATE outbox SET published_at=now() WHERE event_id=$1 AND published_at IS NULL', [row.event_id]);
  }
}

async function connectDependencies() {
  try {
    await kafka.connectProducer();
    await kafka.consume(['arcade.inventory.reserved.v1'], (event) => handleInventoryReserved(db, event));
    await redis.connect();
    dependencyReady = true;
    relayTimer = setInterval(() => void relayOutbox().catch((error) => log('error', 'outbox.relay.failed', {
      service: 'payment',
      error: error instanceof Error ? error.message : String(error),
    })), 1_000);
    expireTimer = setInterval(() => void expirePendingPayments(db, env.RESERVATION_HOLD_SECONDS).catch((error) => log('error', 'payment.hold.expire.failed', {
      service: 'payment',
      error: error instanceof Error ? error.message : String(error),
    })), 5_000);
  } catch (error) {
    dependencyReady = false;
    log('error', 'dependency.startup.failed', {
      service: 'payment',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const app = createHttpApp({
  dbReady: () => db.ready(),
  dependencyReady: () => dependencyReady,
  acceptingTraffic: () => acceptingTraffic,
  routes: paymentRoutes(db, {
    gateway: orderGateway,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
    keySecret: env.RAZORPAY_KEY_SECRET,
    publicKeyId,
  }),
});
const server = createServer(app);
server.listen(env.PORT, () => log('info', 'service.listen', {
  service: 'payment',
  port: env.PORT,
  config: publicConfig(env),
}));
void connectDependencies();

installShutdown(server, {
  service: 'payment',
  stopAccepting: () => {
    acceptingTraffic = false;
    if (relayTimer) clearInterval(relayTimer);
    if (expireTimer) clearInterval(expireTimer);
  },
  closeResources: async () => {
    await Promise.allSettled([db.close(), kafka.close(), redis.close()]);
  },
});
