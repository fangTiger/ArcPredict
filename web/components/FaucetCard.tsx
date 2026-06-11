'use client';

import type { Abi } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import ERC20Abi from '@/lib/abis/ERC20.json';
import { USDC_ADDRESS } from '@/lib/addresses';

const erc20Abi = ERC20Abi as Abi;

export function FaucetCard() {
  const { address, isConnected } = useAccount();
  const { data: bal } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const balBn = (bal as bigint | undefined) ?? 0n;
  if (!isConnected || bal === undefined || balBn > 0n) {
    return null;
  }

  return (
    <section className="my-6 rounded-lg border border-heat/25 bg-heat/10 p-5">
      <div className="mb-1 text-sm font-semibold text-heat">需要 testnet USDC</div>
      <p className="mb-3 text-sm leading-6 text-ink-2">
        在 Arc 上 USDC 同时是下注本金和 gas。去 Circle Faucet 领取一些 testnet
        USDC，并顺手补一点 native 用作 Pyth update fee。
      </p>
      <a
        href="https://faucet.circle.com"
        target="_blank"
        rel="noopener"
        className="inline-flex items-center rounded-lg bg-heat px-4 py-2 text-sm font-semibold text-paper transition hover:bg-heat/90"
      >
        前往 Circle Faucet
      </a>
    </section>
  );
}
