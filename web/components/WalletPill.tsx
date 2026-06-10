'use client';

import type { Abi } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import ERC20Abi from '@/lib/abis/ERC20.json';
import { USDC_ADDRESS } from '@/lib/addresses';
import { fmtUsdc } from '@/lib/format';

const erc20Abi = ERC20Abi as Abi;

export function WalletPill() {
  const { address } = useAccount();
  const { data: bal } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });
  const balance = (bal as bigint | undefined) ?? 0n;

  return (
    <div className="flex items-center gap-3">
      {address ? (
        <span className="font-mono text-sm text-zinc-400">{fmtUsdc(balance)} USDC</span>
      ) : null}
      <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
    </div>
  );
}
