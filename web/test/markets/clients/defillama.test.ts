import { describe, it, expect, vi } from 'vitest';
import { createDefiLlamaClient } from '../../../lib/markets/clients/defillama';

const mockFetch = (payload: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload });

describe('defillama client', () => {
  it('getChainTvl returns current TVL in USD', async () => {
    const fetch = mockFetch([
      { name: 'Ethereum', tvl: 123_456_789_000 },
      { name: 'Arbitrum', tvl: 5_000_000_000 },
    ]);
    const c = createDefiLlamaClient({ fetch: fetch as typeof globalThis.fetch });
    expect(await c.getChainTvl('Ethereum')).toBe(123_456_789_000);
    expect(await c.getChainTvl('Unknown')).toBeNull();
  });

  it('getProtocolTvlSeries returns time series', async () => {
    const fetch = mockFetch({
      tvl: [
        { date: 1_700_000_000, totalLiquidityUSD: 100 },
        { date: 1_700_086_400, totalLiquidityUSD: 110 },
      ],
    });
    const c = createDefiLlamaClient({ fetch: fetch as typeof globalThis.fetch });
    const series = await c.getProtocolTvlSeries('aave-v3');
    expect(series).toHaveLength(2);
    expect(series[1].tvl).toBe(110);
  });
});
