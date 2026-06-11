'use client';

import { parseCadenceTag, type Cadence } from '../lib/cadence-tag';

export type Asset = 'BTC' | 'ETH' | 'SOL';
export type AssetFilter = Asset | 'all';
export type CadenceFilter = Cadence | 'all';

type FilterMarketInput = {
  id: number | bigint;
  pythPriceId: string;
  question: string;
};

type FilterOptions = {
  asset: AssetFilter;
  cadence: CadenceFilter;
  priceIdToAsset: Record<string, Asset>;
};

type Props = {
  asset: AssetFilter;
  cadence: CadenceFilter;
  onChange: (next: { asset: AssetFilter; cadence: CadenceFilter }) => void;
};

const assetOptions: AssetFilter[] = ['all', 'BTC', 'ETH', 'SOL'];
const cadenceOptions: CadenceFilter[] = ['all', 'daily', 'weekly', 'monthly', 'quarterly'];

const baseButtonClassName =
  'rounded-[12px] border border-transparent px-3.5 py-[7px] text-sm font-medium text-ink-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc/20';

const activeButtonClassName = `${baseButtonClassName} bg-ink text-paper`;
const inactiveButtonClassName =
  `${baseButtonClassName} hover:border-hair hover:bg-paper hover:text-ink`;

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
  return markets.filter((market) => {
    if (opts.asset !== 'all') {
      const asset = opts.priceIdToAsset[market.pythPriceId.toLowerCase()];
      if (asset !== opts.asset) {
        return false;
      }
    }

    if (opts.cadence !== 'all') {
      const cadence = parseCadenceTag(market.question);
      if (cadence !== opts.cadence) {
        return false;
      }
    }

    return true;
  });
}

export function MarketFilterBar({ asset, cadence, onChange }: Props) {
  return (
    <div className="my-10 flex flex-wrap items-center gap-6 border-y border-hair px-2 py-3">
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
  );
}
