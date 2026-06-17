import type { WalletClient } from 'viem';
import { eventMarketAbi } from './abi';

interface ChainWriterLike {
  approveUsdc(amount: bigint): Promise<`0x${string}`>;
}

export interface SeedLiquidityOptions {
  writer: ChainWriterLike;
  walletClient: WalletClient;
  eventMarketAddress: `0x${string}`;
  perMarketUsdc: bigint;
}

export function createSeedLiquidity(opts: SeedLiquidityOptions) {
  const { writer, walletClient, eventMarketAddress, perMarketUsdc } = opts;

  return {
    async seed(marketId: bigint, outcomeCount: number): Promise<void> {
      await writer.approveUsdc(perMarketUsdc);
      const perOutcome = perMarketUsdc / BigInt(outcomeCount);
      for (let i = 0; i < outcomeCount; i++) {
        await walletClient.writeContract({
          address: eventMarketAddress,
          abi: eventMarketAbi,
          functionName: 'bet',
          args: [marketId, i, perOutcome],
          chain: walletClient.chain ?? null,
          account: walletClient.account!,
        });
      }
    },
  };
}
