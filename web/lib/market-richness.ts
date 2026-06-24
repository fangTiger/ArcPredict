import { OUTCOMES, yesPercent, type DashboardRow } from './derivePosition';
import type { MarketCategory } from './market-kind';
import {
  EVENT_UNRESOLVED_OUTCOME,
  type MarketThemeVisual,
  type WorldCupMarketRow,
} from './worldcup-markets';

export type RichMarketRef = {
  id: string;
  marketKind: 'price' | 'event';
  category: MarketCategory;
  href: string;
  title: string;
  question: string;
  themeLabel: string;
  categoryLabel: string;
  themeId?: string;
  themeVisual?: MarketThemeVisual;
  deadline: bigint;
  liquidity: bigint;
  probabilityValue: number;
  probabilityLabel: string;
  skewLabel: string;
  status: 'open' | 'closed' | 'resolved' | 'claimable';
  statusLabel: string;
  activityLabel: string;
  hasPosition: boolean;
  isOpen: boolean;
  isClosingSoon: boolean;
  isSettled: boolean;
  isClaimable: boolean;
  topicKey: string;
  stageKey?: string;
};

export type TodayBoardSelection = {
  hero: RichMarketRef | null;
  secondary: RichMarketRef[];
};

export type MarketStory = {
  eyebrow: string;
  whyItMatters: string;
  whatMovesIt: string;
  whatToWatch: string;
};

const ONE_DAY_SECONDS = 24n * 60n * 60n;

function categoryLabel(category: MarketCategory): string {
  if (category === 'chain') {
    return 'On-chain';
  }

  if (category === 'macro') {
    return 'Macro';
  }

  if (category === 'worldcup') {
    return 'World Cup';
  }

  return 'Crypto';
}

function assetKeyFromQuestion(question: string): string {
  const assetMatch = question.match(/\b([A-Z]{2,})\/USD\b/u);

  if (assetMatch) {
    return assetMatch[1]!;
  }

  const topicMatch = question.match(/^Will\s+(.+?)\s+be\s+/iu);

  if (topicMatch) {
    return topicMatch[1]!.trim().toLowerCase();
  }

  return question.toLowerCase().replace(/\s+/gu, ' ').trim();
}

function isEventRow(row: DashboardRow | WorldCupMarketRow): row is WorldCupMarketRow {
  return 'marketKind' in row && row.marketKind === 'event';
}

function isSettledPriceRow(row: DashboardRow): boolean {
  return OUTCOMES[row.market.outcome] !== 'Unresolved';
}

function isSettledEventRow(row: WorldCupMarketRow): boolean {
  return row.settledOutcome !== EVENT_UNRESOLVED_OUTCOME;
}

function statusLabelForRef({
  isClaimable,
  isSettled,
  isOpen,
  isClosingSoon,
}: {
  isClaimable: boolean;
  isSettled: boolean;
  isOpen: boolean;
  isClosingSoon: boolean;
}): RichMarketRef['statusLabel'] {
  if (isClaimable) {
    return 'Claimable now';
  }

  if (isSettled) {
    return 'Resolved';
  }

  if (isOpen && isClosingSoon) {
    return 'Closing soon';
  }

  if (isOpen) {
    return 'Open market';
  }

  return 'Closed';
}

function activityLabelForRef({
  hasPosition,
  themeId,
  isClosingSoon,
  liquidity,
}: {
  hasPosition: boolean;
  themeId?: string;
  isClosingSoon: boolean;
  liquidity: bigint;
}): string {
  if (hasPosition) {
    return 'Position live';
  }

  if (themeId) {
    return 'Theme spotlight';
  }

  if (isClosingSoon) {
    return 'Closing soon';
  }

  if (liquidity >= 150_000_000n) {
    return 'High liquidity';
  }

  return 'Live board';
}

function priceProbabilityLabel(row: DashboardRow): [number, string, string] {
  const yes = Math.round(yesPercent(row.market));
  return [yes, `YES ${yes}%`, `Pool skew YES ${yes}%`];
}

function eventProbabilityLabel(row: WorldCupMarketRow): [number, string, string] {
  const topOutcome = row.outcomes.reduce((best, outcome) =>
    outcome.impliedProbability > best.impliedProbability ? outcome : best,
  );
  const topProbability = Math.round(topOutcome.impliedProbability);
  return [
    topProbability,
    `Top outcome ${topProbability}%`,
    `Leading outcome ${topOutcome.label}`,
  ];
}

function topicStageKey(row: WorldCupMarketRow): string | undefined {
  if (row.themeId) {
    return row.themeId;
  }

  if (row.category === 'worldcup') {
    return row.stage;
  }

  return row.sourceId;
}

export function toRichMarketRef(row: DashboardRow | WorldCupMarketRow, now: bigint): RichMarketRef {
  if (isEventRow(row)) {
    const isSettled = isSettledEventRow(row);
    const isClaimable = row.pendingPayout > 0n && !row.claimed_;
    const isOpen = !isSettled && row.betDeadline > now;
    const isClosingSoon = isOpen && row.betDeadline - now <= ONE_DAY_SECONDS;
    const deploymentQuery = row.deploymentId
      ? `&deployment=${encodeURIComponent(row.deploymentId)}`
      : '';
    const [probabilityValue, probabilityLabel, skewLabel] = eventProbabilityLabel(row);

    return {
      id: row.id.toString(),
      marketKind: 'event',
      category: row.category,
      href: `/market/${row.id.toString()}?kind=event${deploymentQuery}`,
      title: row.question,
      question: row.question,
      themeLabel: categoryLabel(row.category),
      categoryLabel: categoryLabel(row.category),
      themeId: row.themeId,
      themeVisual: row.themeVisual,
      deadline: row.betDeadline,
      liquidity: row.liquidity,
      probabilityValue,
      probabilityLabel,
      skewLabel,
      status: isClaimable ? 'claimable' : isSettled ? 'resolved' : isOpen ? 'open' : 'closed',
      statusLabel: statusLabelForRef({ isClaimable, isSettled, isOpen, isClosingSoon }),
      activityLabel: activityLabelForRef({
        hasPosition: row.userOutcomeStakes.some((stake) => stake > 0n),
        themeId: row.themeId,
        isClosingSoon,
        liquidity: row.liquidity,
      }),
      hasPosition: row.userOutcomeStakes.some((stake) => stake > 0n),
      isOpen,
      isClosingSoon,
      isSettled,
      isClaimable,
      topicKey: assetKeyFromQuestion(row.question),
      stageKey: topicStageKey(row),
    };
  }

  const isSettled = isSettledPriceRow(row);
  const isClaimable = row.pendingPayout > 0n && !row.claimed_;
  const isOpen = !isSettled && row.market.betDeadline > now;
  const isClosingSoon = isOpen && row.market.betDeadline - now <= ONE_DAY_SECONDS;
  const [probabilityValue, probabilityLabel, skewLabel] = priceProbabilityLabel(row);
  const hasPosition = row.yesStake > 0n || row.noStake > 0n;

  return {
    id: row.id.toString(),
    marketKind: 'price',
    category: 'crypto',
    href: `/market/${row.id.toString()}`,
    title: row.market.question,
    question: row.market.question,
    themeLabel: assetKeyFromQuestion(row.market.question).toUpperCase(),
    categoryLabel: 'Crypto',
    deadline: row.market.betDeadline,
    liquidity: row.market.yesPool + row.market.noPool,
    probabilityValue,
    probabilityLabel,
    skewLabel,
    status: isClaimable ? 'claimable' : isSettled ? 'resolved' : isOpen ? 'open' : 'closed',
    statusLabel: statusLabelForRef({ isClaimable, isSettled, isOpen, isClosingSoon }),
    activityLabel: activityLabelForRef({
      hasPosition,
      isClosingSoon,
      liquidity: row.market.yesPool + row.market.noPool,
    }),
    hasPosition,
    isOpen,
    isClosingSoon,
    isSettled,
    isClaimable,
    topicKey: assetKeyFromQuestion(row.market.question),
  };
}

function takeUnique(markets: readonly RichMarketRef[], limit: number): RichMarketRef[] {
  const ids = new Set<string>();
  const selected: RichMarketRef[] = [];

  for (const market of markets) {
    if (ids.has(market.id)) {
      continue;
    }

    ids.add(market.id);
    selected.push(market);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

function byId(left: RichMarketRef, right: RichMarketRef): number {
  return Number(left.id) - Number(right.id);
}

function todayBoardScore(market: RichMarketRef): number {
  return (
    (market.hasPosition ? 1000 : 0) +
    (market.themeId ? 300 : 0) +
    (market.isClosingSoon ? 200 : 0) +
    Number(market.liquidity / 1_000_000n)
  );
}

function trendingScore(market: RichMarketRef): number {
  return (
    (market.hasPosition ? 120 : 0) +
    (market.themeId ? 80 : 0) +
    (market.isClosingSoon ? 30 : 0) +
    Number(market.liquidity / 1_000_000n)
  );
}

export function selectTodayBoard(markets: readonly RichMarketRef[], _now: bigint): TodayBoardSelection {
  const openMarkets = markets
    .filter((market) => market.isOpen)
    .sort((left, right) => todayBoardScore(right) - todayBoardScore(left) || byId(left, right));

  return {
    hero: openMarkets[0] ?? null,
    secondary: takeUnique(openMarkets.slice(1), 4),
  };
}

export function selectTrendingMarkets(markets: readonly RichMarketRef[], _now: bigint): RichMarketRef[] {
  return markets
    .filter((market) => market.isOpen)
    .sort((left, right) => trendingScore(right) - trendingScore(left) || byId(left, right));
}

export function selectClosingSoon(markets: readonly RichMarketRef[], _now: bigint): RichMarketRef[] {
  return markets
    .filter((market) => market.isOpen)
    .sort((left, right) => {
      if (left.deadline !== right.deadline) {
        return left.deadline < right.deadline ? -1 : 1;
      }

      return byId(left, right);
    });
}

export function selectRecentlyResolved(markets: readonly RichMarketRef[]): RichMarketRef[] {
  return markets
    .filter((market) => market.isClaimable || market.isSettled)
    .sort((left, right) => {
      if (left.isClaimable !== right.isClaimable) {
        return left.isClaimable ? -1 : 1;
      }

      if (left.deadline !== right.deadline) {
        return left.deadline > right.deadline ? -1 : 1;
      }

      return byId(left, right);
    });
}

export function deriveMarketStory(market: RichMarketRef): MarketStory {
  if (market.marketKind === 'price') {
    return {
      eyebrow: `${market.themeLabel} pulse`,
      whyItMatters: `${market.themeLabel} traders are pricing a clean binary move before the next market checkpoint.`,
      whatMovesIt:
        'Spot momentum, macro headlines, and fast pool rebalancing can change the implied line.',
      whatToWatch:
        'Watch the deadline, pool skew, and whether the YES side keeps control into the final hours.',
    };
  }

  if (market.category === 'chain') {
    return {
      eyebrow: 'On-chain flow',
      whyItMatters:
        'This on-chain market tracks whether liquidity, usage, and capital rotation can hold through the next checkpoint.',
      whatMovesIt:
        'liquidity migration, bridge demand, and TVL momentum usually move this board before the final print.',
      whatToWatch:
        'Watch the deadline, the leading outcome, and whether related chain themes keep confirming the same move.',
    };
  }

  if (market.category === 'macro') {
    return {
      eyebrow: 'Macro catalyst',
      whyItMatters:
        'This macro board compresses a noisy calendar into one tradable binary view for the next release window.',
      whatMovesIt:
        'Data surprises, policy language, and cross-asset risk appetite tend to move the pool fastest.',
      whatToWatch:
        'Watch the deadline, rate-sensitive headlines, and whether the lead outcome keeps widening.',
    };
  }

  return {
    eyebrow: 'Match context',
    whyItMatters:
      'This market packages a single outcome into a fast read on momentum, pricing confidence, and tournament context.',
    whatMovesIt:
      'Team news, schedule pressure, and liquidity rotation between related boards can move the line quickly.',
    whatToWatch:
      'Watch the deadline, top-outcome balance, and whether adjacent markets confirm the same read.',
  };
}

function relatedScore(current: RichMarketRef, candidate: RichMarketRef): number {
  let score = 0;

  if (candidate.themeId && candidate.themeId === current.themeId) {
    score += 300;
  }

  if (candidate.category === current.category) {
    score += 120;
  }

  if (candidate.topicKey === current.topicKey) {
    score += 80;
  }

  if (candidate.stageKey && candidate.stageKey === current.stageKey) {
    score += 40;
  }

  score += Number(candidate.liquidity / 1_000_000n);
  return score;
}

export function selectRelatedMarkets(
  current: RichMarketRef,
  allMarkets: readonly RichMarketRef[],
): RichMarketRef[] {
  return allMarkets
    .filter((market) => market.id !== current.id)
    .filter((market) =>
      market.category === current.category ||
      (!!current.themeId && market.themeId === current.themeId) ||
      market.topicKey === current.topicKey,
    )
    .sort((left, right) => relatedScore(current, right) - relatedScore(current, left) || byId(left, right));
}
