import { createServer } from 'node:http';
import { Redis } from 'ioredis';
import { log, publicConfig } from '@arcade/observability';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { MemoryRateLimitStore, RedisRateLimitStore } from './rate-limit.js';

const config = loadConfig();
const redis = config.RATE_LIMIT_STORE === 'redis'
  ? new Redis(config.REDIS_URL!, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    })
  : null;
if (redis) {
  await redis.connect();
  redis.on('error', (error) => log('error', 'dependency.redis', { service: 'api-gateway', error: error.message }));
}
const rateLimitStore = redis ? new RedisRateLimitStore(redis) : new MemoryRateLimitStore();
let shuttingDown = false;
const server = createServer(createApp(config, rateLimitStore, () => !shuttingDown));

server.listen(config.PORT, () => {
  log('info', 'service.listen', {
    service: 'api-gateway',
    port: config.PORT,
    config: publicConfig(config),
  });
});

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('info', 'shutdown.begin', { service: 'api-gateway', signal });

  const forceExit = setTimeout(() => {
    log('error', 'shutdown.timeout', { service: 'api-gateway' });
    server.closeAllConnections();
    process.exit(1);
  }, config.SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(async (error) => {
    clearTimeout(forceExit);
    if (redis) await redis.quit().catch(() => redis.disconnect());
    if (error) {
      log('error', 'shutdown.failed', { service: 'api-gateway', error: error.message });
      process.exitCode = 1;
      return;
    }
    log('info', 'shutdown.complete', { service: 'api-gateway' });
  });
  server.closeIdleConnections();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
