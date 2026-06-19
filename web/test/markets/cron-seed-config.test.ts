import { describe, expect, it } from 'vitest';

import { AUTOMATED_MARKET_SEED_USDC } from '../../lib/markets/scheduler/seed-config';

describe('markets cron seed config', () => {
  it('seeds every automated market with 1 USDC', () => {
    expect(AUTOMATED_MARKET_SEED_USDC).toBe(1_000_000n);
  });
});
