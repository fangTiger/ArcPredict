'use client';

import { useMemo, useState } from 'react';
import type { Abi } from 'viem';
import { zeroAddress } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { BetModal } from '@/components/BetModal';
import {
  MarketFilterBar,
  filterMarkets,
  type AssetFilter,
  type CadenceFilter,
} from '@/components/MarketFilterBar';
import { MarketCard } from '@/components/MarketCard';
import { NetworkBanner } from '@/components/NetworkBanner';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';
import { PYTH_PRICE_ID_TO_ASSET } from '@/lib/asset-price-map';
import { arcTestnet } from '@/lib/chain';
import type { DashboardRow } from '@/lib/derivePosition';
import { OUTCOMES } from '@/lib/derivePosition';

const predictionMarketAbi = PredictionMarketAbi as Abi;

type DashboardLatestResult = readonly [DashboardRow[], bigint];

type BetSelection = {
  row: DashboardRow;
  side: boolean;
};

export default function HomePage() {
  const { address } = useAccount();
  const user = address ?? zeroAddress;
  const [betting, setBetting] = useState<BetSelection | null>(null);
  const [asset, setAsset] = useState<AssetFilter>('all');
  const [cadence, setCadence] = useState<CadenceFilter>('all');

  const { data, isLoading, isError, refetch } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: predictionMarketAbi,
    functionName: 'getDashboardLatest',
    args: [user, 100n],
    chainId: arcTestnet.id,
    query: { refetchInterval: 5_000 },
  });

  const dashboardData = data as DashboardLatestResult | undefined;
  const rows = dashboardData?.[0] ?? [];
  const activeMarkets = rows.filter((row) => OUTCOMES[row.market.outcome] === 'Unresolved').map((row) => ({
    ...row,
    pythPriceId: row.market.pythPriceId,
    question: row.market.question,
  }));
  const visibleActiveMarkets = useMemo(
    () =>
      filterMarkets(activeMarkets, {
        asset,
        cadence,
        priceIdToAsset: PYTH_PRICE_ID_TO_ASSET,
      }),
    [activeMarkets, asset, cadence],
  );

  return (
    <>
      <NetworkBanner />
      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <MarketFilterBar
          asset={asset}
          cadence={cadence}
          onChange={({ asset: nextAsset, cadence: nextCadence }) => {
            setAsset(nextAsset);
            setCadence(nextCadence);
          }}
        />

        {isLoading ? (
          <div className="py-20 text-sm text-ink-2">正在读取最新市场，请稍候……</div>
        ) : isError ? (
          <div className="py-20 text-sm text-heat">首页数据读取失败，请稍后重试。</div>
        ) : activeMarkets.length === 0 ? (
          <div className="py-20 text-sm text-ink-2">当前没有未结算市场，等新市场发布后这里会自动出现。</div>
        ) : visibleActiveMarkets.length === 0 ? (
          <div className="py-20 text-sm text-ink-2">
            当前筛选条件下没有未结算市场，请切换 Asset 或 Cadence 后重试。
          </div>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {visibleActiveMarkets.map((row) => (
              <MarketCard
                key={row.id.toString()}
                row={row}
                onBet={(_id, side) => setBetting({ row, side })}
              />
            ))}
          </section>
        )}
      </main>

      <SiteFooter />

      {betting ? (
        <BetModal
          row={betting.row}
          side={betting.side}
          onClose={() => {
            setBetting(null);
            void refetch();
          }}
        />
      ) : null}
    </>
  );
}
