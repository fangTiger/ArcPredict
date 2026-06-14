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
    <div
      className="relative z-[60] border-b border-no/30 px-4 py-2 text-no"
      style={{ background: 'rgba(248,113,113,0.10)' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 text-sm">
        <span>Wrong network. Switch to Arc Testnet.</span>
        <button
          type="button"
          onClick={() => switchChain({ chainId: arcTestnet.id })}
          className="inline-flex items-center font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending}
        >
          {isPending ? 'Switching...' : 'Switch'}
        </button>
      </div>
    </div>
  );
}
