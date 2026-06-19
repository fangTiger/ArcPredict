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
  const { walletClient, publicClient, eventMarketAddress, oracleAddress, usdcAddress } = opts;

  async function waitForReceipt(hash: `0x${string}`): Promise<`0x${string}`> {
    if (publicClient) {
      await publicClient.waitForTransactionReceipt({ hash });
    }
    return hash;
  }

  return {
    async openMarket(args: OpenMarketArgs): Promise<`0x${string}`> {
      const hash = await walletClient.writeContract({
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
      return waitForReceipt(hash);
    },

    async proposeOutcome(eventId: `0x${string}`, outcomeIndex: number): Promise<`0x${string}`> {
      const hash = await walletClient.writeContract({
        address: oracleAddress,
        abi: adminOracleAbi,
        functionName: 'proposeResult',
        args: [eventId, outcomeIndex],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
      return waitForReceipt(hash);
    },

    async finalizeOutcome(eventId: `0x${string}`): Promise<`0x${string}`> {
      const hash = await walletClient.writeContract({
        address: oracleAddress,
        abi: adminOracleAbi,
        functionName: 'finalizeResult',
        args: [eventId],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
      return waitForReceipt(hash);
    },

    /** EventMarket.resolve 任何人可调，cron 顺手把 finalized 的 oracle 结果落到 market 上。 */
    async settleMarket(marketId: bigint): Promise<`0x${string}`> {
      const hash = await walletClient.writeContract({
        address: eventMarketAddress,
        abi: eventMarketAbi,
        functionName: 'resolve',
        args: [marketId],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
      return waitForReceipt(hash);
    },

    /** seed-liquidity 负责计算每个市场的引导金额；这里仅执行 approve。 */
    async approveUsdc(amount: bigint): Promise<`0x${string}`> {
      const hash = await walletClient.writeContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [eventMarketAddress, amount],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
      return waitForReceipt(hash);
    },
  };
}
