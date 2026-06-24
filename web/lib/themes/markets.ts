import type { MarketCategory } from '../market-kind';
import { computeMarketId } from '../markets/external-key';
import { matchesPattern, type ThemePack } from './index';

export interface ThemeMarketCandidate {
  id: bigint;
  category: MarketCategory;
  sourceId?: string;
  externalKey?: string;
  eventId?: `0x${string}`;
  themeId?: string;
  deploymentId?: string;
  question: string;
  betDeadline: bigint;
  settledOutcome: number;
  pendingPayout: bigint;
  claimed_: boolean;
}

export interface ThemeMarketBoardEntry {
  id: string;
  href: string;
  title: string;
  categoryLabel: string;
  statusLabel: string;
}

const UNRESOLVED_OUTCOME = 255;

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

function sortMarkets(left: ThemeMarketCandidate, right: ThemeMarketCandidate): number {
  if (left.settledOutcome === UNRESOLVED_OUTCOME && right.settledOutcome !== UNRESOLVED_OUTCOME) {
    return -1;
  }

  if (left.settledOutcome !== UNRESOLVED_OUTCOME && right.settledOutcome === UNRESOLVED_OUTCOME) {
    return 1;
  }

  if (left.betDeadline !== right.betDeadline) {
    return left.betDeadline < right.betDeadline ? -1 : 1;
  }

  return left.id < right.id ? -1 : 1;
}

function matchesSourceIdentity(
  refSourceId: string | undefined,
  marketSourceId: string | undefined,
): boolean {
  return !refSourceId || marketSourceId === refSourceId;
}

function matchesTheme(theme: ThemePack, market: ThemeMarketCandidate): boolean {
  const marketId = market.id.toString();
  const marketThemeId = market.themeId;
  const eventId = market.eventId;

  if (marketThemeId === theme.themeId) {
    return true;
  }

  return theme.refs.some((ref) => {
    if (ref.kind !== 'category') {
      return false;
    }

    if (ref.category !== market.category) {
      return false;
    }

    if (ref.marketIds?.includes(marketId)) {
      return true;
    }

    if (eventId && ref.eventIds?.includes(eventId)) {
      return true;
    }

    if (eventId && ref.sourceId && ref.externalKeys?.some((externalKey) => computeMarketId(ref.sourceId!, externalKey) === eventId)) {
      return true;
    }

    if (
      market.externalKey &&
      matchesSourceIdentity(ref.sourceId, market.sourceId) &&
      ref.externalKeys?.includes(market.externalKey)
    ) {
      return true;
    }

    if (
      market.externalKey &&
      matchesSourceIdentity(ref.sourceId, market.sourceId) &&
      matchesPattern(ref.externalKeyPatterns, market.externalKey)
    ) {
      return true;
    }

    if (
      matchesSourceIdentity(ref.sourceId, market.sourceId) &&
      matchesPattern(ref.questionPatterns, market.question)
    ) {
      return true;
    }

    return false;
  });
}

export function getThemePackMarkets<T extends ThemeMarketCandidate>(
  theme: ThemePack,
  markets: readonly T[],
): T[] {
  return markets.filter((market) => matchesTheme(theme, market)).sort(sortMarkets);
}

export function toThemeMarketBoardEntries(
  markets: readonly ThemeMarketCandidate[],
  now: bigint,
): ThemeMarketBoardEntry[] {
  return markets.map((market) => {
    const isOpen = market.settledOutcome === UNRESOLVED_OUTCOME && market.betDeadline > now;
    const canClaim = market.pendingPayout > 0n && !market.claimed_;
    const deploymentQuery = market.deploymentId
      ? `&deployment=${encodeURIComponent(market.deploymentId)}`
      : '';

    return {
      id: market.id.toString(),
      href: `/market/${market.id.toString()}?kind=event${deploymentQuery}`,
      title: market.question,
      categoryLabel: categoryLabel(market.category),
      statusLabel: canClaim ? 'Claimable' : isOpen ? 'Open market' : 'View market',
    };
  });
}
