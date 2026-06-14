import Link from 'next/link';
import { LogoMark } from './LogoMark';

type Props = {
  stats?: {
    activeMarkets: number;
    totalVolumeUsdc: string;
    pendingResolution: number;
  };
};

export function HomeHero({ stats }: Props) {
  return (
    <section className="relative overflow-hidden px-4 pt-16 pb-12 sm:px-6 sm:pt-24 lg:px-8">
      <div className="pointer-events-none absolute -right-20 -top-10 opacity-15" aria-hidden="true">
        <LogoMark size={480} animate={false} style={{ filter: 'blur(2px)' }} />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <h1 className="max-w-3xl font-display text-[44px] leading-[1.05] text-ink sm:text-[64px] lg:text-[84px]">
          <span className="bg-aurora-text bg-clip-text text-transparent">链上预测</span>
          <br />
          <span className="text-ink">看见概率</span>
        </h1>
        <p className="mt-6 max-w-xl text-base text-ink-2 sm:text-lg">
          在 Arc 上用 USDC 参与加密价格与世界杯双轨预测市场。完全链上、无中介、零信任。
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="#markets"
            className="inline-flex items-center gap-2 rounded-2xl border border-arc-glow/40 bg-arc/15 px-5 py-3 text-base font-semibold text-arc-glow transition hover:bg-arc/25 hover:shadow-[inset_0_0_24px_rgba(77,168,255,0.35),0_0_40px_-12px_rgba(77,168,255,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60"
          >
            立即参与 <span aria-hidden>→</span>
          </Link>
          <Link
            href="/connect"
            className="inline-flex items-center gap-2 rounded-2xl border border-hair px-5 py-3 text-base text-ink-2 transition hover:border-arc-glow/30 hover:text-ink"
          >
            了解 Arc 网络
          </Link>
        </div>

        {stats ? (
          <div className="mt-12 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="24h 活跃合约" value={stats.activeMarkets.toString()} />
            <Stat label="总投注金额" value={stats.totalVolumeUsdc} unit="USDC" />
            <Stat label="待结算" value={stats.pendingResolution.toString()} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-2xl border border-hair px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-ink-3">{label}</div>
      <div className="mt-1 font-mono text-2xl text-ink num-glow">
        {value}{unit ? <span className="ml-1 text-sm text-ink-2">{unit}</span> : null}
      </div>
    </div>
  );
}
