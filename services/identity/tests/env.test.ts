import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';

describe('identity environment', () => {
  it('provides safe local defaults', () => {
    const parsed = parseEnv({});
    expect(parsed.PORT).toBe(4001);
    expect(parsed.DATABASE_URL).toContain('arcade_identity');
    expect(parsed.JWT_ISSUER).toBe('arcade-identity');
    expect(parsed.JWT_AUDIENCE).toBe('arcade-web');
    expect(parsed.BOOTSTRAP_ADMIN_EMAIL).toBeUndefined();
  });

  it('accepts a bootstrap admin email', () => {
    const parsed = parseEnv({ BOOTSTRAP_ADMIN_EMAIL: 'milestone-ui-2259@example.com' });
    expect(parsed.BOOTSTRAP_ADMIN_EMAIL).toBe('milestone-ui-2259@example.com');
  });

  it('rejects the development JWT secret in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow();
  });
});

