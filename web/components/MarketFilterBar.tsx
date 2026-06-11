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
  'rounded-full border px-3 py-1.5 text-sm transition-colors transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200';

const activeButtonClassName = `${baseButtonClassName} border-blue-600 bg-blue-600 text-white`;
const inactiveButtonClassName =
  `${baseButtonClassName} border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50`;

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
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase text-slate-500">Asset</span>
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

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase text-slate-500">Cadence</span>
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
