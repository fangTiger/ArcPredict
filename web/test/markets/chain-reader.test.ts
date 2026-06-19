import { describe, it, expect, vi } from 'vitest';
import { createChainReader } from '../../lib/markets/scheduler/chain-reader';
import { ORACLE_STATUS } from '../../lib/markets/scheduler/abi';

const fakePublicClient = (overrides: Record<string, unknown>) => ({
  getBlockNumber: vi.fn().mockResolvedValue(overrides.blockNumber ?? 1_000n),
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

  it('paginates event scans to stay within Arc RPC eth_getLogs range limits', async () => {
    const eventId = `0x${'34'.repeat(32)}` as const;
    const client = {
      getBlockNumber: vi.fn().mockResolvedValue(20_250n),
      getContractEvents: vi.fn().mockImplementation(async ({ fromBlock }: { fromBlock: bigint }) => (
        fromBlock === 20_100n ? [{ args: { id: 77n, eventId } }] : []
      )),
      readContract: vi.fn(),
    };
    const r = createChainReader({
      client: client as never,
      eventMarketAddress: '0xaa',
      oracleAddress: '0xbb',
      fromBlock: 100n,
    });

    await expect(r.marketIdForEventId(eventId)).resolves.toBe(77n);
    expect(client.getContractEvents).toHaveBeenCalledTimes(3);
    expect(client.getContractEvents).toHaveBeenNthCalledWith(1, expect.objectContaining({
      fromBlock: 100n,
      toBlock: 10_099n,
    }));
    expect(client.getContractEvents).toHaveBeenNthCalledWith(2, expect.objectContaining({
      fromBlock: 10_100n,
      toBlock: 20_099n,
    }));
    expect(client.getContractEvents).toHaveBeenNthCalledWith(3, expect.objectContaining({
      fromBlock: 20_100n,
      toBlock: 20_250n,
    }));
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

  it('marketHasLiquidity detects any non-zero outcome pool', async () => {
    const market = [
      `0x${'12'.repeat(32)}`,
      3,
      1000n,
      2000n,
      [0n, 333_333n, 0n],
      0n,
      0n,
      100,
      `0x${'ab'.repeat(20)}`,
      255,
      0n,
      'Q',
    ] as const;
    const client = fakePublicClient({ market });
    const r = createChainReader({
      client: client as never,
      eventMarketAddress: '0xaa',
      oracleAddress: '0xbb',
    });

    await expect(r.marketHasLiquidity(42n)).resolves.toBe(true);
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
