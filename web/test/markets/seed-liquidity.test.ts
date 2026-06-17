import { describe, it, expect, vi } from 'vitest';
import { createSeedLiquidity } from '../../lib/markets/scheduler/seed-liquidity';

type Call =
  | { kind: 'approve'; n: bigint }
  | { kind: 'bet'; args: readonly [bigint, number, bigint] };

const fakeWriter = () => {
  const calls: Call[] = [];
  return {
    calls,
    writer: {
      approveUsdc: vi.fn().mockImplementation(async (n: bigint) => {
        calls.push({ kind: 'approve', n });
        return `0x${'1'.repeat(64)}`;
      }),
    },
    walletClient: {
      writeContract: vi.fn().mockImplementation(async (a: { args: readonly [bigint, number, bigint] }) => {
        calls.push({ kind: 'bet', args: a.args });
        return `0x${'2'.repeat(64)}`;
      }),
      account: { address: `0x${'aa'.repeat(20)}` },
      chain: null,
    },
  };
};

describe('seed-liquidity', () => {
  it('approves and bets equal amount on each outcome', async () => {
    const { writer, walletClient, calls } = fakeWriter();
    const seed = createSeedLiquidity({
      writer: writer as never,
      walletClient: walletClient as never,
      eventMarketAddress: '0xaa',
      perMarketUsdc: 10_000_000n,
    });
    await seed.seed(123n, 3);
    expect(calls[0]).toEqual({ kind: 'approve', n: 10_000_000n });
    expect(calls.slice(1).every((c) => c.kind === 'bet')).toBe(true);
    expect(calls.slice(1)).toHaveLength(3);
    const amounts = calls.slice(1).map((c) => (c as { kind: 'bet'; args: readonly [bigint, number, bigint] }).args[2]);
    expect(new Set(amounts)).toEqual(new Set([3_333_333n]));
  });
});
