import { describe, it, expect, vi } from 'vitest';
import { createChainReader } from '../../lib/markets/scheduler/chain-reader';
import { ORACLE_STATUS } from '../../lib/markets/scheduler/abi';

const fakePublicClient = (overrides: Record<string, unknown>) => ({
  getContractEvents: vi.fn().mockResolvedValue(overrides.events ?? []),
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
});
