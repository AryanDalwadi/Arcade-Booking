import { createServer } from 'node:http';
import { Redis } from 'ioredis';
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
  redis.on('error', (error) => console.error('[gateway:redis]', error.message));
}
const rateLimitStore = redis ? new RedisRateLimitStore(redis) : new MemoryRateLimitStore();
const server = createServer(createApp(config, rateLimitStore));

server.listen(config.PORT, () => {
  console.log(`API gateway listening on http://localhost:${config.PORT}`);
});

let shuttingDown = false;
function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; draining connections`);

  const forceExit = setTimeout(() => {
    console.error('Graceful shutdown timed out');
    server.closeAllConnections();
    process.exit(1);
  }, config.SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(async (error) => {
    clearTimeout(forceExit);
    if (redis) await redis.quit().catch(() => redis.disconnect());
    if (error) {
      console.error('Shutdown failed', error);
      process.exitCode = 1;
    }
  });
  server.closeIdleConnections();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
