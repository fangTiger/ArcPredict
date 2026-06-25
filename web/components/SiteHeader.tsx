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
    <header className="sticky top-0 z-50 border-b border-hair bg-bg-0/95">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 py-3">
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/" className="inline-flex items-center" aria-label="ArcPredict home">
            <Logo size="md" />
          </Link>
          <Link
            href="/#markets"
            className="hidden rounded-full border border-hair bg-bg-1 px-3 py-1.5 text-xs text-ink-2 transition hover:border-arc/25 hover:text-ink lg:inline-flex"
          >
            Market index
          </Link>
          {allPositionsHref ? (
            <Link
              href={allPositionsHref}
              className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs transition ${
                allPositionsActive
                  ? 'border-arc/20 bg-bg-1 text-ink shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                  : 'border-hair bg-bg-1 text-ink-2 hover:border-arc/20 hover:text-ink'
              }`}
            >
              <span className="sm:hidden">Positions</span>
              <span className="hidden sm:inline">All Positions</span>
            </Link>
          ) : null}
        </div>

        <Link
          href="/#markets"
          className="hidden min-w-0 flex-1 items-center gap-3 rounded-xl border border-hair bg-bg-1 px-4 py-2.5 text-sm text-ink-2 transition hover:border-arc/20 hover:text-ink md:flex"
        >
          <span className="font-mono text-[10px] uppercase text-ink-3">Browse markets</span>
          <span className="truncate">Search by market, team, or theme</span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-hair bg-bg-1 px-3 py-1.5 text-[13px] text-ink-2">
            <span className="arc-ring-pulse h-2 w-2 rounded-full bg-arc" />
            <span className="hidden sm:inline">Arc Testnet</span>
            <span className="hidden md:inline font-mono text-[12px] text-ink">·5042002</span>
          </span>
          <WalletPill />
        </div>
      </div>
    </header>
  );
}
