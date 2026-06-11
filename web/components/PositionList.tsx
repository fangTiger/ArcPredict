'use client';

import type { DashboardRow, UserPosition } from '@/lib/derivePosition';
import { OUTCOMES, userPositionOf } from '@/lib/derivePosition';
import { fmtUsdc } from '@/lib/format';

const positionTone: Record<UserPosition, string> = {
  none: 'text-ink-2',
  yes: 'text-yes',
  no: 'text-no',
  both: 'text-arc',
};

const positionLabel: Record<UserPosition, string> = {
  none: '无仓位',
  yes: 'YES',
  no: 'NO',
  both: '双边',
};

export function PositionList({ rows }: { rows: DashboardRow[] }) {
  const userRows = rows.filter(
    (r) => userPositionOf(r) !== 'none' && OUTCOMES[r.market.outcome] === 'Unresolved',
  );

  if (userRows.length === 0) return null;

  return (
    <section className="mt-8 rounded-lg border border-hair bg-paper">
      <div className="flex items-center justify-between border-b border-hair px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">我的持仓</h2>
          <p className="mt-1 text-xs text-ink-2">仅显示你仍在等待结算的市场仓位。</p>
        </div>
        <span className="font-mono text-sm text-ink-2">{userRows.length}</span>
      </div>

      <div className="divide-y divide-hair">
        {userRows.map((r) => {
          const pos = userPositionOf(r);
          const stake =
            pos === 'yes'
              ? r.yesStake
              : pos === 'no'
                ? r.noStake
                : pos === 'both'
                  ? r.yesStake + r.noStake
                  : 0n;

          return (
            <article
              key={r.id.toString()}
              className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-3">
                  <span className="font-mono text-xs text-ink-2">#{r.id.toString()}</span>
                  <span
                    className={`rounded-full bg-canvas px-2 py-1 text-xs font-medium ${positionTone[pos]}`}
                  >
                    {positionLabel[pos]}
                  </span>
                </div>
                <div className="text-sm leading-6 text-ink">{r.market.question}</div>
              </div>

              <div className="shrink-0 text-left sm:text-right">
                <div className="text-xs text-ink-2">持仓金额</div>
                <div className="font-mono text-sm text-ink">{fmtUsdc(stake)} USDC</div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
