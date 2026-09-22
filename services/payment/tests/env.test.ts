import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';

describe('payment environment', () => {
  it('provides safe local defaults', () => {
    const parsed = parseEnv({});
    expect(parsed.PORT).toBe(4004);
    expect(parsed.DATABASE_URL).toContain('arcade_payment');
  });
});

