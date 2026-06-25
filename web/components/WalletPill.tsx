'use client';

import type { Abi } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useChainId, useReadContract } from 'wagmi';
import ERC20Abi from '@/lib/abis/ERC20.json';
import { USDC_ADDRESS } from '@/lib/addresses';
import { arcTestnet } from '@/lib/chain';
import { truncateAddr } from '@/lib/format';

const erc20Abi = ERC20Abi as Abi;

const pillBase =
  'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium sm:px-4 sm:text-sm whitespace-nowrap transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0';

const pillIdle = `${pillBase} border border-hair bg-bg-1 text-ink hover:border-arc/20 hover:text-ink`;
const pillConnected = `${pillBase} border border-hair bg-bg-1 text-ink font-mono hover:border-arc/20`;
const pillWrong = `${pillBase} border border-no/25 bg-no/5 text-no`;

export function WalletPill() {
  const { address } = useAccount();
  const chainId = useChainId();

  useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  return (
    <ConnectButton.Custom>
      {({ account, mounted, authenticationStatus, openAccountModal, openConnectModal, openChainModal }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected = ready && !!account && !!address;
        const wrongChain = connected && chainId !== arcTestnet.id;

        if (!ready) {
          return <div className="pointer-events-none opacity-0" aria-hidden />;
        }

        if (wrongChain) {
          return (
            <button type="button" onClick={openChainModal} className={pillWrong}>
              <span className="arc-ring-pulse h-2 w-2 rounded-full bg-no" />
              <span>Switch to Arc</span>
            </button>
          );
        }

        if (!connected) {
          return (
            <button type="button" onClick={openConnectModal} className={pillIdle}>
              <span>Connect Wallet</span>
              <span aria-hidden>→</span>
            </button>
          );
        }

        return (
          <button type="button" onClick={openAccountModal} className={pillConnected}>
            <span>{truncateAddr(address!)}</span>
            <span className="arc-ring-pulse h-2 w-2 rounded-full bg-arc-glow" />
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
