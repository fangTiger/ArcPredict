'use client';

import { fmtUsdc } from '@/lib/format';

export type BadgeMarket = {
  outcome: number;
  betDeadline: bigint;
  resolveAfter: bigint;
  yesPool: bigint;
  noPool: bigint;
};

export type Badges = {
  activeCount: number;
  resolvingThisWeek: number;
  tvlUsdc6: bigint;
};

const WEEK_IN_SECONDS = 7n * 24n * 60n * 60n;

export function computeBadges(markets: BadgeMarket[], nowSec: number): Badges {
  const now = BigInt(nowSec);
  const weekFromNow = now + WEEK_IN_SECONDS;

  let activeCount = 0;
  let resolvingThisWeek = 0;
  let tvlUsdc6 = 0n;

  for (const market of markets) {
    tvlUsdc6 += market.yesPool + market.noPool;

    if (market.outcome !== 0) {
      continue;
    }

    if (market.betDeadline > now) {
      activeCount += 1;
    }

    if (market.resolveAfter >= now && market.resolveAfter <= weekFromNow) {
      resolvingThisWeek += 1;
    }
  }

  return {
    activeCount,
    resolvingThisWeek,
    tvlUsdc6,
  };
}

export function ActivityBadges({
  markets,
  nowSec,
}: {
  markets: BadgeMarket[];
  nowSec: number;
}) {
  const badges = computeBadges(markets, nowSec);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
      <span className="whitespace-nowrap">
        <strong className="font-semibold text-slate-900">{badges.activeCount}</strong>{' '}
        active markets
      </span>
      <span className="whitespace-nowrap">
        <strong className="font-semibold text-slate-900">{badges.resolvingThisWeek}</strong>{' '}
        resolving this week
      </span>
      <span className="whitespace-nowrap rounded-full bg-slate-50 px-2.5 py-1">
        <strong className="font-semibold text-blue-600">{fmtUsdc(badges.tvlUsdc6)}</strong>{' '}
        USDC TVL
      </span>
    </div>
  );
}
