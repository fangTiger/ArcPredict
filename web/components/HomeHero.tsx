import Link from 'next/link';
import type { MarketCategory } from '../lib/market-kind';
import { HeroParticleCanvas } from './HeroParticleCanvas';

type Props = {
  category: MarketCategory;
  stats?: {
    activeMarkets: number;
    totalVolumeUsdc: string;
    pendingResolution: number;
  };
};

const HERO_COPY: Record<MarketCategory, { eyebrow: string; title: string; description: string }> = {
  crypto: {
    eyebrow: 'Crypto board',
    title: 'Predict the next tick.',
    description: 'Arc USDC pools · Pyth-backed deadlines · open positions.',
  },
  worldcup: {
    eyebrow: 'World Cup board',
    title: 'Pick the next winner.',
    description: '1X2 / totals / winner markets · USDC-settled on Arc.',
  },
  macro: {
    eyebrow: 'Macro board',
    title: 'Trade the next macro surprise.',
    description: 'CPI · Fed · jobs catalysts priced into live Arc markets.',
  },
  chain: {
    eyebrow: 'On-chain board',
    title: 'Track the next liquidity rotation.',
    description: 'TVL · unlocks · bridge flow across active Arc markets.',
  },
};

const NEW_CATEGORIES: { href: string; title: string; sub: string }[] = [
  { href: '/?category=macro', title: 'Macro', sub: 'CPI · Fed · NFP' },
  { href: '/?category=chain', title: 'On-chain', sub: 'TVL · unlocks' },
];

export function HomeHero({ category, stats }: Props) {
  const activeMarkets = stats?.activeMarkets.toString() ?? '--';
  const pendingResolution = stats?.pendingResolution.toString() ?? '--';
  const totalVolume = stats?.totalVolumeUsdc ?? '--';
  const heroVariant = category === 'worldcup' ? 'worldcup' : 'crypto';
  const copy = HERO_COPY[category];

  return (
    <section
      className={`hero-arc-band ${heroVariant === 'worldcup' ? 'hero-arc-worldcup' : 'hero-arc-crypto'} relative mb-5 overflow-hidden rounded-xl border border-hair`}
    >
      <HeroParticleCanvas variant={heroVariant} />
      <div className="hero-gradient-mask" aria-hidden="true" />

      <div className="hero-content relative grid gap-5 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-12 lg:items-end">
        <div className="min-w-0 lg:col-span-7">
          <div className="flex items-center gap-2.5">
            <span className="live-dot" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase text-ink-2">
              Live
            </span>
            <span className="text-ink-3">·</span>
            <span className="font-mono text-[10px] uppercase text-arc-glow">
              {copy.eyebrow}
            </span>
          </div>
          <h1 className="hero-title mt-3 text-ink">{copy.title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-5 text-ink-2">{copy.description}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {NEW_CATEGORIES.map((categoryEntry) => (
              <Link
                key={categoryEntry.href}
                href={categoryEntry.href}
                className="hero-stat min-w-[8.5rem] rounded-lg border border-hair bg-bg-1/55 px-3 py-2.5 text-ink backdrop-blur transition hover:border-arc-glow/40 hover:bg-arc/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0"
              >
                <span className="block text-lg font-semibold leading-none">{categoryEntry.title}</span>
                <span className="mt-1 block text-sm leading-none text-ink-2">{categoryEntry.sub}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 lg:col-span-5">
          <Stat label="Open" value={activeMarkets} />
          <Stat label="Volume" value={totalVolume} />
          <Stat label="Pending" value={pendingResolution} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hero-stat rounded-lg border border-hair bg-bg-1/55 px-3 py-2.5 backdrop-blur">
      <div className="font-mono text-[9px] uppercase text-ink-3">{label}</div>
      <div className="mt-1 font-mono text-lg leading-none text-ink num-glow">{value}</div>
    </div>
  );
}
