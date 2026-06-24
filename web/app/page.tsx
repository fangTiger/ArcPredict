'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Abi } from 'viem';
import { zeroAddress } from 'viem';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { BetModal } from '@/components/BetModal';
import { ArcBackground } from '@/components/ArcBackground';
import { CryptoMarketCard } from '@/components/CryptoMarketCard';
import { EventBetModal } from '@/components/EventBetModal';
import { HomeHero } from '@/components/HomeHero';
import {
  MarketDiscoveryRail,
  TodayBoard,
} from '@/components/MarketDiscoveryRail';
import {
  MarketFilterBar,
  filterMarkets,
  type AssetFilter,
  type CadenceFilter,
} from '@/components/MarketFilterBar';
import { NetworkBanner } from '@/components/NetworkBanner';
import { PositionList } from '@/components/PositionList';
import { PositionStripe } from '@/components/PositionStripe';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { ThemeMarketBoard } from '@/components/ThemeMarketBoard';
import { WorldCupMarketCard } from '@/components/WorldCupMarketCard';
import EventMarketAbi from '@/lib/abis/EventMarket.json';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';
import { PYTH_PRICE_ID_TO_ASSET } from '@/lib/asset-price-map';
import { arcTestnet } from '@/lib/chain';
import type { DashboardRow } from '@/lib/derivePosition';
import { OUTCOMES } from '@/lib/derivePosition';
import { WORLDCUP_ENABLED } from '@/lib/feature-flags';
import {
  MARKET_PAGE_SIZE,
  nextVisibleMarketCount,
  sliceVisibleMarketRows,
} from '@/lib/market-pagination';
import {
  selectClosingSoon,
  selectRecentlyResolved,
  selectTodayBoard,
  selectTrendingMarkets,
  toRichMarketRef,
} from '@/lib/market-richness';
import {
  MARKET_CATEGORIES,
  normalizeWorldCupStageFilter,
  type MarketCategory,
  type WorldCupStageFilter,
} from '../lib/market-kind';
import { getThemePackById, listThemePacks } from '@/lib/themes';
import { getThemePackMarkets, toThemeMarketBoardEntries } from '@/lib/themes/markets';
import {
  EVENT_MARKET_DEPLOYMENTS,
  attachDeploymentToEventRow,
} from '@/lib/markets/deployments';
import {
  getUpcomingWorldCupMarkets,
  resolveWorldCupMarkets,
  type EventMarketDashboardRow,
  type WorldCupMarketRow,
} from '@/lib/worldcup-markets';

const predictionMarketAbi = PredictionMarketAbi as Abi;
const eventMarketAbi = EventMarketAbi as Abi;
const nowInSeconds = () => BigInt(Math.floor(Date.now() / 1000));
const EVENT_DASHBOARD_LIMIT = 100n;

type DashboardLatestResult = readonly [DashboardRow[], bigint];
type EventDashboardLatestResult = readonly [EventMarketDashboardRow[], bigint];

type BetSelection = {
  row: DashboardRow;
  side: boolean;
};

type EventBetSelection = {
  row: WorldCupMarketRow;
  outcomeIndex: number;
};

const SettledMarketList = dynamic<{ rows: DashboardRow[] }>(
  () =>
    import('@/components/Resolved' + 'List').then((module) => module['Resolved' + 'List']),
  { ssr: false },
);

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <>
          <NetworkBanner />
          <SiteHeader />
          <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
            <div className="py-20 text-sm text-ink-2">Preparing market filters...</div>
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
  const categoryParam = searchParams.get('category');
  const categoryFromQuery: MarketCategory = WORLDCUP_ENABLED
    ? categoryParam && MARKET_CATEGORIES.includes(categoryParam as MarketCategory)
      ? (categoryParam as MarketCategory)
      : 'worldcup'
    : 'crypto';
  const showAllPositions = searchParams.get('positions') === 'all';
  const stageFromQuery =
    categoryFromQuery === 'worldcup'
      ? normalizeWorldCupStageFilter(searchParams.get('stage'))
      : 'all';
  const [betting, setBetting] = useState<BetSelection | null>(null);
  const [eventBetting, setEventBetting] = useState<EventBetSelection | null>(null);
  const [category, setCategory] = useState<MarketCategory>(categoryFromQuery);
  const [stage, setStage] = useState<WorldCupStageFilter>(stageFromQuery);
  const [asset, setAsset] = useState<AssetFilter>('all');
  const [cadence, setCadence] = useState<CadenceFilter>('all');
  const [now, setNow] = useState<bigint>(() => nowInSeconds());
  const [visibleMarketCount, setVisibleMarketCount] = useState(MARKET_PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const positionsRef = useRef<HTMLElement | null>(null);
  const lastSyncedQueryStringRef = useRef(searchParams.toString());
  const showCategoryTabs = WORLDCUP_ENABLED;
  const effectiveCategory = showCategoryTabs ? category : 'crypto';
  const backgroundVariant = effectiveCategory === 'worldcup' ? 'pitch' : 'default';
  const hasEventMarket = WORLDCUP_ENABLED && EVENT_MARKET_DEPLOYMENTS.some(
    (deployment) => deployment.eventMarketAddress !== zeroAddress,
  );

  const { data, isLoading, isError, refetch } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: predictionMarketAbi,
    functionName: 'getDashboardLatest',
    args: [user, 100n],
    chainId: arcTestnet.id,
    query: { refetchInterval: 5_000 },
  });
  const { data: eventReadResults, refetch: refetchEvent } = useReadContracts({
    contracts: hasEventMarket
      ? EVENT_MARKET_DEPLOYMENTS.map((deployment) => ({
          address: deployment.eventMarketAddress,
          abi: eventMarketAbi,
          functionName: 'getDashboardLatest',
          args: [user, EVENT_DASHBOARD_LIMIT],
          chainId: arcTestnet.id,
        }))
      : [],
    query: {
      enabled: hasEventMarket,
      refetchInterval: 5_000,
    },
  });

  const dashboardData = data as DashboardLatestResult | undefined;
  const rows = useMemo(
    () => dashboardData?.[0] ?? [],
    [dashboardData],
  );
  const eventRows = useMemo(
    () =>
      EVENT_MARKET_DEPLOYMENTS.flatMap((deployment, index) => {
        const result = eventReadResults?.[index]?.result as EventDashboardLatestResult | undefined;
        return (result?.[0] ?? []).map((row) => attachDeploymentToEventRow(row, deployment));
      }),
    [eventReadResults],
  );
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
  const eventSourceMarkets = useMemo(
    () => resolveWorldCupMarkets(hasEventMarket ? eventRows : []),
    [eventRows, hasEventMarket],
  );
  const upcomingEventMarkets = useMemo(
    () => getUpcomingWorldCupMarkets(eventSourceMarkets, now),
    [eventSourceMarkets, now],
  );
  const pricePositionRows = useMemo(
    () => activeMarkets.map((row) => ({ ...row, marketKind: 'price' as const })),
    [activeMarkets],
  );
  const positionRows = useMemo(
    () => [...pricePositionRows, ...eventSourceMarkets],
    [eventSourceMarkets, pricePositionRows],
  );
  const positionKindFilter = showAllPositions
    ? undefined
    : effectiveCategory === 'crypto'
      ? 'price'
      : 'event';
  const allPositionsHref = useMemo(() => {
    const nextQuery = new URLSearchParams(searchParams.toString());
    nextQuery.set('positions', 'all');
    const query = nextQuery.toString();
    return query ? `/?${query}#positions` : '/#positions';
  }, [searchParams]);
  const visibleEventMarkets = useMemo(
    () => {
      if (effectiveCategory === 'crypto') {
        return [] as WorldCupMarketRow[];
      }

      return filterMarkets(upcomingEventMarkets, {
        category: effectiveCategory,
        stage: effectiveCategory === 'worldcup' ? stage : 'all',
        asset: 'all',
        cadence: 'all',
        priceIdToAsset: PYTH_PRICE_ID_TO_ASSET,
      });
    },
    [effectiveCategory, stage, upcomingEventMarkets],
  );
  const visibleMarketTotal =
    effectiveCategory === 'crypto'
      ? visibleCryptoMarkets.length
      : visibleEventMarkets.length;
  const renderedEventMarkets = useMemo(
    () => sliceVisibleMarketRows(visibleEventMarkets, visibleMarketCount),
    [visibleEventMarkets, visibleMarketCount],
  );
  const renderedCryptoMarkets = useMemo(
    () => sliceVisibleMarketRows(visibleCryptoMarkets, visibleMarketCount),
    [visibleCryptoMarkets, visibleMarketCount],
  );
  const canLoadMoreMarkets = visibleMarketCount < visibleMarketTotal;
  const featuredTheme = useMemo(() => {
    const activeThemeId = listThemePacks(new Date()).find((pack) => pack.status === 'active')?.themeId;
    return activeThemeId ? getThemePackById(activeThemeId, new Date()) : undefined;
  }, []);
  const featuredThemeMarkets = useMemo(() => {
    if (!featuredTheme) {
      return [];
    }

    return toThemeMarketBoardEntries(
      getThemePackMarkets(featuredTheme, upcomingEventMarkets),
      now,
    );
  }, [featuredTheme, now, upcomingEventMarkets]);
  const richSectionMarkets = useMemo(() => {
    if (effectiveCategory === 'crypto') {
      return rows.map((row) => toRichMarketRef(row, now));
    }

    return filterMarkets(eventSourceMarkets, {
      category: effectiveCategory,
      stage: effectiveCategory === 'worldcup' ? stage : 'all',
      asset: 'all',
      cadence: 'all',
      priceIdToAsset: PYTH_PRICE_ID_TO_ASSET,
    }).map((row) => toRichMarketRef(row, now));
  }, [effectiveCategory, eventSourceMarkets, now, rows, stage]);
  const todayBoard = useMemo(
    () => selectTodayBoard(richSectionMarkets, now),
    [richSectionMarkets, now],
  );
  const trendingMarkets = useMemo(
    () => selectTrendingMarkets(richSectionMarkets, now).slice(0, 3),
    [richSectionMarkets, now],
  );
  const closingSoonMarkets = useMemo(
    () => selectClosingSoon(richSectionMarkets, now).slice(0, 3),
    [richSectionMarkets, now],
  );
  const recentlyResolvedMarkets = useMemo(
    () => selectRecentlyResolved(richSectionMarkets).slice(0, 3),
    [richSectionMarkets],
  );

  useEffect(() => {
    setVisibleMarketCount(MARKET_PAGE_SIZE);
  }, [asset, cadence, effectiveCategory, stage]);

  useEffect(() => {
    if (showAllPositions || !canLoadMoreMarkets || !loadMoreRef.current) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        setVisibleMarketCount((currentCount) =>
          nextVisibleMarketCount(visibleMarketTotal, currentCount),
        );
      },
      { rootMargin: '260px 0px' },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [
    canLoadMoreMarkets,
    effectiveCategory,
    showAllPositions,
    visibleMarketCount,
    visibleMarketTotal
  ]);

  useEffect(() => {
    if (!showAllPositions) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (!positionsRef.current) {
        return;
      }

      const targetTop = positionsRef.current.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [showAllPositions]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(nowInSeconds());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

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
    const queryChangedOutsideState = lastSyncedQueryStringRef.current !== currentQuery;

    if (queryChangedOutsideState) {
      lastSyncedQueryStringRef.current = currentQuery;

      const stateMatchesQuery =
        !showCategoryTabs ||
        (effectiveCategory === categoryFromQuery &&
          (effectiveCategory !== 'worldcup' || stage === stageFromQuery));

      if (!stateMatchesQuery) {
        return;
      }
    }

    const nextQuery = new URLSearchParams(currentQuery);

    if (!showCategoryTabs) {
      nextQuery.delete('category');
      nextQuery.delete('stage');
    } else if (effectiveCategory === 'worldcup') {
      nextQuery.delete('category');
      if (stage === 'all') {
        nextQuery.delete('stage');
      } else {
        nextQuery.set('stage', stage);
      }
    } else {
      nextQuery.set('category', effectiveCategory);
      nextQuery.delete('stage');
    }

    const nextQueryString = nextQuery.toString();
    if (nextQueryString === currentQuery) {
      return;
    }

    lastSyncedQueryStringRef.current = nextQueryString;
    router.replace(nextQueryString ? `/?${nextQueryString}` : '/', { scroll: false });
  }, [
    categoryFromQuery,
    effectiveCategory,
    router,
    searchParams,
    showCategoryTabs,
    stage,
    stageFromQuery,
  ]);

  return (
    <>
      <NetworkBanner />
      <SiteHeader
        allPositionsHref={allPositionsHref}
        allPositionsActive={showAllPositions}
      />

      <main id="markets" className="relative z-10 mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <ArcBackground variant={backgroundVariant} />
        <HomeHero
          category={effectiveCategory}
          stats={{
            activeMarkets: activeMarkets.length + upcomingEventMarkets.length,
            totalVolumeUsdc: '—',
            pendingResolution: rows.filter((r) => OUTCOMES[r.market.outcome] === 'Unresolved').length,
          }}
        />
        <TodayBoard board={todayBoard} />
        {featuredTheme ? (
          <div className="mb-6">
            <ThemeMarketBoard
              theme={featuredTheme}
              markets={featuredThemeMarkets}
            />
          </div>
        ) : null}
        <MarketDiscoveryRail
          trending={trendingMarkets}
          closingSoon={closingSoonMarkets}
          recentlyResolved={recentlyResolvedMarkets}
        />
        <MarketFilterBar
          asset={asset}
          cadence={cadence}
          category={category}
          stage={stage}
          showCategoryTabs={showCategoryTabs}
          onCategoryChange={(nextCategory) => {
            setCategory(nextCategory);
            if (nextCategory !== 'worldcup') {
              setStage('all');
            }
          }}
          onStageChange={setStage}
          onChange={({ asset: nextAsset, cadence: nextCadence }) => {
            setAsset(nextAsset);
            setCadence(nextCadence);
          }}
        />

        {!showAllPositions ? (
          <PositionStripe
            rows={positionRows}
            kindFilter={positionKindFilter}
            allPositionsHref={allPositionsHref}
          />
        ) : null}

        {effectiveCategory === 'crypto' && isLoading ? (
          <div className="py-20 text-sm text-ink-2">Loading the latest markets...</div>
        ) : effectiveCategory === 'crypto' && isError ? (
          <div className="py-20 text-sm text-heat">Unable to load markets. Please try again shortly.</div>
        ) : effectiveCategory === 'crypto' && activeMarkets.length === 0 ? (
          <div className="py-20 text-sm text-ink-2">No unresolved markets are available yet.</div>
        ) : effectiveCategory === 'crypto' && visibleCryptoMarkets.length === 0 ? (
          <div className="py-20 text-sm text-ink-2">
            No unresolved markets match these filters. Try another asset or cadence.
          </div>
        ) : effectiveCategory === 'worldcup' && visibleEventMarkets.length === 0 ? (
          <div className="py-20 text-sm text-ink-2">
            No World Cup markets match this stage. Try another stage.
          </div>
        ) : effectiveCategory === 'macro' && visibleEventMarkets.length === 0 ? (
          <div className="py-20 text-sm text-ink-2">
            No Macro markets are available yet.
          </div>
        ) : effectiveCategory === 'chain' && visibleEventMarkets.length === 0 ? (
          <div className="py-20 text-sm text-ink-2">
            No On-chain markets are available yet.
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {effectiveCategory === 'worldcup'
              ? renderedEventMarkets.map((row) => (
                  <WorldCupMarketCard
                    key={row.id.toString()}
                    row={row}
                    onBet={(nextRow, outcomeIndex) => setEventBetting({ row: nextRow, outcomeIndex })}
                  />
                ))
              : effectiveCategory === 'crypto'
                ? renderedCryptoMarkets.map((row) => (
                    <CryptoMarketCard
                      key={row.id.toString()}
                      row={row}
                      onBet={(_id, side) => setBetting({ row, side })}
                    />
                  ))
                : renderedEventMarkets.map((row) => (
                    <WorldCupMarketCard
                      key={row.id.toString()}
                      row={row}
                      onBet={(nextRow, outcomeIndex) => setEventBetting({ row: nextRow, outcomeIndex })}
                    />
                  ))}
          </section>
        )}

        {visibleMarketTotal > MARKET_PAGE_SIZE ? (
          <div
            ref={loadMoreRef}
            className="mt-8 flex flex-col items-center gap-3"
            aria-live="polite"
          >
            {canLoadMoreMarkets ? (
              <button
                type="button"
                onClick={() => setVisibleMarketCount((currentCount) => nextVisibleMarketCount(visibleMarketTotal, currentCount))}
                className="inline-flex items-center gap-2 rounded-full border border-hair bg-bg-1/55 px-4 py-2 text-xs uppercase text-ink-2 backdrop-blur transition hover:border-arc-glow/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0"
              >
                加载更多
                <span aria-hidden="true">↓</span>
              </button>
            ) : null}
            <div className="font-mono text-xs uppercase text-ink-3">
              {Math.min(visibleMarketCount, visibleMarketTotal)} / {visibleMarketTotal} markets
            </div>
          </div>
        ) : null}

        {effectiveCategory === 'worldcup' && !hasEventMarket ? (
          <div className="mt-4 text-xs text-ink-2">
            EventMarket is not configured yet, so temporary World Cup skeleton markets are shown.
          </div>
        ) : null}

        <section
          id="positions"
          ref={positionsRef}
          className="mt-8 grid scroll-mt-28 grid-cols-1 gap-5 lg:grid-cols-2"
        >
          <PositionList rows={positionRows} kindFilter={positionKindFilter} />
          <SettledMarketList rows={rows} />
        </section>
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
      {eventBetting ? (
        <EventBetModal
          row={eventBetting.row}
          outcomeIndex={eventBetting.outcomeIndex}
          onClose={() => {
            setEventBetting(null);
            void refetchEvent();
          }}
        />
      ) : null}
    </>
  );
}
