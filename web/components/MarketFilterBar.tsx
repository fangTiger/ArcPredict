'use client';

import {
  MARKET_CATEGORIES,
  type MarketCategory,
  type WorldCupStageFilter,
} from '../lib/market-kind';
import { parseCadenceTag, type Cadence } from '../lib/cadence-tag';

export type Asset = 'BTC' | 'ETH' | 'SOL';
export type AssetFilter = Asset | 'all';
export type CadenceFilter = Cadence | 'all';

type FilterMarketInput = {
  id: number | bigint;
  pythPriceId?: string;
  question?: string;
  category?: MarketCategory;
  stage?: Exclude<WorldCupStageFilter, 'all'>;
};

type FilterOptions = {
  asset: AssetFilter;
  cadence: CadenceFilter;
  priceIdToAsset: Record<string, Asset>;
  category?: MarketCategory;
  stage?: WorldCupStageFilter;
};

type Props = {
  asset: AssetFilter;
  cadence: CadenceFilter;
  category?: MarketCategory;
  stage?: WorldCupStageFilter;
  showCategoryTabs?: boolean;
  onCategoryChange?: (next: MarketCategory) => void;
  onStageChange?: (next: WorldCupStageFilter) => void;
  onChange: (next: { asset: AssetFilter; cadence: CadenceFilter }) => void;
};

const assetOptions: AssetFilter[] = ['all', 'BTC', 'ETH', 'SOL'];
const cadenceOptions: CadenceFilter[] = ['all', 'daily', 'weekly', 'monthly', 'quarterly'];
const categoryDisplayLabels: Record<MarketCategory, string> = {
  crypto: 'Crypto',
  worldcup: 'World Cup',
  macro: 'Macro',
  chain: 'On-chain',
};
const categoryOptions: { value: MarketCategory; label: string }[] = MARKET_CATEGORIES.map((value) => ({
  value,
  label: categoryDisplayLabels[value],
}));
const stageOptions: WorldCupStageFilter[] = ['all', 'group', 'r16', 'qf', 'sf', 'final', 'winner'];
const stageDisplayLabels: Record<WorldCupStageFilter, string> = {
  all: 'All',
  group: 'Group',
  r16: 'R16',
  qf: 'QF',
  sf: 'SF',
  final: 'Final',
  winner: 'Winner',
};

const baseButtonClassName =
  'rounded-full border px-3.5 py-[7px] text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0';

const activeButtonClassName =
  `${baseButtonClassName} border-arc-glow/40 bg-arc/15 text-arc-glow shadow-[0_0_24px_-8px_rgba(77,168,255,0.6)]`;
const inactiveButtonClassName =
  `${baseButtonClassName} border-hair text-ink-2 hover:border-arc-glow/30 hover:text-ink hover:bg-arc/5`;

function buttonClassName(active: boolean): string {
  return active ? activeButtonClassName : inactiveButtonClassName;
}

function cadenceLabel(value: CadenceFilter): string {
  if (value === 'all') {
    return 'All';
  }

  return value[0].toUpperCase() + value.slice(1);
}

function assetLabel(value: AssetFilter): string {
  return value === 'all' ? 'All' : value;
}

export function filterMarkets<T extends FilterMarketInput>(
  markets: T[],
  opts: FilterOptions,
): T[] {
  const category = opts.category ?? 'crypto';

  return markets.filter((market) => {
    if ((market.category ?? 'crypto') !== category) {
      return false;
    }

    if (category === 'worldcup') {
      if (opts.stage && opts.stage !== 'all' && market.stage !== opts.stage) {
        return false;
      }

      if ((!opts.stage || opts.stage === 'all') && market.stage === 'winner') {
        return false;
      }

      return true;
    }

    if (category !== 'crypto') {
      return true;
    }

    if (opts.asset !== 'all') {
      const asset = market.pythPriceId
        ? opts.priceIdToAsset[market.pythPriceId.toLowerCase()]
        : undefined;
      if (asset !== opts.asset) {
        return false;
      }
    }

    if (opts.cadence !== 'all') {
      const cadence = market.question ? parseCadenceTag(market.question) : 'unknown';
      if (cadence !== opts.cadence) {
        return false;
      }
    }

    return true;
  });
}

function categoryLabel(value: MarketCategory): string {
  return categoryDisplayLabels[value];
}

function stageLabel(value: WorldCupStageFilter): string {
  return stageDisplayLabels[value];
}

export function MarketFilterBar({
  asset,
  cadence,
  category = 'crypto',
  stage = 'all',
  showCategoryTabs = false,
  onCategoryChange,
  onStageChange,
  onChange,
}: Props) {
  const handleCategoryChange = (next: MarketCategory) => {
    if (onCategoryChange) {
      onCategoryChange(next);
    }
  };

  const handleStageChange = (next: WorldCupStageFilter) => {
    if (onStageChange) {
      onStageChange(next);
    }
  };

  return (
    <div className="my-10 border-y border-hair px-2 py-3">
      {showCategoryTabs ? (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="Market categories">
          {categoryOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              onClick={() => handleCategoryChange(option.value)}
              className={buttonClassName(option.value === category)}
              aria-selected={option.value === category}
            >
              {categoryLabel(option.value)}
            </button>
          ))}
        </div>
      ) : null}

      {category === 'worldcup' ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase text-ink-2">Stage</span>
          <div className="flex flex-wrap items-center gap-2">
            {stageOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleStageChange(option)}
                className={buttonClassName(option === stage)}
                aria-pressed={option === stage}
              >
                {stageLabel(option)}
              </button>
            ))}
          </div>
        </div>
      ) : category === 'crypto' ? (
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase text-ink-2">Asset</span>
            <div className="flex flex-wrap items-center gap-2">
              {assetOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onChange({ asset: option, cadence })}
                  className={buttonClassName(option === asset)}
                  aria-pressed={option === asset}
                >
                  {assetLabel(option)}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-6 bg-hair" aria-hidden="true" />

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase text-ink-2">Cadence</span>
            <div className="flex flex-wrap items-center gap-2">
              {cadenceOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onChange({ asset, cadence: option })}
                  className={buttonClassName(option === cadence)}
                  aria-pressed={option === cadence}
                >
                  {cadenceLabel(option)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
