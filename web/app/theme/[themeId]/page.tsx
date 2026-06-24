'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import type { Abi } from 'viem';
import { zeroAddress } from 'viem';
import { useReadContracts } from 'wagmi';
import { NetworkBanner } from '@/components/NetworkBanner';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { ThemeMarketBoard } from '@/components/ThemeMarketBoard';
import EventMarketAbi from '@/lib/abis/EventMarket.json';
import { arcTestnet } from '@/lib/chain';
import {
  EVENT_MARKET_DEPLOYMENTS,
  attachDeploymentToEventRow,
} from '@/lib/markets/deployments';
import { getThemePackById } from '@/lib/themes';
import { getThemePackMarkets, toThemeMarketBoardEntries } from '@/lib/themes/markets';
import {
  resolveWorldCupMarkets,
  type EventMarketDashboardRow,
} from '@/lib/worldcup-markets';

const eventMarketAbi = EventMarketAbi as Abi;
type EventDashboardLatestResult = readonly [EventMarketDashboardRow[], bigint];
const nowInSeconds = () => BigInt(Math.floor(Date.now() / 1000));
const EVENT_DASHBOARD_LIMIT = 100n;

export default function ThemePackPage() {
  const params = useParams<{ themeId: string }>();
  const theme = useMemo(
    () => getThemePackById(params.themeId, new Date()),
    [params.themeId],
  );
  const { data: eventReadResults, isError } = useReadContracts({
    contracts: EVENT_MARKET_DEPLOYMENTS.map((deployment) => ({
      address: deployment.eventMarketAddress,
      abi: eventMarketAbi,
      functionName: 'getDashboardLatest',
      args: [zeroAddress, EVENT_DASHBOARD_LIMIT],
      chainId: arcTestnet.id,
    })),
    query: {
      enabled: Boolean(theme),
      refetchInterval: 10_000,
    },
  });

  const eventRows = useMemo(
    () =>
      EVENT_MARKET_DEPLOYMENTS.flatMap((deployment, index) => {
        const result = eventReadResults?.[index]?.result as EventDashboardLatestResult | undefined;
        return (result?.[0] ?? []).map((row) => attachDeploymentToEventRow(row, deployment));
      }),
    [eventReadResults],
  );
  const resolvedRows = useMemo(
    () => resolveWorldCupMarkets(eventRows),
    [eventRows],
  );
  const boardMarkets = useMemo(() => {
    if (!theme) {
      return [];
    }

    return toThemeMarketBoardEntries(
      getThemePackMarkets(theme, resolvedRows),
      nowInSeconds(),
    );
  }, [resolvedRows, theme]);

  return (
    <>
      <NetworkBanner />
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 lg:px-8">
        <div className="mb-6">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-ink-2 transition hover:text-ink"
          >
            <span aria-hidden>←</span> 返回首页
          </a>
        </div>

        {!theme ? (
          <section className="glass rounded-3xl p-6 text-sm text-ink-2">
            Theme pack not found.
          </section>
        ) : isError && boardMarkets.length === 0 ? (
          <section className="rounded-3xl border border-no/35 bg-no/10 p-6 text-sm text-no">
            Theme markets are unavailable right now. Please try again shortly.
          </section>
        ) : (
          <ThemeMarketBoard theme={theme} markets={boardMarkets} />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
