'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { arcTestnet } from '@/lib/chain';

export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === arcTestnet.id) {
    return null;
  }

  return (
    <div className="border-b border-no/35 bg-no/15 px-4 py-2 text-center text-sm text-no">
      <span className="mr-3">你当前不在 Arc Testnet。</span>
      <button
        type="button"
        onClick={() => switchChain({ chainId: arcTestnet.id })}
        className="font-medium underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
      >
        {isPending ? '切换中...' : '切换到 Arc Testnet'}
      </button>
    </div>
  );
}
