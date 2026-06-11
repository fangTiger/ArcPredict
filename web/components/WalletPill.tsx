'use client';

import type { Abi } from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import ERC20Abi from '@/lib/abis/ERC20.json';
import { USDC_ADDRESS } from '@/lib/addresses';
import { truncateAddr } from '@/lib/format';

const erc20Abi = ERC20Abi as Abi;

export function WalletPill() {
  const { address } = useAccount();
  useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  return (
    <ConnectButton.Custom>
      {({ account, mounted, authenticationStatus, openAccountModal, openConnectModal }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected = ready && !!account && !!address;

        return (
          <div
            aria-hidden={!ready}
            className={!ready ? 'pointer-events-none opacity-0' : undefined}
          >
            <button
              type="button"
              onClick={connected ? openAccountModal : openConnectModal}
              className="inline-flex items-center gap-2 bg-ink text-paper rounded-full px-3 py-2 text-xs font-medium sm:px-4 sm:text-sm whitespace-nowrap transition duration-150 hover:bg-arc-deep hover:-translate-y-px"
            >
              {connected ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-arc" aria-hidden="true" />
                  <span>{truncateAddr(address)}</span>
                </>
              ) : (
                <span>Connect Wallet</span>
              )}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
