import Link from 'next/link';
import type { MarketCategory } from '../lib/market-kind';

type Props = {
  category: MarketCategory;
  stats?: {
    activeMarkets: number;
    totalVolumeUsdc: string;
    pendingResolution: number;
  };
};

const HERO_COPY: Record<MarketCategory, { label: string; summary: string }> = {
  crypto: {
    label: 'Crypto',
    summary: 'Track price thresholds, active pools, and short-dated probability moves from a compact market feed.',
  },
  worldcup: {
    label: 'World Cup',
    summary: 'Scan match winners, totals, and outrights with direct outcome buttons and thin-border cards.',
  },
  macro: {
    label: 'Macro',
    summary: 'Follow CPI, Fed, and jobs catalysts without the neon landing-page treatment.',
  },
  chain: {
    label: 'On-chain',
    summary: 'Monitor liquidity rotation, unlocks, and bridge flow in the same browsing rhythm as the main market feed.',
  },
};

const QUICK_LINKS: { href: string; title: string; sub: string }[] = [
  { href: '/?category=crypto', title: 'Crypto', sub: 'Price thresholds' },
  { href: '/?category=worldcup', title: 'World Cup', sub: 'Matchday markets' },
  { href: '/?category=macro', title: 'Macro', sub: 'CPI · Fed · NFP' },
  { href: '/?category=chain', title: 'On-chain', sub: 'TVL · unlocks' },
];

export function HomeHero({ category, stats }: Props) {
  const activeMarkets = stats?.activeMarkets.toString() ?? '--';
  const pendingResolution = stats?.pendingResolution.toString() ?? '--';
  const totalVolume = stats?.totalVolumeUsdc ?? '--';
  const copy = HERO_COPY[category];

  return (
    <section className="mb-5 rounded-xl border border-hair bg-bg-1 p-5 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.12)]">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase text-ink-3">
            <span className="rounded-full border border-hair bg-bg-2 px-2.5 py-1">
              Browse live prediction markets
            </span>
            <span className="rounded-full border border-hair bg-bg-2 px-2.5 py-1">
              Arc Testnet
            </span>
            <span className="rounded-full border border-hair bg-bg-2 px-2.5 py-1 text-ink">
              {copy.label}
            </span>
          </div>
          <h1 className="mt-4 text-[1.9rem] font-semibold leading-tight text-ink">
            Browse live prediction markets
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
            {copy.summary}
          </p>
          <div className="mt-4">
            <div className="text-[11px] uppercase text-ink-3">Quick links</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {QUICK_LINKS.map((categoryEntry) => (
              <Link
                key={categoryEntry.href}
                href={categoryEntry.href}
                className="rounded-xl border border-hair bg-bg-0 px-3 py-3 text-ink transition hover:border-arc/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0"
              >
                <span className="block text-sm font-semibold leading-none">{categoryEntry.title}</span>
                <span className="mt-1 block text-xs leading-5 text-ink-2">{categoryEntry.sub}</span>
              </Link>
            ))}
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <Stat label="Open markets" value={activeMarkets} />
          <Stat label="Open interest" value={totalVolume} />
          <Stat label="Pending" value={pendingResolution} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-hair bg-bg-0 px-3 py-3">
      <div className="font-mono text-[10px] uppercase text-ink-3">{label}</div>
      <div className="mt-2 text-lg font-semibold leading-none text-ink">{value}</div>
    </div>
  );
}
