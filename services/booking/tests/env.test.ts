import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';

describe('booking environment', () => {
  it('provides safe local defaults', () => {
    const parsed = parseEnv({});
    expect(parsed.PORT).toBe(4003);
    expect(parsed.DATABASE_URL).toContain('arcade_booking');
  });

  it('requires backing-service URLs in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
    const parsed = parseEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://booking_app:secret@postgres:5432/booking',
      REDIS_URL: 'redis://redis:6379',
      KAFKA_BROKERS: 'kafka:9092',
    });
    expect(parsed.PORT).toBe(4003);
  });
});

