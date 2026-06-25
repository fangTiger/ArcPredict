'use client';

import { fmtUsdc } from '@/lib/format';
import type { MarketKind } from '@/lib/market-kind';
import {
  filterPositionRows,
  toPositionItems,
  type PositionListRow,
} from '@/lib/position-items';

export function PositionList({
  rows,
  kindFilter,
}: {
  rows: PositionListRow[];
  kindFilter?: MarketKind;
}) {
  const filteredRows = filterPositionRows(rows, kindFilter);
  const userRows = toPositionItems(filteredRows);

  return (
    <section className="rounded-xl border border-hair bg-bg-1 p-5 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.12)] sm:p-6">
      <div className="flex items-center justify-between border-b border-hair pb-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">My Positions</h2>
          <p className="mt-1 text-sm text-ink-2">Markets still waiting for settlement.</p>
        </div>
        <span className="font-mono text-sm text-ink-2">{userRows.length}</span>
      </div>

      <div>
        {userRows.length === 0 ? (
          <div className="py-8 text-sm leading-6 text-ink-2">
            No active positions in this view.
          </div>
        ) : null}

        {userRows.map((r) => (
          <article
            key={r.id.toString()}
            className="flex flex-col gap-4 border-b border-hair py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-3">
                <span className="font-mono text-xs text-ink-2">#{r.id.toString()}</span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${r.badgeClassName}`}
                >
                  {r.badgeLabel}
                </span>
              </div>
              <div className="text-sm leading-6 text-ink">{r.question}</div>
              <div className="mt-2">
                <div className="font-mono text-[11px] uppercase text-ink-3">
                  Position Details
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.details.map((detail) => (
                    <span
                      key={`${r.id.toString()}-${detail.label}`}
                      className="rounded-full border border-hair bg-bg-0 px-3 py-1 font-mono text-xs text-ink-2"
                    >
                      {detail.label} · {fmtUsdc(detail.amount)} USDC
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 text-left sm:text-right">
              <div className="font-mono text-[11px] uppercase text-ink-3">
                Position Value
              </div>
              <div className="font-mono text-sm text-ink">{fmtUsdc(r.totalStake)} USDC</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
