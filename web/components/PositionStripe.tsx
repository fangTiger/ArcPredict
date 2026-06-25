'use client';

import Link from 'next/link';
import { fmtUsdc } from '@/lib/format';
import type { MarketKind } from '@/lib/market-kind';
import {
  filterPositionRows,
  getActivePositionCount,
  toPositionItems,
  type PositionListRow,
} from '@/lib/position-items';

export function PositionStripe({
  rows,
  kindFilter,
  allPositionsHref,
}: {
  rows: PositionListRow[];
  kindFilter?: MarketKind;
  allPositionsHref: string;
}) {
  const activePositionCount = getActivePositionCount(rows, kindFilter);

  if (activePositionCount === 0) {
    return null;
  }

  const filteredRows = filterPositionRows(rows, kindFilter);
  const userRows = toPositionItems(filteredRows).slice(0, 3);
  const remainingCount = Math.max(0, activePositionCount - userRows.length);

  return (
    <section className="mt-5 rounded-xl border border-hair bg-bg-1 px-4 py-3 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-ink">持仓 · {activePositionCount}</h2>
        <Link
          href={allPositionsHref}
          className="shrink-0 rounded-full border border-hair bg-bg-0 px-3 py-1.5 text-xs font-medium text-ink-2 transition hover:border-arc/20 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0"
        >
          查看全部 →
        </Link>
      </div>

      <div className="mt-3 max-h-[180px] overflow-y-auto">
        <div className="flex gap-3 overflow-x-auto pb-1">
          {userRows.map((row) => (
            <article
              key={row.id.toString()}
              className="flex min-w-[260px] max-w-[320px] flex-1 items-center justify-between gap-3 rounded-xl border border-hair bg-bg-0 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="mb-1 flex min-w-0 items-center gap-2">
                  <span className="font-mono text-[10px] text-ink-3">#{row.id.toString()}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${row.badgeClassName}`}>
                    {row.badgeLabel}
                  </span>
                </div>
                <div className="truncate text-sm text-ink">{row.question}</div>
                <div className="mt-1 truncate font-mono text-[11px] text-ink-3">
                  {row.details.map((detail) => `${detail.label} ${fmtUsdc(detail.amount)} USDC`).join(' / ')}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="font-mono text-[10px] uppercase text-ink-3">Stake</div>
                <div className="font-mono text-sm text-ink">{fmtUsdc(row.totalStake)} USDC</div>
              </div>
            </article>
          ))}

          {remainingCount > 0 ? (
            <Link
              href={allPositionsHref}
              className="flex min-w-[160px] items-center justify-center rounded-xl border border-dashed border-hair bg-bg-0 px-3 py-2 text-sm text-ink-2 transition hover:border-arc/20 hover:text-ink"
            >
              还有 {remainingCount} 条
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
