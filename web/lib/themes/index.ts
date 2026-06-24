import type { MarketCategory } from '../market-kind';
import type { ExternalKey } from '../markets/external-key';

export type ThemePackStatus = 'draft' | 'active' | 'archived';

export interface ThemePackRef {
  kind: 'category';
  category: MarketCategory;
  sourceId?: string;
  marketIds?: readonly string[];
  eventIds?: readonly `0x${string}`[];
  externalKeys?: readonly string[];
  externalKeyPatterns?: readonly string[];
  questionPatterns?: readonly string[];
}

export interface ThemePackRecord {
  themeId: string;
  title: string;
  description: string;
  weekStart: string;
  weekEnd: string;
  leadCategory: MarketCategory;
  shareCopy: string;
  refs: ThemePackRef[];
}

export interface ThemePack extends ThemePackRecord {
  status: ThemePackStatus;
}

export interface ThemeDraftLookup {
  category: MarketCategory;
  sourceId?: string;
  externalKey: ExternalKey;
}

const THEME_PACKS: ThemePackRecord[] = [
  {
    themeId: 'arc-summer-onchain',
    title: 'On-chain Summer Watch',
    description: 'Track weekly TVL milestones and liquidity rotation across core chains.',
    weekStart: '2026-06-22',
    weekEnd: '2026-06-28',
    leadCategory: 'chain',
    shareCopy: 'Follow the on-chain momentum pack on ArcPredict.',
    refs: [{
      kind: 'category',
      category: 'chain',
      sourceId: 'chain-event',
      externalKeyPatterns: [
        '^(?:eth|arb):tvl:gte:[0-9]+:2026-09-(?:20|21|22|23|24|25|26)$',
      ],
      questionPatterns: [
        '^Will (?:Ethereum|Arbitrum) TVL be >= \\$[0-9]+(?:\\.[0-9]+)?B by 2026-09-(?:20|21|22|23|24|25|26)\\?$',
      ],
    }],
  },
  {
    themeId: 'macro-catalyst-archive',
    title: 'Macro Catalyst Archive',
    description: 'A read-only archive of rate, inflation, and jobs catalysts from the prior cycle.',
    weekStart: '2026-06-15',
    weekEnd: '2026-06-21',
    leadCategory: 'macro',
    shareCopy: 'Revisit last week’s macro catalyst markets on ArcPredict.',
    refs: [{
      kind: 'category',
      category: 'macro',
      sourceId: 'fred-macro',
      externalKeys: ['CPIAUCSL:2026-06-15'],
    }],
  },
];

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function resolveThemeStatus(record: ThemePackRecord, now: Date): ThemePackStatus {
  const today = toDateOnly(now);

  if (today < record.weekStart) {
    return 'draft';
  }

  if (today > record.weekEnd) {
    return 'archived';
  }

  return 'active';
}

function withStatus(record: ThemePackRecord, now: Date): ThemePack {
  return {
    ...record,
    status: resolveThemeStatus(record, now),
  };
}

export function matchesPattern(patterns: readonly string[] | undefined, value: string): boolean {
  return patterns?.some((pattern) => new RegExp(pattern, 'u').test(value)) ?? false;
}

export function listThemePacks(now: Date = new Date()): ThemePack[] {
  return THEME_PACKS.map((record) => withStatus(record, now));
}

export function getThemePackById(themeId: string, now: Date = new Date()): ThemePack | undefined {
  return listThemePacks(now).find((record) => record.themeId === themeId);
}

export function getThemePackForDraft(
  draft: ThemeDraftLookup,
  now: Date = new Date(),
): ThemePack | undefined {
  return listThemePacks(now).find((record) =>
    record.status === 'active' &&
    record.refs.some((ref) => {
      if (ref.kind !== 'category' || ref.category !== draft.category) {
        return false;
      }

      if (ref.sourceId && ref.sourceId !== draft.sourceId) {
        return false;
      }

      return (
        ref.externalKeys?.includes(draft.externalKey) ||
        matchesPattern(ref.externalKeyPatterns, draft.externalKey)
      ) ?? false;
    }),
  );
}
