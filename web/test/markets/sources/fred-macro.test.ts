import { describe, it, expect, vi } from 'vitest';
import { createFredMacroSource } from '../../../lib/markets/sources/fred-macro';
import type { OnChainMarket } from '../../../lib/markets/sources/base';

const mockFredClient = (override: any = {}) => ({
  getLatestObservation: vi.fn().mockImplementation(async (id: string) => {
    return override.latest?.[id] ?? null;
  }),
  getObservationByDate: vi.fn().mockImplementation(async (id: string, d: string) => {
    return override.byDate?.[`${id}:${d}`] ?? null;
  }),
});

const NOW = new Date('2026-06-18T00:00:00Z');

describe('fred-macro source', () => {
  it('id and category', () => {
    const s = createFredMacroSource({ fredClient: mockFredClient() as any });
    expect(s.id).toBe('fred-macro');
    expect(s.category).toBe('macro');
  });

  it('fetchUpcoming returns 3 series x upcoming release', async () => {
    const s = createFredMacroSource({ fredClient: mockFredClient() as any });
    const drafts = await s.fetchUpcoming(NOW);
    expect(drafts.length).toBeGreaterThanOrEqual(3);
    expect(drafts.length).toBeLessThanOrEqual(12);
    expect(new Set(drafts.map((d) => d.category))).toEqual(new Set(['macro']));
    drafts.forEach((d) => expect(d.outcomes.length).toBeGreaterThanOrEqual(2));
  });

  it('resolve returns still-open when observation missing', async () => {
    const fred = mockFredClient({ latest: {} });
    const s = createFredMacroSource({ fredClient: fred as any });
    const market: OnChainMarket = {
      marketId: 0n,
      eventId: `0x${'00'.repeat(32)}` as `0x${string}`,
      sourceId: 'fred-macro',
      externalKey: 'CPIAUCSL:2026-07-15',
      question: 'Q',
      outcomeCount: 3,
      betDeadline: 0,
      resolveAfter: 0,
      isSettled: false,
      oracleStatus: 'pending',
    };
    const r = await s.resolve(market, NOW);
    expect(r.kind).toBe('still-open');
  });

  it('resolve returns settled when CPI value < 2.5% maps to outcome 0', async () => {
    const fred = mockFredClient({
      byDate: { 'CPIAUCSL:2026-07-15': { date: '2026-07-15', value: 2.1 } },
    });
    const s = createFredMacroSource({ fredClient: fred as any });
    const market: OnChainMarket = {
      marketId: 0n,
      eventId: `0x${'00'.repeat(32)}` as `0x${string}`,
      sourceId: 'fred-macro',
      externalKey: 'CPIAUCSL:2026-07-15',
      question: 'Q',
      outcomeCount: 3,
      betDeadline: 0,
      resolveAfter: 0,
      isSettled: false,
      oracleStatus: 'pending',
    };
    const r = await s.resolve(market, NOW);
    expect(r.kind).toBe('settled');
    if (r.kind === 'settled') {
      expect(r.settledOutcomeIndex).toBe(0);
    }
  });
});
