import type { Server } from 'node:http';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelRank: Record<LogLevel, number> = { debug: 20, info: 30, warn: 40, error: 50 };
const secretKey = /secret|password|token|authorization/i;

function minLevel(): number {
  const configured = process.env.LOG_LEVEL;
  if (configured === 'debug' || configured === 'info' || configured === 'warn' || configured === 'error') {
    return levelRank[configured];
  }
  return levelRank.info;
}

export function log(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
  if (levelRank[level] < minLevel()) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) url.password = '***';
    if (url.username) url.username = '***';
    return url.toString();
  } catch {
    return '[redacted]';
  }
}

/** Safe view of process config for stdout. Never prints passwords or JWT secrets. */
export function publicConfig(config: Record<string, unknown>): Record<string, unknown> {
  const visible: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined || typeof value === 'function') continue;
    if (secretKey.test(key)) {
      visible[key] = '[redacted]';
      continue;
    }
    if (typeof value === 'string' && /^[a-z]+:\/\//i.test(value)) {
      visible[key] = redactUrl(value);
      continue;
    }
    visible[key] = value;
  }
  return visible;
}

export function requireProductionEnv(source: NodeJS.ProcessEnv, keys: string[]): void {
  if ((source.NODE_ENV ?? 'development') !== 'production') return;
  const missing = keys.filter((key) => !source[key] || source[key]!.trim() === '');
  if (missing.length > 0) {
    throw new Error(`Invalid production environment: missing ${missing.join(', ')}`);
  }
}

export function installShutdown(
  server: Server,
  options: {
    service: string;
    stopAccepting: () => void;
    closeResources: () => Promise<void>;
    timeoutMs?: number;
  },
): void {
  let stopping = false;
  const shutdown = (signal: string) => {
    if (stopping) return;
    stopping = true;
    log('info', 'shutdown.begin', { service: options.service, signal });
    options.stopAccepting();
    if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
    server.close((error) => {
      void options.closeResources().finally(() => {
        if (error) {
          log('error', 'shutdown.failed', { service: options.service, error: error.message });
          process.exit(1);
        }
        log('info', 'shutdown.complete', { service: options.service });
        process.exit(0);
      });
    });
    setTimeout(() => {
      log('error', 'shutdown.timeout', { service: options.service });
      process.exit(1);
    }, options.timeoutMs ?? 10_000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}
