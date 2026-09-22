import { afterEach, describe, expect, it, vi } from 'vitest';
import { log, publicConfig, redactUrl, requireProductionEnv } from '../src/index';

describe('twelve-factor observability', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LOG_LEVEL;
  });

  it('redacts userinfo in backing-service URLs', () => {
    expect(redactUrl('postgres://booking_app:booking_local@postgres:5432/booking'))
      .toBe('postgres://***:***@postgres:5432/booking');
  });

  it('never prints JWT secrets or database passwords in public config', () => {
    const visible = publicConfig({
      PORT: 4103,
      JWT_SECRET: 'super-secret-value',
      DATABASE_URL: 'postgres://booking_app:booking_local@postgres:5432/booking',
      LOG_LEVEL: 'info',
    });
    expect(visible.JWT_SECRET).toBe('[redacted]');
    expect(visible.DATABASE_URL).toBe('postgres://***:***@postgres:5432/booking');
    expect(JSON.stringify(visible)).not.toContain('booking_local');
    expect(JSON.stringify(visible)).not.toContain('super-secret-value');
  });

  it('requires backing-service URLs in production only', () => {
    expect(() => requireProductionEnv({}, ['DATABASE_URL'])).not.toThrow();
    expect(() => requireProductionEnv({ NODE_ENV: 'production' }, ['DATABASE_URL'])).toThrow(/DATABASE_URL/);
    expect(() => requireProductionEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://booking_app:secret@postgres:5432/booking',
    }, ['DATABASE_URL'])).not.toThrow();
  });

  it('writes one JSON object per log line', () => {
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    log('info', 'service.listen', { service: 'booking', port: 4103 });
    expect(stdout).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(stdout.mock.calls[0]?.[0]));
    expect(payload).toMatchObject({ level: 'info', message: 'service.listen', service: 'booking', port: 4103 });
    expect(payload.ts).toEqual(expect.any(String));
  });
});
