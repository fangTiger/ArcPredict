import { describe, it, expect, vi } from 'vitest';
import { createChainWriter } from '../../lib/markets/scheduler/chain-writer';
import { computeMarketId } from '../../lib/markets/external-key';

const fakeWalletClient = () => {
  const writes: unknown[] = [];
  return {
    writes,
    client: {
      writeContract: vi.fn().mockImplementation(async (args) => {
        writes.push(args);
        return `0x${'1'.repeat(64)}`;
      }),
      account: { address: `0x${'aa'.repeat(20)}` },
      chain: null,
    },
  };
};

describe('chain-writer', () => {
  it('openMarket calls EventMarket.createMarket with eventId from externalKey', async () => {
    const { client, writes } = fakeWalletClient();
    const w = createChainWriter({
      walletClient: client as never,
      eventMarketAddress: '0xaa',
      oracleAddress: '0xbb',
      usdcAddress: '0xcc',
    });
    const eventId = computeMarketId('fred-macro', 'k');
    await w.openMarket({
      eventId,
      question: 'Q',
      outcomeCount: 3,
      betDeadline: 1000,
      resolveAfter: 2000,
    });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      functionName: 'createMarket',
      args: [eventId, 3, 1000n, 2000n, 'Q'],
    });
  });

  it('proposeOutcome calls oracle.proposeResult', async () => {
    const { client, writes } = fakeWalletClient();
    const w = createChainWriter({
      walletClient: client as never,
      eventMarketAddress: '0xaa',
      oracleAddress: '0xbb',
      usdcAddress: '0xcc',
    });
    await w.proposeOutcome('0xee', 1);
    expect(writes[0]).toMatchObject({
      functionName: 'proposeResult',
      args: ['0xee', 1],
    });
  });

  it('finalizeOutcome calls oracle.finalizeResult', async () => {
    const { client, writes } = fakeWalletClient();
    const w = createChainWriter({
      walletClient: client as never,
      eventMarketAddress: '0xaa',
      oracleAddress: '0xbb',
      usdcAddress: '0xcc',
    });
    await w.finalizeOutcome('0xee');
    expect(writes[0]).toMatchObject({ functionName: 'finalizeResult' });
  });
});
