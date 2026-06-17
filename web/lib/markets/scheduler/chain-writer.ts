import type { PublicClient, WalletClient } from 'viem';
import { eventMarketAbi, adminOracleAbi, erc20Abi } from './abi';

export interface OpenMarketArgs {
  eventId: `0x${string}`;
  question: string;
  outcomeCount: number;
  betDeadline: number;
  resolveAfter: number;
}

export interface ChainWriterOptions {
  walletClient: WalletClient;
  publicClient?: PublicClient;
  eventMarketAddress: `0x${string}`;
  oracleAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
}

export function createChainWriter(opts: ChainWriterOptions) {
  const { walletClient, eventMarketAddress, oracleAddress, usdcAddress } = opts;

  return {
    async openMarket(args: OpenMarketArgs): Promise<`0x${string}`> {
      return walletClient.writeContract({
        address: eventMarketAddress,
        abi: eventMarketAbi,
        functionName: 'createMarket',
        args: [
          args.eventId,
          args.outcomeCount,
          BigInt(args.betDeadline),
          BigInt(args.resolveAfter),
          args.question,
        ],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
    },

    async proposeOutcome(eventId: `0x${string}`, outcomeIndex: number): Promise<`0x${string}`> {
      return walletClient.writeContract({
        address: oracleAddress,
        abi: adminOracleAbi,
        functionName: 'proposeResult',
        args: [eventId, outcomeIndex],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
    },

    async finalizeOutcome(eventId: `0x${string}`): Promise<`0x${string}`> {
      return walletClient.writeContract({
        address: oracleAddress,
        abi: adminOracleAbi,
        functionName: 'finalizeResult',
        args: [eventId],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
    },

    /** EventMarket.resolve 任何人可调，cron 顺手把 finalized 的 oracle 结果落到 market 上。 */
    async settleMarket(marketId: bigint): Promise<`0x${string}`> {
      return walletClient.writeContract({
        address: eventMarketAddress,
        abi: eventMarketAbi,
        functionName: 'resolve',
        args: [marketId],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
    },

    /**
     * Phase 1：固定 10 USDC，按 outcome 均分 approve。
     * 实际下注由 seed-liquidity 单独负责。
     */
    async approveUsdc(amount: bigint): Promise<`0x${string}`> {
      return walletClient.writeContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [eventMarketAddress, amount],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
    },
  };
}
