import type { PublicClient, WalletClient } from 'viem';
import { eventMarketAbi } from './abi';
import { isFundingError, safeErrorMessage } from './safe-report';
import type { SeedLiquidityResult } from './types';

interface ChainWriterLike {
  approveUsdc(amount: bigint): Promise<`0x${string}`>;
  balanceUsdc?(account: `0x${string}`): Promise<bigint | null>;
}

export interface SeedLiquidityOptions {
  writer: ChainWriterLike;
  walletClient: WalletClient;
  publicClient?: PublicClient;
  eventMarketAddress: `0x${string}`;
  usdcAddress?: `0x${string}`;
  perMarketUsdc: bigint;
}

export function createSeedLiquidity(opts: SeedLiquidityOptions) {
  const { writer, walletClient, publicClient, eventMarketAddress, perMarketUsdc, usdcAddress } = opts;

  async function readBalance(): Promise<bigint | null> {
    const account = walletClient.account?.address as `0x${string}` | undefined;
    if (!account) {
      return null;
    }

    if (writer.balanceUsdc) {
      return writer.balanceUsdc(account);
    }

    if (!publicClient || !usdcAddress) {
      return null;
    }

    return publicClient.readContract({
      address: usdcAddress,
      abi: [
        {
          type: 'function',
          name: 'balanceOf',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: 'balance', type: 'uint256' }],
        },
      ],
      functionName: 'balanceOf',
      args: [account],
    }) as Promise<bigint>;
  }

  return {
    async seed(marketId: bigint, outcomeCount: number): Promise<SeedLiquidityResult> {
      const balance = await readBalance();
      if (balance != null && balance < perMarketUsdc) {
        return {
          status: 'needs_funding',
          error: 'automation wallet needs funding',
        };
      }

      try {
        const approveTxHash = await writer.approveUsdc(perMarketUsdc);
        const perOutcome = perMarketUsdc / BigInt(outcomeCount);
        const betTxHashes: `0x${string}`[] = [];
        for (let i = 0; i < outcomeCount; i++) {
          const hash = await walletClient.writeContract({
            address: eventMarketAddress,
            abi: eventMarketAbi,
            functionName: 'bet',
            args: [marketId, i, perOutcome],
            chain: walletClient.chain ?? null,
            account: walletClient.account!,
          });
          betTxHashes.push(hash);
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash });
          }
        }

        return {
          status: 'seeded',
          approveTxHash,
          betTxHashes,
        };
      } catch (error) {
        if (isFundingError(error)) {
          return {
            status: 'needs_funding',
            error: 'automation wallet needs funding',
          };
        }

        return {
          status: 'seed_failed',
          error: safeErrorMessage(error, 'seed failed'),
        };
      }
    },
  };
}
