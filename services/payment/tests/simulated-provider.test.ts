import { describe, expect, it } from 'vitest';
import { SimulatedPaymentProvider } from '../src/application/context';

describe('SimulatedPaymentProvider', () => {
  const provider = new SimulatedPaymentProvider();

  it('uses explicit deterministic outcome controls', () => {
    expect(provider.charge('SUCCEED').succeeded).toBe(true);
    expect(provider.charge('FAIL').succeeded).toBe(false);
  });

  it('labels references as simulated', () => {
    expect(provider.charge('SUCCEED').reference).toMatch(/^sim_/);
  });
});
