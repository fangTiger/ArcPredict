import { describe, it, expect, vi } from 'vitest';
import { buildChainLensContext } from '../../../lib/lens/contextBuilders/chain';

const fakeDefiLlama = {
  getChainTvl: vi.fn().mockResolvedValue(120_000_000_000),
  getProtocolTvlSeries: vi.fn().mockResolvedValue([]),
};

describe('chain lens contextBuilder', () => {
  it('parses TVL externalKey and includes current TVL', async () => {
    const ctx = await buildChainLensContext({
      defiLlama: fakeDefiLlama as any,
      market: {
        eventId: '0x00' as any,
        question: 'Will Ethereum TVL be >= $X by 2026-09-30?',
        externalKey: 'eth:tvl:gte:150000000000:2026-09-30',
        outcomes: [
          { id: 'yes', label: 'Yes' },
          { id: 'no', label: 'No' },
        ],
      },
    });
    expect(ctx.chainId).toBe('eth');
    expect(ctx.currentTvl).toBe(120_000_000_000);
    expect(ctx.thresholdTvl).toBe(150_000_000_000);
    expect(ctx.gapToThresholdRatio).toBeCloseTo(0.8, 2);
  });
});
