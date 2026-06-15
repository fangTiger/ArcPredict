import type { DashboardRow, UserPosition } from '@/lib/derivePosition';
import { OUTCOMES, userPositionOf } from '@/lib/derivePosition';
import { marketKindOf, type MarketKind } from '@/lib/market-kind';
import {
  EVENT_UNRESOLVED_OUTCOME,
  type WorldCupMarketRow,
} from '@/lib/worldcup-markets';

const variants = {
  profit: 'bg-yes/15 text-yes border border-yes/30',
  loss: 'bg-no/15 text-no border border-no/30',
  open: 'bg-arc/15 text-arc-glow border border-arc-glow/30',
} as const;

const positionLabel: Record<UserPosition, string> = {
  none: 'No position',
  yes: 'YES',
  no: 'NO',
  both: 'Both',
};

export type PricePositionRow = DashboardRow & {
  marketKind?: 'price';
};

export type PositionListRow = PricePositionRow | WorldCupMarketRow;

export type PositionListItem = {
  id: bigint;
  marketKind: MarketKind;
  question: string;
  badgeLabel: string;
  badgeClassName: string;
  totalStake: bigint;
  details: Array<{ label: string; amount: bigint }>;
};

export function isPricePositionRow(row: PositionListRow): row is PricePositionRow {
  return marketKindOf(row) === 'price';
}

export function isEventPositionRow(row: PositionListRow): row is WorldCupMarketRow {
  return marketKindOf(row) === 'event';
}

export function filterPositionRows(
  rows: readonly PositionListRow[],
  kindFilter?: MarketKind,
): PositionListRow[] {
  if (!kindFilter) {
    return [...rows];
  }

  return kindFilter === 'event'
    ? rows.filter(isEventPositionRow)
    : rows.filter(isPricePositionRow);
}

export function toPricePositionItem(row: PricePositionRow): PositionListItem | null {
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
    badgeClassName: variants.open,
    totalStake: stake,
    details,
  };
}

export function toEventPositionItem(row: WorldCupMarketRow): PositionListItem | null {
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
    badgeClassName: variants.open,
    totalStake,
    details,
  };
}

export function toPositionItems(
  rows: readonly PositionListRow[],
  kindFilter?: MarketKind,
): PositionListItem[] {
  const filteredRows = filterPositionRows(rows, kindFilter);
  const unresolvedPriceRows = filteredRows.filter(
    (r): r is PricePositionRow =>
      isPricePositionRow(r) &&
      userPositionOf(r) !== 'none' &&
      OUTCOMES[r.market.outcome] === 'Unresolved',
  );
  const unresolvedEventRows = filteredRows.filter(
    (row): row is WorldCupMarketRow =>
      isEventPositionRow(row) &&
      row.settledOutcome === EVENT_UNRESOLVED_OUTCOME &&
      row.userOutcomeStakes.some((stake: bigint) => stake > 0n),
  );

  return [
    ...unresolvedPriceRows.map(toPricePositionItem),
    ...unresolvedEventRows.map(toEventPositionItem),
  ].filter((row): row is PositionListItem => row !== null);
}

export function getActivePositionCount(
  rows: readonly PositionListRow[],
  kindFilter?: MarketKind,
): number {
  return toPositionItems(rows, kindFilter).length;
}
