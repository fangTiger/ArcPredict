export type MarketKind = 'price' | 'event';
export type MarketCategory = 'crypto' | 'worldcup' | 'macro' | 'chain';

export type WorldCupStage =
  | 'group'
  | 'r16'
  | 'qf'
  | 'sf'
  | 'final'
  | 'winner';
export type WorldCupStageFilter = 'all' | WorldCupStage;

export const MARKET_KINDS: MarketKind[] = ['price', 'event'];
export const MARKET_CATEGORIES: MarketCategory[] = ['crypto', 'worldcup', 'macro', 'chain'];
export const WORLD_CUP_STAGE_FILTERS: WorldCupStageFilter[] = [
  'all',
  'group',
  'r16',
  'qf',
  'sf',
  'final',
  'winner',
];

const WORLD_CUP_STAGE_LABELS: Record<WorldCupStageFilter, string> = {
  all: 'All',
  group: 'Group',
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  final: 'Final',
  winner: 'Winner',
};

type MarketKindCarrier = {
  marketKind?: MarketKind | null;
};

export function marketKindOf(input: MarketKindCarrier | null | undefined): MarketKind {
  return input?.marketKind === 'event' ? 'event' : 'price';
}

export function isMarketKind(
  input: MarketKindCarrier | null | undefined,
  kind: MarketKind,
): boolean {
  return marketKindOf(input) === kind;
}

export function filterByMarketKind<T extends MarketKindCarrier>(
  items: readonly T[],
  kind: MarketKind,
): T[] {
  return items.filter((item) => isMarketKind(item, kind));
}

export function splitByMarketKind<T extends MarketKindCarrier>(
  items: readonly T[],
): Record<MarketKind, T[]> {
  return {
    price: filterByMarketKind(items, 'price'),
    event: filterByMarketKind(items, 'event'),
  };
}

export function isWorldCupStage(
  value: string | null | undefined,
): value is WorldCupStage {
  return value === 'group' || value === 'r16' || value === 'qf' || value === 'sf' || value === 'final' || value === 'winner';
}

export function isWorldCupStageFilter(
  value: string | null | undefined,
): value is WorldCupStageFilter {
  return value === 'all' || isWorldCupStage(value);
}

export function normalizeWorldCupStageFilter(
  value: string | null | undefined,
): WorldCupStageFilter {
  return isWorldCupStageFilter(value) ? value : 'all';
}

export function worldCupStageLabel(stage: WorldCupStageFilter): string {
  return WORLD_CUP_STAGE_LABELS[stage];
}
