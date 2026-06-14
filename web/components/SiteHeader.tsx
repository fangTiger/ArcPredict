import Link from 'next/link';
import { Logo } from './Logo';
import { WalletPill } from './WalletPill';

export function SiteHeader({
  allPositionsHref,
  allPositionsActive = false,
}: {
  allPositionsHref?: string;
  allPositionsActive?: boolean;
}) {
  return (
    <header
      className="sticky top-0 z-50 border-b border-hair"
      style={{
        background: 'rgba(10,11,30,0.65)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-5 sm:px-8 py-3.5 sm:gap-3">
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/" className="inline-flex items-center" aria-label="ArcPredict 首页">
            <Logo size="md" />
          </Link>
          {allPositionsHref ? (
            <Link
              href={allPositionsHref}
              className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-[11px] transition sm:px-3 sm:py-1.5 sm:text-xs ${
                allPositionsActive
                  ? 'border-arc-glow/40 bg-arc/10 text-arc-glow'
                  : 'border-hair text-ink-2 hover:border-arc-glow/30 hover:text-ink'
              }`}
            >
              <span className="sm:hidden">持仓</span>
              <span className="hidden sm:inline">全部持仓</span>
            </Link>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-hair px-2 sm:px-3 py-1.5 text-[13px] text-ink-2">
            <span className="arc-ring-pulse h-2 w-2 rounded-full bg-arc-glow" />
            <span className="hidden sm:inline">Arc Testnet</span>
            <span className="hidden md:inline font-mono text-[12px] text-ink">·5042002</span>
          </span>
          <WalletPill />
        </div>
      </div>
    </header>
  );
}
