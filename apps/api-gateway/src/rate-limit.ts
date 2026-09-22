import type { NextFunction, Request, Response } from 'express';
import type { Redis } from 'ioredis';

export type RateLimitResult = { count: number; resetAt: number };

export interface RateLimitStore {
  increment(key: string, windowMs: number, now?: number): Promise<RateLimitResult>;
}

type Entry = { count: number; resetAt: number };

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, Entry>();

  async increment(key: string, windowMs: number, now = Date.now()): Promise<RateLimitResult> {
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.entries.set(key, fresh);
      return fresh;
    }
    current.count += 1;
    return current;
  }
}

const incrementScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'arcade:gateway:rate-limit',
  ) {}

  async increment(key: string, windowMs: number, now = Date.now()): Promise<RateLimitResult> {
    const result = await this.redis.eval(
      incrementScript,
      1,
      `${this.prefix}:${key}`,
      windowMs,
    ) as [number, number];
    const [count, ttl] = result;
    return {
      count: Number(count),
      resetAt: now + Math.max(0, Number(ttl)),
    };
  }
}

export function rateLimit(options: { store: RateLimitStore; windowMs: number; max: number }) {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      const key = request.ip || request.socket.remoteAddress || 'unknown';
      const result = await options.store.increment(key, options.windowMs);
      response.setHeader('RateLimit-Limit', options.max);
      response.setHeader('RateLimit-Remaining', Math.max(0, options.max - result.count));
      response.setHeader('RateLimit-Reset', Math.ceil(result.resetAt / 1000));
      if (result.count > options.max) {
        response.setHeader('Retry-After', Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)));
        response.status(429).json({ success: false, message: 'Too many requests', code: 'RATE_LIMITED' });
        return;
      }
      next();
    } catch (error) {
      // Fail-open: a Redis outage must not take the arcade API down.
      // Abuse protection degrades until Redis recovers.
      console.error('[gateway:rate-limit]', error instanceof Error ? error.message : error);
      next();
    }
  };
}
