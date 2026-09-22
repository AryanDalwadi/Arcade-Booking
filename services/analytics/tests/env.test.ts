import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';

describe('analytics environment', () => {
  it('provides safe local defaults', () => {
    const parsed = parseEnv({});
    expect(parsed.PORT).toBe(4007);
    expect(parsed.DATABASE_URL).toContain('arcade_analytics');
  });
});

