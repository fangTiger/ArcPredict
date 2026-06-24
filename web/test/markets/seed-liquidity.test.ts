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
    publicClient: {
      readContract: vi.fn().mockResolvedValue(2_000_000n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue(undefined),
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
    const { writer, walletClient, publicClient, calls } = fakeWriter();
    const seed = createSeedLiquidity({
      writer: writer as never,
      walletClient: walletClient as never,
      publicClient: publicClient as never,
      eventMarketAddress: '0xaa',
      usdcAddress: '0xbb',
      perMarketUsdc: 1_000_000n,
    });
    const result = await seed.seed(123n, 3);
    expect(calls[0]).toEqual({ kind: 'approve', n: 1_000_000n });
    expect(calls.slice(1).every((c) => c.kind === 'bet')).toBe(true);
    expect(calls.slice(1)).toHaveLength(3);
    const amounts = calls.slice(1).map((c) => (c as { kind: 'bet'; args: readonly [bigint, number, bigint] }).args[2]);
    expect(new Set(amounts)).toEqual(new Set([333_333n]));
    expect(result).toMatchObject({
      status: 'seeded',
      approveTxHash: `0x${'1'.repeat(64)}`,
      betTxHashes: [`0x${'2'.repeat(64)}`, `0x${'2'.repeat(64)}`, `0x${'2'.repeat(64)}`],
    });
  });

  it('returns needs_funding when the automation wallet balance is below the seed budget', async () => {
    const { writer, walletClient, publicClient, calls } = fakeWriter();
    publicClient.readContract.mockResolvedValueOnce(250_000n);

    const seed = createSeedLiquidity({
      writer: writer as never,
      walletClient: walletClient as never,
      publicClient: publicClient as never,
      eventMarketAddress: '0xaa',
      usdcAddress: '0xbb',
      perMarketUsdc: 1_000_000n,
    });

    await expect(seed.seed(123n, 2)).resolves.toMatchObject({
      status: 'needs_funding',
      error: expect.stringContaining('needs funding'),
    });
    expect(calls).toEqual([]);
  });

  it('returns a redacted seed_failed result when chain calls throw a secret-bearing error', async () => {
    const { writer, walletClient, publicClient } = fakeWriter();
    writer.approveUsdc.mockRejectedValueOnce(
      new Error(
        'AUTOMATION_PRIVATE_KEY=0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd sk-live-secret Bearer token-123',
      ),
    );

    const seed = createSeedLiquidity({
      writer: writer as never,
      walletClient: walletClient as never,
      publicClient: publicClient as never,
      eventMarketAddress: '0xaa',
      usdcAddress: '0xbb',
      perMarketUsdc: 1_000_000n,
    });

    const result = await seed.seed(123n, 2);
    expect(result.status).toBe('seed_failed');
    expect(result.error).not.toContain('AUTOMATION_PRIVATE_KEY');
    expect(result.error).not.toContain('sk-live-secret');
    expect(result.error).not.toContain('Bearer token-123');
  });
});
