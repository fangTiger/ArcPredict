'use client';

import type { DashboardRow, UserPosition } from '@/lib/derivePosition';
import { OUTCOMES, userPositionOf } from '@/lib/derivePosition';
import { fmtUsdc } from '@/lib/format';
import { marketKindOf, type MarketKind } from '@/lib/market-kind';
import {
  EVENT_UNRESOLVED_OUTCOME,
  type WorldCupMarketRow,
} from '@/lib/worldcup-markets';

const positionTone: Record<UserPosition, string> = {
  none: 'text-ink-2',
  yes: 'text-yes',
  no: 'text-no',
  both: 'text-arc',
};

const positionLabel: Record<UserPosition, string> = {
  none: 'No position',
  yes: 'YES',
  no: 'NO',
  both: 'Both',
};

type PricePositionRow = DashboardRow & {
  marketKind?: 'price';
};

type PositionListRow = PricePositionRow | WorldCupMarketRow;

type PositionListItem = {
  id: bigint;
  marketKind: MarketKind;
  question: string;
  badgeLabel: string;
  badgeClassName: string;
  totalStake: bigint;
  details: Array<{ label: string; amount: bigint }>;
};

function isPriceRow(row: PositionListRow): row is PricePositionRow {
  return marketKindOf(row) === 'price';
}

function isEventRow(row: PositionListRow): row is WorldCupMarketRow {
  return marketKindOf(row) === 'event';
}

function toPricePositionItem(row: PricePositionRow): PositionListItem | null {
  if (userPositionOf(row) === 'none' || OUTCOMES[row.market.outcome] !== 'Unresolved') {
    return null;
  }

  const r = row;
  const pos = userPositionOf(row);
  const stake =
    pos === 'yes'
      ? r.yesStake
      : pos === 'no'
        ? r.noStake
        : pos === 'both'
          ? r.yesStake + r.noStake
          : 0n;

  const details = [
    row.yesStake > 0n ? { label: 'YES', amount: row.yesStake } : null,
    row.noStake > 0n ? { label: 'NO', amount: row.noStake } : null,
  ].filter((detail): detail is { label: string; amount: bigint } => detail !== null);

  return {
    id: row.id,
    marketKind: 'price',
    question: row.market.question,
    badgeLabel: positionLabel[pos],
    badgeClassName: positionTone[pos],
    totalStake: stake,
    details,
  };
}

function toEventPositionItem(row: WorldCupMarketRow): PositionListItem | null {
  if (
    row.settledOutcome !== EVENT_UNRESOLVED_OUTCOME ||
    !row.userOutcomeStakes.some((stake) => stake > 0n)
  ) {
    return null;
  }

  const details = row.outcomes
    .map((outcome, index) => ({
      label: outcome.label,
      amount: row.userOutcomeStakes[index] ?? 0n,
    }))
    .filter((detail) => detail.amount > 0n);
  const totalStake = details.reduce((total, detail) => total + detail.amount, 0n);

  return {
    id: row.id,
    marketKind: 'event',
    question: row.question,
    badgeLabel: `EVENT · ${details.length} picks`,
    badgeClassName: 'text-emerald-700',
    totalStake,
    details,
  };
}

export function PositionList({
  rows,
  kindFilter,
}: {
  rows: PositionListRow[];
  kindFilter?: MarketKind;
}) {
  const filteredRows = kindFilter
    ? kindFilter === 'event'
      ? rows.filter(isEventRow)
      : rows.filter(isPriceRow)
    : rows;
  const unresolvedPriceRows = filteredRows.filter(
    (r): r is PricePositionRow =>
      isPriceRow(r) &&
      userPositionOf(r) !== 'none' &&
      OUTCOMES[r.market.outcome] === 'Unresolved',
  );
  const unresolvedEventRows = filteredRows.filter(
    (row): row is WorldCupMarketRow =>
      isEventRow(row) &&
      row.settledOutcome === EVENT_UNRESOLVED_OUTCOME &&
      row.userOutcomeStakes.some((stake: bigint) => stake > 0n),
  );
  const userRows = [
    ...unresolvedPriceRows.map(toPricePositionItem),
    ...unresolvedEventRows.map(toEventPositionItem),
  ].filter((row): row is PositionListItem => row !== null);

  if (userRows.length === 0) return null;

  return (
    <section className="mt-8 rounded-lg border border-hair bg-paper">
      <div className="flex items-center justify-between border-b border-hair px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">My Positions</h2>
          <p className="mt-1 text-xs text-ink-2">Markets still waiting for settlement.</p>
        </div>
        <span className="font-mono text-sm text-ink-2">{userRows.length}</span>
      </div>

      <div className="divide-y divide-hair">
        {userRows.map((r) => (
          <article
            key={r.id.toString()}
            className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-3">
                <span className="font-mono text-xs text-ink-2">#{r.id.toString()}</span>
                <span
                  className={`rounded-full bg-canvas px-2 py-1 text-xs font-medium ${r.badgeClassName}`}
                >
                  {r.badgeLabel}
                </span>
              </div>
              <div className="text-sm leading-6 text-ink">{r.question}</div>
              <div className="mt-2">
                <div className="text-xs text-ink-2">Position Details</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.details.map((detail) => (
                    <span
                      key={`${r.id.toString()}-${detail.label}`}
                      className="rounded-full border border-hair bg-canvas px-3 py-1 font-mono text-xs text-ink-2"
                    >
                      {detail.label} · {fmtUsdc(detail.amount)} USDC
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 text-left sm:text-right">
              <div className="text-xs text-ink-2">Position Value</div>
              <div className="font-mono text-sm text-ink">{fmtUsdc(r.totalStake)} USDC</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
