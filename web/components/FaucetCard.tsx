'use client';

import type { Abi } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import ERC20Abi from '@/lib/abis/ERC20.json';
import { USDC_ADDRESS } from '@/lib/addresses';
import { fmtUsdc } from '@/lib/format';

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
    <section className="glass rounded-3xl p-6">
      <div className="mb-1 font-display text-xl text-ink">需要 testnet USDC</div>
      <p className="mb-4 text-sm leading-6 text-ink-2">
        在 Arc 上 USDC 同时是下注本金和 gas。去 Circle Faucet 领取一些 testnet
        USDC，并顺手补一点 native 用作 Pyth update fee。
      </p>
      <div className="mb-4">
        <span className="font-mono text-2xl text-ink num-glow">{fmtUsdc(balBn)}</span>{' '}
        <span className="text-ink-3">USDC</span>
      </div>
      <a
        href="https://faucet.circle.com"
        target="_blank"
        rel="noopener"
        className="flex w-full items-center justify-center rounded-2xl border border-arc-glow/40 bg-arc/15 px-4 py-3 text-base font-semibold text-arc-glow transition hover:bg-arc/25 hover:shadow-[inset_0_0_24px_rgba(77,168,255,0.35),0_0_40px_-12px_rgba(77,168,255,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60"
      >
        领取测试 USDC
      </a>
    </section>
  );
}
