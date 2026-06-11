'use client';

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
  if (loading || seedContribution === 0n) {
    return null;
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
      <span className="whitespace-nowrap rounded-full bg-slate-50 px-2 py-0.5">
        <span className="font-semibold text-blue-600">~{fmtUsdc(seedContribution)} USDC</span>
      </span>
      <span className="whitespace-nowrap">from project seed liquidity</span>
    </div>
  );
}
