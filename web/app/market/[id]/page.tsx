'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import type { Abi } from 'viem';
import { maxUint256, parseAbiItem, zeroAddress } from 'viem';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { BetModal } from '@/components/BetModal';
import { EventBetModal } from '@/components/EventBetModal';
import { MarketDetailCard } from '@/components/MarketDetailCard';
import { NetworkBanner } from '@/components/NetworkBanner';
import { SeedDisclosure, sumSeedContribution } from '@/components/SeedDisclosure';
import { WalletPill } from '@/components/WalletPill';
import EventMarketAbi from '@/lib/abis/EventMarket.json';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import {
  EVENT_MARKET_ADDRESS,
  PREDICTION_MARKET_ADDRESS,
} from '@/lib/addresses';
import { FRONTEND_DEPLOY_BLOCK } from '@/lib/asset-price-map';
import { fetchLogsPaged } from '@/lib/bet-event-scan';
import { arcTestnet } from '@/lib/chain';
import { WORLDCUP_ENABLED } from '@/lib/feature-flags';
import { isPhase16Enabled } from '@/lib/phase16-flag';
import { SEED_WALLETS } from '@/lib/seed-wallets';
import {
  WORLDCUP_SKELETON_MARKETS,
  resolveWorldCupOnchainMarketId,
  resolveWorldCupMarkets,
  type WorldCupMarketRow,
} from '@/lib/worldcup-markets';

const eventMarketAbi = EventMarketAbi as Abi;
const predictionMarketAbi = PredictionMarketAbi as Abi;
const MAX_MARKET_ID = maxUint256;
const betEvent = parseAbiItem(
  'event Bet(uint256 indexed id, address indexed user, bool yes, uint128 amount, uint128 yesPoolAfter, uint128 noPoolAfter)',
);

type DetailMarketRow = ComponentProps<typeof MarketDetailCard>['row'];
type MarketRow = Exclude<DetailMarketRow, WorldCupMarketRow>;
type EventRow = Extract<DetailMarketRow, WorldCupMarketRow>;
type DashboardResult = readonly [MarketRow[], bigint];
type EventRowsInput = Parameters<typeof resolveWorldCupMarkets>[0];
type EventDashboardResult = readonly [EventRowsInput, bigint];
type BetSelection = {
  row: MarketRow;
  side: boolean;
};
type EventBetSelection = {
  row: EventRow;
  outcomeIndex: number;
};
type SeedBetEvent = {
  user: `0x${string}`;
  amount: bigint;
};
type SeedBetLog = {
  args?: {
    user?: `0x${string}`;
    amount?: bigint;
  };
};

function parseMarketId(value: string | undefined): bigint | null {
  const trimmed = value?.trim() ?? '';

  if (!trimmed || !/^\d+$/u.test(trimmed)) {
    return null;
  }

  try {
    const parsed = BigInt(trimmed);

    if (parsed >= MAX_MARKET_ID) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isInvalidMarketError(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as {
    name?: string;
    shortMessage?: string;
    message?: string;
    cause?: { message?: string };
  };
  const combined = [
    maybeError.name,
    maybeError.shortMessage,
    maybeError.message,
    maybeError.cause?.message,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return combined.includes('invalidmarketid');
}

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeId = params.id;
  const kind = searchParams.get('kind') === 'event' ? 'event' : 'price';
  const requestedKind = kind;
  const idBn = parseMarketId(routeId);
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const user = address ?? zeroAddress;
  const [betting, setBetting] = useState<BetSelection | null>(null);
  const [eventBetting, setEventBetting] = useState<EventBetSelection | null>(null);
  const [seedBetEvents, setSeedBetEvents] = useState<SeedBetEvent[] | undefined>(undefined);
  const hasEventMarket = WORLDCUP_ENABLED && EVENT_MARKET_ADDRESS !== zeroAddress;
  const contractIdBn =
    requestedKind === 'event' && idBn !== null && hasEventMarket
      ? resolveWorldCupOnchainMarketId(idBn)
      : idBn;
  const readArgs =
    contractIdBn === null ? undefined : [user, contractIdBn, contractIdBn + 1n];

  const { data, error, isLoading, isError, refetch } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: predictionMarketAbi,
    functionName: 'getDashboard',
    args: readArgs,
    chainId: arcTestnet.id,
    query: {
      enabled: requestedKind !== 'event' && idBn !== null,
      refetchInterval: 5_000,
    },
  });
  const {
    data: eventData,
    error: eventError,
    isLoading: isEventLoading,
    isError: isEventError,
    refetch: refetchEvent,
  } = useReadContract({
    address: EVENT_MARKET_ADDRESS,
    abi: eventMarketAbi,
    functionName: 'getDashboard',
    args: readArgs,
    chainId: arcTestnet.id,
    query: {
      enabled: requestedKind === 'event' && hasEventMarket && idBn !== null,
      refetchInterval: 5_000,
    },
  });

  const dashboardData = data as DashboardResult | undefined;
  const eventDashboardData = eventData as EventDashboardResult | undefined;
  const row = dashboardData?.[0]?.[0];
  const resolvedEventRows = useMemo(
    () => resolveWorldCupMarkets(eventDashboardData?.[0] ?? []),
    [eventDashboardData],
  );
  const eventRow = useMemo(() => {
    if (requestedKind !== 'event' || idBn === null) {
      return null;
    }

    if (!hasEventMarket) {
      return (WORLDCUP_SKELETON_MARKETS.find((market) => market.id === idBn) ?? null) as EventRow | null;
    }

    return (resolvedEventRows[0] ?? null) as EventRow | null;
  }, [hasEventMarket, idBn, requestedKind, resolvedEventRows]);
  const marketMissing =
    kind === 'event'
      ? hasEventMarket && isInvalidMarketError(eventError)
      : isInvalidMarketError(error);
  const detailLoading = kind === 'event' ? hasEventMarket && isEventLoading : isLoading;
  const detailError = kind === 'event' ? hasEventMarket && isEventError : isError;
  const walletStatus = address ? 'Connected' : 'Not connected';
  const detailTitle = kind === 'event' ? 'World Cup Market' : 'Market Details';
  const backHref = kind === 'event' ? '/?category=worldcup' : '/';
  const showPhase16 = kind !== 'event' && isPhase16Enabled();
  const seedContribution = useMemo(
    () => sumSeedContribution(seedBetEvents ?? [], SEED_WALLETS),
    [seedBetEvents],
  );

  useEffect(() => {
    if (kind === 'event' && !WORLDCUP_ENABLED) {
      router.replace('/');
    }
  }, [kind, router]);

  useEffect(() => {
    if (!showPhase16 || idBn === null) {
      setSeedBetEvents([]);
      return;
    }

    if (!publicClient) {
      setSeedBetEvents([]);
      return;
    }

    let cancelled = false;
    setSeedBetEvents(undefined);

    const loadSeedBetEvents = async () => {
      try {
        const logs = await fetchLogsPaged<
          SeedBetLog,
          typeof PREDICTION_MARKET_ADDRESS,
          typeof betEvent,
          { id: bigint }
        >(
          {
            getBlockNumber: () => publicClient.getBlockNumber(),
            getLogs: (params) =>
              publicClient.getLogs(params as never) as Promise<readonly SeedBetLog[]>,
          },
          {
            address: PREDICTION_MARKET_ADDRESS,
            event: betEvent,
            args: { id: idBn },
            fromBlock: FRONTEND_DEPLOY_BLOCK,
            toBlock: 'latest',
          },
        );

        if (cancelled) {
          return;
        }

        const nextEvents = logs.flatMap((log) => {
          const eventUser = log.args?.user;
          const eventAmount = log.args?.amount;

          if (!eventUser || eventAmount === undefined) {
            return [];
          }

          return [{ user: eventUser, amount: eventAmount }];
        });

        setSeedBetEvents(nextEvents);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        console.error('Failed to read market Bet history; continuing with an empty event list.', loadError);
        setSeedBetEvents([]);
      }
    };

    void loadSeedBetEvents();

    return () => {
      cancelled = true;
    };
  }, [idBn, publicClient, showPhase16]);

  if (kind === 'event' && !WORLDCUP_ENABLED) {
    return (
      <>
        <NetworkBanner />
        <main className="min-h-screen bg-canvas px-4 py-10 text-ink sm:px-6 lg:px-8">
          <section className="mx-auto max-w-3xl rounded-lg border border-hair bg-paper p-5 text-sm text-ink-2">
            World Cup markets are disabled. Returning to the home page...
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <NetworkBanner />

      <nav className="sticky top-0 z-30 border-b border-hair bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <Link href={backHref} className="text-sm text-ink-2 transition hover:text-ink">
              Back to markets
            </Link>
            <h1 className="mt-2 text-xl font-semibold text-ink">
              {kind === 'event' ? 'World Cup ' : ''}Market #{routeId ?? 'unknown'}
            </h1>
          </div>
          <WalletPill />
        </div>
      </nav>

      <main className="min-h-screen bg-canvas text-ink">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          {idBn === null ? (
            <section className="rounded-lg border border-no/35 bg-no/10 p-5 text-sm text-no">
              Invalid market id. Go back and choose another market.
            </section>
          ) : detailLoading ? (
            <section className="rounded-lg border border-hair bg-paper p-5 text-sm text-ink-2">
              Loading market details...
            </section>
          ) : detailError ? (
            <section className="rounded-lg border border-no/35 bg-no/10 p-5 text-sm text-no">
              {marketMissing ? 'Market not found. Go back and choose another market.' : 'Could not load market details. Check the network and try again.'}
            </section>
          ) : requestedKind === 'event' && !eventRow ? (
            <section className="rounded-lg border border-hair bg-paper p-5 text-sm text-ink-2">
              Market not found. The EventMarket address may still be missing, or this skeleton market does not exist.
            </section>
          ) : requestedKind !== 'event' && !row ? (
            <section className="rounded-lg border border-hair bg-paper p-5 text-sm text-ink-2">
              Market not found. It may not be published yet or is outside the current range.
            </section>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.75fr)]">
              <div className="space-y-6">
                <section className="rounded-lg border border-hair bg-paper p-5">
                  <div className="flex flex-col gap-4 border-b border-hair pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-2xl">
                      <div className="font-mono text-xs text-ink-2">Market ID #{idBn.toString()}</div>
                      <h2 className="mt-2 text-lg font-semibold text-ink">{detailTitle}</h2>
                      <p className="mt-2 text-sm leading-6 text-ink-2">
                        {kind === 'event'
                          ? 'Review the market, pick an outcome, and place a World Cup bet from this page.'
                          : 'Review the question, pool state, and betting actions from a direct market link.'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-hair bg-canvas px-4 py-3 text-sm text-ink-2">
                      <div className="font-medium text-ink">Network: {arcTestnet.name}</div>
                      <div className="mt-1">Wallet: {walletStatus}</div>
                    </div>
                  </div>

                  <div className="mt-5">
                    {kind === 'event' && eventRow ? (
                      <MarketDetailCard
                        marketKind="event"
                        row={eventRow}
                        onBet={(nextRow, outcomeIndex) => setEventBetting({ row: nextRow, outcomeIndex })}
                      />
                    ) : row ? (
                      <MarketDetailCard
                        marketKind="price"
                        row={row}
                        onBet={(_id, side) => setBetting({ row, side })}
                      />
                    ) : null}
                    {showPhase16 && row ? (
                      <div className="mt-4">
                        <SeedDisclosure
                          seedContribution={seedContribution}
                          loading={seedBetEvents === undefined}
                        />
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-lg border border-hair bg-paper p-5">
                  <h2 className="text-sm font-semibold text-ink">Market status</h2>
                  <div className="mt-4 space-y-3 text-sm text-ink-2">
                    <div className="flex items-center justify-between rounded-lg border border-hair bg-canvas px-4 py-3">
                      <span className="text-ink-2">Market ID</span>
                      <span className="font-mono text-ink">{idBn.toString()}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-hair bg-canvas px-4 py-3">
                      <span className="text-ink-2">Network</span>
                      <span className="font-mono text-ink">{arcTestnet.name}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-hair bg-canvas px-4 py-3">
                      <span className="text-ink-2">Wallet</span>
                      <span className="font-mono text-ink">{walletStatus}</span>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          )}
        </div>
      </main>

      {requestedKind !== 'event' && betting ? (
        <BetModal
          row={betting.row}
          side={betting.side}
          onClose={() => {
            setBetting(null);
            void refetch();
          }}
        />
      ) : null}
      {requestedKind === 'event' && eventBetting ? (
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
