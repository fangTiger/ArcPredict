import { describe, it, expect } from 'vitest';
import { computeMarketId } from '../../lib/markets/external-key';

describe('computeMarketId', () => {
  it('produces deterministic 32-byte hash', () => {
    const id1 = computeMarketId('fred-macro', 'CPIAUCSL:2026-07-15');
    const id2 = computeMarketId('fred-macro', 'CPIAUCSL:2026-07-15');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('produces different ids for different sources', () => {
    const a = computeMarketId('fred-macro', 'X');
    const b = computeMarketId('chain-event', 'X');
    expect(a).not.toBe(b);
  });

  it('produces different ids for different externalKeys', () => {
    const a = computeMarketId('fred-macro', 'A');
    const b = computeMarketId('fred-macro', 'B');
    expect(a).not.toBe(b);
  });
});
