import { describe, it, expect, vi } from 'vitest';
import { createChainReader } from '../../lib/markets/scheduler/chain-reader';
import { ORACLE_STATUS } from '../../lib/markets/scheduler/abi';

const fakePublicClient = (overrides: Record<string, unknown>) => ({
  getContractEvents: vi.fn().mockImplementation(async ({ eventName }: { eventName: string }) => {
    if (eventName === 'ResultProposed') return overrides.proposedEvents ?? [];
    return overrides.events ?? [];
  }),
  readContract: vi.fn().mockImplementation(async ({ functionName }: { functionName: string }) => {
    if (functionName === 'getEventStatus') return overrides.status ?? ORACLE_STATUS.Pending;
    if (functionName === 'markets') return overrides.market ?? null;
    throw new Error(`unexpected readContract: ${functionName}`);
  }),
});

describe('chain-reader', () => {
  it('marketIdForEventId returns null when no MarketCreated event', async () => {
    const client = fakePublicClient({ events: [] });
    const r = createChainReader({
      client: client as never,
      eventMarketAddress: '0xaa',
      oracleAddress: '0xbb',
    });
    expect(await r.marketIdForEventId(`0x${'00'.repeat(32)}`)).toBeNull();
  });

  it('marketIdForEventId returns id from MarketCreated event', async () => {
    const client = fakePublicClient({
      events: [{ args: { id: 42n, eventId: '0xee' } }],
    });
    const r = createChainReader({
      client: client as never,
      eventMarketAddress: '0xaa',
      oracleAddress: '0xbb',
    });
    expect(await r.marketIdForEventId('0xee')).toBe(42n);
  });

  it('oracleStatus returns mapped enum string', async () => {
    const client = fakePublicClient({ status: ORACLE_STATUS.Proposed });
    const r = createChainReader({
      client: client as never,
      eventMarketAddress: '0xaa',
      oracleAddress: '0xbb',
    });
    expect(await r.oracleStatus('0xee')).toBe('proposed');
  });

  it('pendingMarketsForSource reads unresolved markets and proposedAt from ResultProposed events', async () => {
    const eventId = `0x${'12'.repeat(32)}` as const;
    const market = [
      eventId,
      3,
      1000n,
      2000n,
      [0n, 0n, 0n],
      0n,
      0n,
      100,
      `0x${'ab'.repeat(20)}`,
      255,
      0n,
      'Q',
    ] as const;
    const client = fakePublicClient({
      events: [{ args: { id: 42n, eventId } }],
      market,
      status: ORACLE_STATUS.Proposed,
      proposedEvents: [{ args: { eventId, proposedAt: 1234n } }],
    });
    const r = createChainReader({
      client: client as never,
      eventMarketAddress: '0xaa',
      oracleAddress: '0xbb',
    });

    await expect(r.pendingMarketsForSource('fred-macro', [eventId])).resolves.toEqual([
      {
        marketId: 42n,
        eventId,
        resolveAfter: 2000,
        oracleStatus: 'proposed',
        proposedAt: 1234,
        settled: false,
      },
    ]);
    expect(client.readContract).toHaveBeenCalledWith(expect.objectContaining({
      functionName: 'markets',
      args: [42n],
    }));
    expect(client.getContractEvents).toHaveBeenCalledWith(expect.objectContaining({
      eventName: 'ResultProposed',
      args: { eventId },
    }));
  });
});
