import { describe, it, expect, vi } from 'vitest';
import { createChainEventSource } from '../../../lib/markets/sources/chain-event';
import type { OnChainMarket } from '../../../lib/markets/sources/base';

const mockDefiLlama = (override: any = {}) => ({
  getChainTvl: vi.fn().mockImplementation(async (chainName: string) => {
    return override.chainTvl?.[chainName] ?? override.chainTvl ?? 100_000_000_000;
  }),
  getProtocolTvlSeries: vi.fn().mockResolvedValue(override.series ?? []),
});

const NOW = new Date('2026-06-18T00:00:00Z');

describe('chain-event source', () => {
  it('id and category', () => {
    const s = createChainEventSource({ defiLlama: mockDefiLlama() as any });
    expect(s.id).toBe('chain-event');
    expect(s.category).toBe('chain');
  });

  it('fetchUpcoming returns TVL threshold drafts for ETH and Arbitrum', async () => {
    const llama = mockDefiLlama({
      chainTvl: {
        Ethereum: 200_000_000_000,
        Arbitrum: 10_000_000_000,
      },
    });
    const s = createChainEventSource({ defiLlama: llama as any });
    const drafts = await s.fetchUpcoming(NOW);
    const tvlDrafts = drafts.filter((d) => d.externalKey.includes(':tvl:gte:'));

    expect(tvlDrafts.filter((d) => d.externalKey.startsWith('eth:tvl:'))).toHaveLength(3);
    expect(tvlDrafts.filter((d) => d.externalKey.startsWith('arb:tvl:'))).toHaveLength(3);
    tvlDrafts.forEach((d) => {
      expect(d.category).toBe('chain');
      expect(d.outcomes.map((o) => o.id)).toEqual(['yes', 'no']);
    });
  });

  it('tags drafts with the active weekly chain themeId', async () => {
    const llama = mockDefiLlama({
      chainTvl: {
        Ethereum: 200_000_000_000,
        Arbitrum: 10_000_000_000,
      },
    });
    const s = createChainEventSource({ defiLlama: llama as any });
    const drafts = await s.fetchUpcoming(new Date('2026-06-24T00:00:00Z'));
    const taggedDrafts = drafts.filter((draft) => draft.themeId === 'arc-summer-onchain');

    expect(drafts.length).toBeGreaterThan(0);
    expect(taggedDrafts.map((draft) => draft.externalKey)).toEqual(drafts.map((draft) => draft.externalKey));
  });

  it('does not tag chain TVL drafts outside the active theme deadline week', async () => {
    const llama = mockDefiLlama({
      chainTvl: {
        Ethereum: 200_000_000_000,
        Arbitrum: 10_000_000_000,
      },
    });
    const s = createChainEventSource({ defiLlama: llama as any });
    const drafts = await s.fetchUpcoming(new Date('2026-06-30T00:00:00Z'));

    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every((draft) => draft.themeId == null)).toBe(true);
  });

  it('TVL resolve: still-open when current TVL between threshold and deadline not reached', async () => {
    const llama = mockDefiLlama({ chainTvl: 150_000_000_000 });
    const s = createChainEventSource({ defiLlama: llama as any });
    const m: OnChainMarket = {
      marketId: 0n,
      eventId: `0x${'00'.repeat(32)}` as `0x${string}`,
      sourceId: 'chain-event',
      externalKey: 'eth:tvl:gte:200000000000:2026-09-30',
      question: 'Q',
      outcomeCount: 2,
      betDeadline: 0,
      resolveAfter: Math.floor(Date.parse('2026-09-30T00:00:00Z') / 1000),
      isSettled: false,
      oracleStatus: 'pending',
    };
    const r = await s.resolve(m, NOW);
    expect(r.kind).toBe('still-open');
  });

  it('TVL resolve: settled YES when deadline passed and TVL >= threshold', async () => {
    const llama = mockDefiLlama({ chainTvl: 250_000_000_000 });
    const s = createChainEventSource({ defiLlama: llama as any });
    const m: OnChainMarket = {
      marketId: 0n,
      eventId: `0x${'00'.repeat(32)}` as `0x${string}`,
      sourceId: 'chain-event',
      externalKey: 'eth:tvl:gte:200000000000:2026-06-01',
      question: 'Q',
      outcomeCount: 2,
      betDeadline: 0,
      resolveAfter: Math.floor(Date.parse('2026-06-01T00:00:00Z') / 1000),
      isSettled: false,
      oracleStatus: 'pending',
    };
    const r = await s.resolve(m, NOW);
    expect(r.kind).toBe('settled');
    if (r.kind === 'settled') {
      expect(r.settledOutcomeIndex).toBe(0);
    }
  });
});
