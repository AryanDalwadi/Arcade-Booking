import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';

describe('catalog environment', () => {
  it('provides safe local defaults', () => {
    const parsed = parseEnv({});
    expect(parsed.PORT).toBe(4002);
    expect(parsed.DATABASE_URL).toContain('arcade_catalog');
  });
});

