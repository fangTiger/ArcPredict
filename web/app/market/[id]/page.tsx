'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import type { Abi } from 'viem';
import { maxUint256, parseAbiItem, zeroAddress } from 'viem';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { BetForm } from '@/components/BetForm';
import { BetModal } from '@/components/BetModal';
import { EventBetModal } from '@/components/EventBetModal';
import { ActivityTimeline, type ActivityTimelineItem } from '@/components/ActivityTimeline';
import { AILensPanel } from '@/components/AILensPanel';
import { MarketDetailCard } from '@/components/MarketDetailCard';
import { MarketStoryPanel } from '@/components/MarketStoryPanel';
import { NetworkBanner } from '@/components/NetworkBanner';
import { RelatedMarketsPanel } from '@/components/RelatedMarketsPanel';
import {
  SettlementTimeline,
  type SettlementEvidenceItem,
} from '@/components/SettlementTimeline';
import { SeedDisclosure, sumSeedContribution } from '@/components/SeedDisclosure';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import EventMarketAbi from '@/lib/abis/EventMarket.json';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';
import { FRONTEND_DEPLOY_BLOCK } from '@/lib/asset-price-map';
import { fetchLogsPaged } from '@/lib/bet-event-scan';
import { arcTestnet } from '@/lib/chain';
import { OUTCOMES } from '@/lib/derivePosition';
import { WORLDCUP_ENABLED } from '@/lib/feature-flags';
import { fmtUsdc } from '@/lib/format';
import type { LensInput } from '@/lib/lens/schema';
import {
  deriveMarketStory,
  selectRelatedMarkets,
  toRichMarketRef,
} from '@/lib/market-richness';
import { ORACLE_STATUS, adminOracleAbi } from '@/lib/markets/scheduler/abi';
import {
  DEFAULT_EVENT_MARKET_DEPLOYMENT,
  attachDeploymentToEventRow,
  eventMarketDeploymentById,
} from '@/lib/markets/deployments';
import { isPhase16Enabled } from '@/lib/phase16-flag';
import { SEED_WALLETS } from '@/lib/seed-wallets';
import { useMediaQuery } from '@/lib/use-media-query';
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
type EventBetSelection = {
  row: EventRow;
  outcomeIndex: number;
};
type EventOracleStatus = 'pending' | 'proposed' | 'challenged' | 'finalized';
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

const focusRingClassName =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0';

const toLensProbability = (value: number) => Math.max(0, Math.min(1, value / 100));

function priceImpliedProbability(row: MarketRow): number {
  const total = row.market.yesPool + row.market.noPool;

  if (total === 0n) {
    return 0.5;
  }

  return Number((row.market.yesPool * 10000n) / total) / 10000;
}

function buildPriceLensInput(row: MarketRow, generatedAt: number): LensInput {
  return {
    market: {
      id: row.id.toString(),
      question: row.market.question,
      type: 'crypto-binary',
      end_time: Number(row.market.resolveAfter),
      implied_probability: priceImpliedProbability(row),
    },
    context: {},
    generated_at: generatedAt,
  };
}

function buildEventLensInput(row: EventRow, generatedAt: number): LensInput {
  return {
    market: {
      id: row.id.toString(),
      question: row.question,
      type: 'event-multi',
      end_time: Number(row.betDeadline),
      implied_probability: toLensProbability(row.outcomes[0]?.impliedProbability ?? 0),
      category: row.category,
      eventId: row.eventId,
      outcome_options: row.outcomes.map((outcome) => outcome.label),
      outcome_implied_probabilities: Object.fromEntries(
        row.outcomes.map((outcome) => [
          outcome.label,
          toLensProbability(outcome.impliedProbability),
        ]),
      ),
    },
    context: { facts: [] },
    generated_at: generatedAt,
  };
}

function formatUtcLine(value: bigint): string {
  return `${new Date(Number(value) * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function buildPriceActivityTimeline(row: MarketRow): ActivityTimelineItem[] {
  const claimLabel =
    row.pendingPayout > 0n && !row.claimed_
      ? 'Payout is ready to claim from the current wallet path.'
      : OUTCOMES[row.market.outcome] === 'Unresolved'
        ? 'Settlement starts after the market reaches its resolution timestamp.'
        : 'Settlement is complete and the market now sits in archive mode.';

  return [
    {
      id: 'market-live',
      label: 'Market live',
      detail: 'This price board stays connected to the existing YES / NO bet flow on Arc.',
    },
    {
      id: 'betting-closes',
      label: 'Betting closes',
      detail: `Final bets lock at ${formatUtcLine(row.market.betDeadline)}.`,
    },
    {
      id: 'resolution-window',
      label: 'Resolution window',
      detail: `The market resolves from ${formatUtcLine(row.market.resolveAfter)} onward.`,
    },
    {
      id: 'claim-window',
      label: 'Claim window',
      detail: claimLabel,
    },
  ];
}

function buildEventActivityTimeline(
  row: EventRow,
  oracleStatus: {
    status: EventOracleStatus;
    proposedAt?: number;
    proposalTxHash?: `0x${string}`;
  } | null,
): ActivityTimelineItem[] {
  const oracleDetail =
    oracleStatus?.status === 'proposed' && oracleStatus.proposedAt
      ? `Oracle proposal is live from ${new Date(oracleStatus.proposedAt * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC.`
      : oracleStatus?.status === 'challenged'
        ? 'Oracle review is in the challenged state, so traders should watch the final settlement path.'
        : oracleStatus?.status === 'finalized'
          ? 'Oracle settlement is finalized and the board has moved into payout mode.'
          : 'Oracle confirmation is still pending after betting closes.';
  const claimLabel =
    row.pendingPayout > 0n && !row.claimed_
      ? 'Payout is claimable now from the current event market path.'
      : row.claimed_
        ? 'The current wallet has already claimed its payout for this board.'
        : 'Claim status stays locked until the event outcome is finalized.';

  return [
    {
      id: 'market-live',
      label: 'Market live',
      detail: 'This event board keeps the existing outcome buttons and event bet modal untouched.',
    },
    {
      id: 'betting-closes',
      label: 'Betting closes',
      detail: `Final bets lock at ${formatUtcLine(row.betDeadline)}.`,
    },
    {
      id: 'oracle-status',
      label: 'Oracle status',
      detail: oracleDetail,
    },
    {
      id: 'claim-window',
      label: 'Claim window',
      detail: claimLabel,
    },
  ];
}

function PositionSummary({ row }: { row: MarketRow }) {
  return (
    <div className="grid gap-3 text-sm">
      <div className="flex items-center justify-between rounded-xl border border-hair bg-bg-0 px-3 py-2.5">
        <span className="text-ink-2">YES 份额</span>
        <span className="font-mono text-ink">{fmtUsdc(row.yesStake)} USDC</span>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-hair bg-bg-0 px-3 py-2.5">
        <span className="text-ink-2">NO 份额</span>
        <span className="font-mono text-ink">{fmtUsdc(row.noStake)} USDC</span>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-hair bg-bg-0 px-3 py-2.5">
        <span className="text-ink-2">待领取</span>
        <span className="font-mono text-ink">{fmtUsdc(row.pendingPayout)} USDC</span>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-hair bg-bg-0 px-3 py-2.5">
        <span className="text-ink-2">领取状态</span>
        <span className="font-mono text-ink">{row.claimed_ ? '已领取' : '未领取'}</span>
      </div>
    </div>
  );
}

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
  const deploymentParam = searchParams.get('deployment');
  const eventMarketDeployment =
    eventMarketDeploymentById(deploymentParam) ?? DEFAULT_EVENT_MARKET_DEPLOYMENT;
  const requestedKind = kind;
  const idBn = parseMarketId(routeId);
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const user = address ?? zeroAddress;
  const [eventBetting, setEventBetting] = useState<EventBetSelection | null>(null);
  const [selectedSide, setSelectedSide] = useState(true);
  const [showMobileBet, setShowMobileBet] = useState(false);
  const [seedBetEvents, setSeedBetEvents] = useState<SeedBetEvent[] | undefined>(undefined);
  const [eventOracleStatus, setEventOracleStatus] = useState<{
    status: EventOracleStatus;
    proposedAt?: number;
    proposalTxHash?: `0x${string}`;
  } | null>(null);
  const [lensGeneratedAt] = useState(() => Math.floor(Date.now() / 1000));
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const hasEventMarket = WORLDCUP_ENABLED && eventMarketDeployment.eventMarketAddress !== zeroAddress;
  const contractIdBn =
    requestedKind === 'event' && idBn !== null && hasEventMarket
      ? eventMarketDeployment.id === 'worldcup-v1'
        ? resolveWorldCupOnchainMarketId(idBn)
        : idBn
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
    address: eventMarketDeployment.eventMarketAddress,
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
  const eventRowsWithDeployment = useMemo(
    () =>
      (eventDashboardData?.[0] ?? []).map((nextRow) =>
        attachDeploymentToEventRow(nextRow, eventMarketDeployment),
      ),
    [eventDashboardData, eventMarketDeployment],
  );
  const rawEventRow = eventRowsWithDeployment[0];
  const resolvedEventRows = useMemo(
    () => resolveWorldCupMarkets(eventRowsWithDeployment),
    [eventRowsWithDeployment],
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
  const eventCategoryLabel =
    eventRow?.category === 'macro'
      ? 'Macro'
      : eventRow?.category === 'chain'
        ? 'On-chain'
        : 'World Cup';
  const detailTitle = kind === 'event' ? `${eventCategoryLabel} Market` : 'Market Details';
  const backHref = kind === 'event' ? `/?category=${eventRow?.category ?? 'worldcup'}` : '/';
  const adminEventOracleHref = `${arcTestnet.blockExplorers.default.url}/address/${eventMarketDeployment.oracleAddress}`;
  const eventSettlementEvidence = useMemo<SettlementEvidenceItem[]>(() => {
    if (!eventRow) {
      return [];
    }

    const nextEvidence: SettlementEvidenceItem[] = [
      {
        label: 'Event ID',
        value: eventRow.eventId,
      },
      {
        label: 'Oracle source',
        value: 'AdminEventOracle',
        href: adminEventOracleHref,
      },
      {
        label: 'Question',
        value: eventRow.question,
      },
    ];

    if (eventOracleStatus?.proposalTxHash) {
      nextEvidence.push({
        label: 'Proposal tx',
        value: eventOracleStatus.proposalTxHash,
        href: `${arcTestnet.blockExplorers.default.url}/tx/${eventOracleStatus.proposalTxHash}`,
      });
    }

    return nextEvidence;
  }, [adminEventOracleHref, eventOracleStatus?.proposalTxHash, eventRow]);
  const showPhase16 = kind !== 'event' && isPhase16Enabled();
  const seedContribution = useMemo(
    () => sumSeedContribution(seedBetEvents ?? [], SEED_WALLETS),
    [seedBetEvents],
  );
  const detailMarketRef = useMemo(() => {
    if (requestedKind === 'event' && eventRow) {
      return toRichMarketRef(eventRow, BigInt(Math.floor(Date.now() / 1000)));
    }

    if (row) {
      return toRichMarketRef(row, BigInt(Math.floor(Date.now() / 1000)));
    }

    return null;
  }, [eventRow, requestedKind, row]);
  const detailStory = useMemo(
    () => (detailMarketRef ? deriveMarketStory(detailMarketRef) : null),
    [detailMarketRef],
  );
  const relatedMarkets = useMemo(() => {
    if (!detailMarketRef || !eventRow || eventRow.category !== 'worldcup') {
      return [];
    }

    const candidateMarkets = WORLDCUP_SKELETON_MARKETS.map((candidate) =>
      toRichMarketRef(candidate, BigInt(Math.floor(Date.now() / 1000))),
    );

    return selectRelatedMarkets(detailMarketRef, [detailMarketRef, ...candidateMarkets]).slice(0, 4);
  }, [detailMarketRef, eventRow]);
  const activityTimelineItems = useMemo(() => {
    if (requestedKind === 'event' && eventRow) {
      return buildEventActivityTimeline(eventRow, eventOracleStatus);
    }

    if (row) {
      return buildPriceActivityTimeline(row);
    }

    return [];
  }, [eventOracleStatus, eventRow, requestedKind, row]);
  const handlePriceBet = (_id: bigint, side: boolean) => {
    setSelectedSide(side);
    if (!isDesktop) {
      setShowMobileBet(true);
    }
  };

  useEffect(() => {
    if (kind === 'event' && !WORLDCUP_ENABLED) {
      router.replace('/');
    }
  }, [kind, router]);

  useEffect(() => {
    if (requestedKind !== 'event' || !eventRow || !publicClient || !hasEventMarket) {
      setEventOracleStatus(null);
      return;
    }

    let cancelled = false;

    const loadEventOracleStatus = async () => {
      try {
        const rawStatus = (await publicClient.readContract({
          address: eventMarketDeployment.oracleAddress,
          abi: adminOracleAbi,
          functionName: 'getEventStatus',
          args: [eventRow.eventId],
        })) as number;
        const status: EventOracleStatus =
          rawStatus === ORACLE_STATUS.Proposed
            ? 'proposed'
            : rawStatus === ORACLE_STATUS.Challenged
              ? 'challenged'
              : rawStatus === ORACLE_STATUS.Finalized
                ? 'finalized'
                : 'pending';

        let proposedAt: number | undefined;
        let proposalTxHash: `0x${string}` | undefined;
        if (status !== 'pending') {
          const proposedEvents = await publicClient.getContractEvents({
            address: eventMarketDeployment.oracleAddress,
            abi: adminOracleAbi,
            eventName: 'ResultProposed',
            args: { eventId: eventRow.eventId },
            fromBlock: eventMarketDeployment.fromBlock || FRONTEND_DEPLOY_BLOCK,
            toBlock: 'latest',
          });
          const latest = proposedEvents.at(-1) as
            | {
                args?: { proposedAt?: bigint | number };
                transactionHash?: `0x${string}`;
              }
            | undefined;
          const rawProposedAt = latest?.args?.proposedAt;
          proposedAt = rawProposedAt == null ? undefined : Number(rawProposedAt);
          proposalTxHash = latest?.transactionHash;
        }

        if (!cancelled) {
          setEventOracleStatus({ status, proposedAt, proposalTxHash });
        }
      } catch {
        if (!cancelled) {
          setEventOracleStatus(null);
        }
      }
    };

    void loadEventOracleStatus();

    return () => {
      cancelled = true;
    };
  }, [eventMarketDeployment, eventRow, hasEventMarket, publicClient, requestedKind]);

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
        <SiteHeader />
        <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 text-ink sm:px-6 lg:px-8">
          <section className="mx-auto max-w-3xl rounded-xl border border-hair bg-bg-1 p-6 text-sm text-ink-2">
            World Cup markets are disabled. Returning to the home page...
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <NetworkBanner />
      <SiteHeader />

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 pb-28 text-ink sm:px-6 lg:px-8 lg:pb-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm text-ink-2 transition hover:text-ink"
          >
            <span aria-hidden>←</span> 返回
          </Link>
          <div className="font-mono text-xs text-ink-2">
            {kind === 'event' ? `${eventCategoryLabel} ` : ''}Market #{routeId ?? 'unknown'}
          </div>
        </div>

          {idBn === null ? (
            <section className="rounded-xl border border-no/25 bg-no/5 p-6 text-sm text-no">
              Invalid market id. Go back and choose another market.
            </section>
          ) : detailLoading ? (
            <section className="rounded-xl border border-hair bg-bg-1 p-6 text-sm text-ink-2">
              Loading market details...
            </section>
          ) : detailError ? (
            <section className="rounded-xl border border-no/25 bg-no/5 p-6 text-sm text-no">
              {marketMissing ? 'Market not found. Go back and choose another market.' : 'Could not load market details. Check the network and try again.'}
            </section>
          ) : requestedKind === 'event' && !eventRow ? (
            <section className="rounded-xl border border-hair bg-bg-1 p-6 text-sm text-ink-2">
              Market not found. The EventMarket address may still be missing, or this skeleton market does not exist.
            </section>
          ) : requestedKind !== 'event' && !row ? (
            <section className="rounded-xl border border-hair bg-bg-1 p-6 text-sm text-ink-2">
              Market not found. It may not be published yet or is outside the current range.
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-8">
                <section className="rounded-xl border border-hair bg-bg-1 p-6">
                  <div className="flex flex-col gap-4 border-b border-hair pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-2xl">
                      <div className="font-mono text-xs text-ink-2">Market ID #{idBn.toString()}</div>
                      <h1 className="mt-2 text-2xl font-semibold text-ink">{detailTitle}</h1>
                      <p className="mt-2 text-sm leading-6 text-ink-2">
                        {kind === 'event'
                          ? `Review the market, pick an outcome, and place a ${eventCategoryLabel} bet from this page.`
                          : 'Review the question, pool state, and betting actions from a direct market link.'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-hair bg-bg-0 px-4 py-3 text-sm text-ink-2">
                      <div className="font-medium text-ink">Network: {arcTestnet.name}</div>
                      <div className="mt-1">Wallet: {walletStatus}</div>
                    </div>
                  </div>

                  <div className="mt-5">
                    {kind === 'event' && eventRow ? (
                      <>
                        <MarketDetailCard
                          marketKind="event"
                          row={eventRow}
                          onBet={(nextRow, outcomeIndex) => setEventBetting({ row: nextRow, outcomeIndex })}
                        />
                        <div className="mt-5">
                          {detailStory ? <MarketStoryPanel story={detailStory} /> : null}
                        </div>
                        <div className="mt-5">
                          <ActivityTimeline items={activityTimelineItems} />
                        </div>
                        {relatedMarkets.length > 0 ? (
                          <div className="mt-5">
                            <RelatedMarketsPanel markets={relatedMarkets} />
                          </div>
                        ) : null}
                        <div className="mt-5">
                          <SettlementTimeline
                            kind="event"
                            resolveAfter={Number(rawEventRow?.market.resolveAfter ?? eventRow.betDeadline)}
                            settledOutcome={rawEventRow?.market.settledOutcome ?? eventRow.settledOutcome}
                            oracleStatus={eventOracleStatus?.status ?? 'pending'}
                            proposedAt={eventOracleStatus?.proposedAt}
                            pendingPayout={eventRow.pendingPayout}
                            claimed={eventRow.claimed_}
                            sourceHref={adminEventOracleHref}
                            evidence={eventSettlementEvidence}
                          />
                        </div>
                        <div className="mt-5">
                          <AILensPanel input={buildEventLensInput(eventRow, lensGeneratedAt)} />
                        </div>
                      </>
                    ) : row ? (
                      <>
                        <MarketDetailCard
                          marketKind="price"
                          row={row}
                          onBet={handlePriceBet}
                        />
                        <div className="mt-5">
                          {detailStory ? <MarketStoryPanel story={detailStory} /> : null}
                        </div>
                        <div className="mt-5">
                          <ActivityTimeline items={activityTimelineItems} />
                        </div>
                        <div className="mt-5">
                          <SettlementTimeline
                            kind="price"
                            resolveAfter={Number(row.market.resolveAfter)}
                            outcome={row.market.outcome}
                            pendingPayout={row.pendingPayout}
                            claimed={row.claimed_}
                          />
                        </div>
                        <div className="mt-5">
                          <AILensPanel input={buildPriceLensInput(row, lensGeneratedAt)} />
                        </div>
                      </>
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

              <aside className="space-y-6 lg:col-span-4">
                {row && requestedKind !== 'event' ? (
                  <section className="sticky top-24 hidden rounded-xl border border-hair bg-bg-1 p-6 lg:block">
                    <h2 className="text-xl font-semibold text-ink">立即下注</h2>
                    <div className="mt-4">
                      <PositionSummary row={row} />
                    </div>
                    <div className="my-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedSide(true)}
                        className={
                          selectedSide
                            ? `rounded-lg border border-yes/25 bg-yes/10 py-2 text-yes ${focusRingClassName}`
                            : `rounded-lg border border-hair bg-bg-0 py-2 text-ink-2 hover:text-ink ${focusRingClassName}`
                        }
                      >
                        YES
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSide(false)}
                        className={
                          !selectedSide
                            ? `rounded-lg border border-no/25 bg-no/10 py-2 text-no ${focusRingClassName}`
                            : `rounded-lg border border-hair bg-bg-0 py-2 text-ink-2 hover:text-ink ${focusRingClassName}`
                        }
                      >
                        NO
                      </button>
                    </div>
                    <BetForm
                      row={row}
                      side={selectedSide}
                      compact
                      onSuccess={() => {
                        void refetch();
                      }}
                    />
                  </section>
                ) : null}

                <section className="rounded-xl border border-hair bg-bg-1 p-6">
                  <h2 className="text-xl font-semibold text-ink">Market status</h2>
                  <div className="mt-4 space-y-3 text-sm text-ink-2">
                    <div className="flex items-center justify-between rounded-xl border border-hair bg-bg-0 px-4 py-3">
                      <span className="text-ink-2">Market ID</span>
                      <span className="font-mono text-ink">{idBn.toString()}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-hair bg-bg-0 px-4 py-3">
                      <span className="text-ink-2">Network</span>
                      <span className="font-mono text-ink">{arcTestnet.name}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-hair bg-bg-0 px-4 py-3">
                      <span className="text-ink-2">Wallet</span>
                      <span className="font-mono text-ink">{walletStatus}</span>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          )}
        {row && requestedKind !== 'event' ? (
          <div
            className="fixed inset-x-0 bottom-0 z-30 border-t border-hair bg-bg-0 p-4 lg:hidden"
          >
            <div className="mb-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedSide(true)}
                className={
                  selectedSide
                    ? `rounded-lg border border-yes/25 bg-yes/10 py-2 text-yes ${focusRingClassName}`
                    : `rounded-lg border border-hair bg-bg-1 py-2 text-ink-2 hover:text-ink ${focusRingClassName}`
                }
              >
                YES
              </button>
              <button
                type="button"
                onClick={() => setSelectedSide(false)}
                className={
                  !selectedSide
                    ? `rounded-lg border border-no/25 bg-no/10 py-2 text-no ${focusRingClassName}`
                    : `rounded-lg border border-hair bg-bg-1 py-2 text-ink-2 hover:text-ink ${focusRingClassName}`
                }
              >
                NO
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowMobileBet(true)}
              className={`w-full rounded-xl border border-arc/20 bg-bg-1 px-4 py-3 text-base font-semibold text-ink transition hover:border-arc/30 hover:text-arc ${focusRingClassName}`}
            >
              立即下注 · {selectedSide ? 'YES' : 'NO'}
            </button>
          </div>
        ) : null}
      </main>
      <SiteFooter />

      {requestedKind !== 'event' && row && showMobileBet ? (
        <BetModal
          row={row}
          side={selectedSide}
          onClose={() => {
            setShowMobileBet(false);
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
