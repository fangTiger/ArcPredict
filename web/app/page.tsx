'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Abi } from 'viem';
import { zeroAddress } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { BetModal } from '@/components/BetModal';
import { ArcBackground } from '@/components/ArcBackground';
import { CryptoMarketCard } from '@/components/CryptoMarketCard';
import {
  MarketFilterBar,
  filterMarkets,
  type AssetFilter,
  type CadenceFilter,
} from '@/components/MarketFilterBar';
import { NetworkBanner } from '@/components/NetworkBanner';
import { PositionList } from '@/components/PositionList';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { WorldCupMarketCard } from '@/components/WorldCupMarketCard';
import EventMarketAbi from '@/lib/abis/EventMarket.json';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import {
  EVENT_MARKET_ADDRESS,
  PREDICTION_MARKET_ADDRESS,
} from '@/lib/addresses';
import { PYTH_PRICE_ID_TO_ASSET } from '@/lib/asset-price-map';
import { arcTestnet } from '@/lib/chain';
import type { DashboardRow } from '@/lib/derivePosition';
import { OUTCOMES } from '@/lib/derivePosition';
import { WORLDCUP_ENABLED } from '@/lib/feature-flags';
import {
  normalizeWorldCupStageFilter,
  type MarketCategory,
  type WorldCupStageFilter,
} from '@/lib/market-kind';
import {
  resolveWorldCupMarkets,
  type EventMarketDashboardRow,
} from '@/lib/worldcup-markets';

const predictionMarketAbi = PredictionMarketAbi as Abi;
const eventMarketAbi = EventMarketAbi as Abi;

type DashboardLatestResult = readonly [DashboardRow[], bigint];
type EventDashboardLatestResult = readonly [EventMarketDashboardRow[], bigint];

type BetSelection = {
  row: DashboardRow;
  side: boolean;
};

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <>
          <NetworkBanner />
          <SiteHeader />
          <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
            <div className="py-20 text-sm text-ink-2">正在准备首页筛选参数，请稍候……</div>
          </main>
          <SiteFooter />
        </>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address } = useAccount();
  const user = address ?? zeroAddress;
  const categoryFromQuery =
    searchParams.get('category') === 'worldcup' && WORLDCUP_ENABLED ? 'worldcup' : 'crypto';
  const showAllPositions = searchParams.get('positions') === 'all';
  const stageFromQuery =
    categoryFromQuery === 'worldcup'
      ? normalizeWorldCupStageFilter(searchParams.get('stage'))
      : 'all';
  const [betting, setBetting] = useState<BetSelection | null>(null);
  const [category, setCategory] = useState<MarketCategory>(categoryFromQuery);
  const [stage, setStage] = useState<WorldCupStageFilter>(stageFromQuery);
  const [asset, setAsset] = useState<AssetFilter>('all');
  const [cadence, setCadence] = useState<CadenceFilter>('all');
  const showCategoryTabs = WORLDCUP_ENABLED;
  const effectiveCategory = showCategoryTabs ? category : 'crypto';
  const backgroundVariant = effectiveCategory === 'worldcup' ? 'pitch' : 'default';
  const hasEventMarket = WORLDCUP_ENABLED && EVENT_MARKET_ADDRESS !== zeroAddress;

  const { data, isLoading, isError, refetch } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: predictionMarketAbi,
    functionName: 'getDashboardLatest',
    args: [user, 100n],
    chainId: arcTestnet.id,
    query: { refetchInterval: 5_000 },
  });
  const { data: eventData } = useReadContract({
    address: EVENT_MARKET_ADDRESS,
    abi: eventMarketAbi,
    functionName: 'getDashboardLatest',
    args: [user, 100n],
    chainId: arcTestnet.id,
    query: {
      enabled: hasEventMarket,
      refetchInterval: 5_000,
    },
  });

  const dashboardData = data as DashboardLatestResult | undefined;
  const eventDashboardData = eventData as EventDashboardLatestResult | undefined;
  const rows = dashboardData?.[0] ?? [];
  const eventRows = useMemo(() => eventDashboardData?.[0] ?? [], [eventDashboardData]);
  const activeMarkets = rows.filter((row) => OUTCOMES[row.market.outcome] === 'Unresolved').map((row) => ({
    ...row,
    pythPriceId: row.market.pythPriceId,
    question: row.market.question,
    category: 'crypto' as const,
  }));
  const visibleCryptoMarkets = useMemo(
    () =>
      filterMarkets(activeMarkets, {
        category: 'crypto',
        asset,
        cadence,
        priceIdToAsset: PYTH_PRICE_ID_TO_ASSET,
      }),
    [activeMarkets, asset, cadence],
  );
  const worldCupSourceMarkets = useMemo(
    () => resolveWorldCupMarkets(hasEventMarket ? eventRows : []),
    [eventRows, hasEventMarket],
  );
  const pricePositionRows = useMemo(
    () => activeMarkets.map((row) => ({ ...row, marketKind: 'price' as const })),
    [activeMarkets],
  );
  const positionRows = useMemo(
    () => [...pricePositionRows, ...worldCupSourceMarkets],
    [pricePositionRows, worldCupSourceMarkets],
  );
  const positionKindFilter = showAllPositions
    ? undefined
    : effectiveCategory === 'worldcup'
      ? 'event'
      : 'price';
  const allPositionsHref = useMemo(() => {
    const nextQuery = new URLSearchParams(searchParams.toString());
    nextQuery.set('positions', 'all');
    const query = nextQuery.toString();
    return query ? `/?${query}` : '/';
  }, [searchParams]);
  const visibleWorldCupMarkets = useMemo(
    () =>
      filterMarkets(worldCupSourceMarkets, {
        category: 'worldcup',
        stage,
        asset: 'all',
        cadence: 'all',
        priceIdToAsset: PYTH_PRICE_ID_TO_ASSET,
      }),
    [stage, worldCupSourceMarkets],
  );

  useEffect(() => {
    if (!showCategoryTabs) {
      setCategory((currentCategory) => (currentCategory === 'crypto' ? currentCategory : 'crypto'));
      setStage((currentStage) => (currentStage === 'all' ? currentStage : 'all'));
      return;
    }

    setCategory((currentCategory) =>
      currentCategory === categoryFromQuery ? currentCategory : categoryFromQuery,
    );
    setStage((currentStage) => (currentStage === stageFromQuery ? currentStage : stageFromQuery));
  }, [categoryFromQuery, showCategoryTabs, stageFromQuery]);

  useEffect(() => {
    const currentQuery = searchParams.toString();
    const nextQuery = new URLSearchParams(currentQuery);

    if (!showCategoryTabs || effectiveCategory === 'crypto') {
      nextQuery.delete('category');
      nextQuery.delete('stage');
    } else {
      nextQuery.set('category', 'worldcup');
      if (stage === 'all') {
        nextQuery.delete('stage');
      } else {
        nextQuery.set('stage', stage);
      }
    }

    const nextQueryString = nextQuery.toString();
    if (nextQueryString === currentQuery) {
      return;
    }

    router.replace(nextQueryString ? `/?${nextQueryString}` : '/', { scroll: false });
  }, [effectiveCategory, router, searchParams, showCategoryTabs, stage]);

  return (
    <>
      <NetworkBanner />
      <SiteHeader
        allPositionsHref={allPositionsHref}
        allPositionsActive={showAllPositions}
      />

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <ArcBackground variant={backgroundVariant} />
        <MarketFilterBar
          asset={asset}
          cadence={cadence}
          category={category}
          stage={stage}
          showCategoryTabs={showCategoryTabs}
          onCategoryChange={(nextCategory) => {
            setCategory(nextCategory);
            if (nextCategory === 'crypto') {
              setStage('all');
            }
          }}
          onStageChange={setStage}
          onChange={({ asset: nextAsset, cadence: nextCadence }) => {
            setAsset(nextAsset);
            setCadence(nextCadence);
          }}
        />

        {effectiveCategory === 'crypto' && isLoading ? (
          <div className="py-20 text-sm text-ink-2">正在读取最新市场，请稍候……</div>
        ) : effectiveCategory === 'crypto' && isError ? (
          <div className="py-20 text-sm text-heat">首页数据读取失败，请稍后重试。</div>
        ) : effectiveCategory === 'crypto' && activeMarkets.length === 0 ? (
          <div className="py-20 text-sm text-ink-2">当前没有未结算市场，等新市场发布后这里会自动出现。</div>
        ) : effectiveCategory === 'crypto' && visibleCryptoMarkets.length === 0 ? (
          <div className="py-20 text-sm text-ink-2">
            当前筛选条件下没有未结算市场，请切换 Asset 或 Cadence 后重试。
          </div>
        ) : effectiveCategory === 'worldcup' && visibleWorldCupMarkets.length === 0 ? (
          <div className="py-20 text-sm text-ink-2">
            当前阶段下没有 World Cup 市场，请切换 Stage 后重试。
          </div>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {effectiveCategory === 'worldcup'
              ? visibleWorldCupMarkets.map((row) => (
                  <WorldCupMarketCard key={row.id.toString()} row={row} />
                ))
              : visibleCryptoMarkets.map((row) => (
                  <CryptoMarketCard
                    key={row.id.toString()}
                    row={row}
                    onBet={(_id, side) => setBetting({ row, side })}
                  />
                ))}
          </section>
        )}

        {effectiveCategory === 'worldcup' && !hasEventMarket ? (
          <div className="mt-4 text-xs text-ink-2">
            当前 EventMarket 仍未部署，先使用临时 World Cup skeleton 数据渲染列表。
          </div>
        ) : null}

        <PositionList rows={positionRows} kindFilter={positionKindFilter} />
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
