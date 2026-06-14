'use client';

import { useState } from 'react';
import { fmtUsdc } from '@/lib/format';

export type DisclosureBetEvent = {
  user: string;
  amount: bigint;
};

type Props = {
  seedContribution: bigint;
  loading?: boolean;
};

export function sumSeedContribution(
  events: readonly DisclosureBetEvent[],
  seeds: readonly string[],
): bigint {
  if (events.length === 0 || seeds.length === 0) {
    return 0n;
  }

  const seedSet = new Set(seeds.map((seed) => seed.toLowerCase()));
  let total = 0n;

  for (const event of events) {
    if (seedSet.has(event.user.toLowerCase())) {
      total += event.amount;
    }
  }

  return total;
}

export function SeedDisclosure({ seedContribution, loading }: Props) {
  const [open, setOpen] = useState(false);

  if (loading || seedContribution === 0n) {
    return null;
  }

  const title = `~${fmtUsdc(seedContribution)} USDC from project seed liquidity`;

  return (
    <div className="glass rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-ink-2 transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0"
      >
        <span>{title}</span>
        <svg
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-hair px-4 py-3 text-sm text-ink-2">
          <div>
            Seed liquidity contributed{' '}
            <span className="font-mono text-ink num-glow">~{fmtUsdc(seedContribution)} USDC</span>{' '}
            to bootstrap this market.
          </div>
        </div>
      ) : null}
    </div>
  );
}
