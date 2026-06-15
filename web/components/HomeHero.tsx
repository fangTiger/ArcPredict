import type { MarketCategory } from '@/lib/market-kind';
import { HeroParticleCanvas } from './HeroParticleCanvas';

type Props = {
  category: MarketCategory;
  stats?: {
    activeMarkets: number;
    totalVolumeUsdc: string;
    pendingResolution: number;
  };
};

export function HomeHero({ category, stats }: Props) {
  const activeMarkets = stats?.activeMarkets.toString() ?? '--';
  const pendingResolution = stats?.pendingResolution.toString() ?? '--';
  const totalVolume = stats?.totalVolumeUsdc ?? '--';
  const isWorldCup = category === 'worldcup';
  const copy = isWorldCup
    ? {
        eyebrow: 'World Cup board',
        title: 'Pick the next winner.',
        description: '1X2 / spreads / winner markets · USDC-settled on Arc.',
      }
    : {
        eyebrow: 'Crypto board',
        title: 'Predict the next tick.',
        description: 'Arc USDC pools · Pyth-backed deadlines · open positions.',
      };

  return (
    <section
      className={`hero-arc-band ${isWorldCup ? 'hero-arc-worldcup' : 'hero-arc-crypto'} relative mb-5 overflow-hidden rounded-xl border border-hair`}
    >
      <HeroParticleCanvas variant={isWorldCup ? 'worldcup' : 'crypto'} />
      <div className="hero-gradient-mask" aria-hidden="true" />

      <div className="hero-content relative grid gap-5 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-12 lg:items-end">
        <div className="min-w-0 lg:col-span-7">
          <div className="flex items-center gap-2.5">
            <span className="live-dot" aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-2">
              Live
            </span>
            <span className="text-ink-3">·</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-arc-glow">
              {copy.eyebrow}
            </span>
          </div>
          <h1 className="hero-title mt-3 text-ink">{copy.title}</h1>
          <p className="mt-2 max-w-xl text-sm leading-5 text-ink-2">{copy.description}</p>
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
      <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-3">{label}</div>
      <div className="mt-1 font-mono text-lg leading-none text-ink num-glow">{value}</div>
    </div>
  );
}
