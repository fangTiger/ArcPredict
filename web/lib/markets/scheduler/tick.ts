import { computeMarketId } from '../external-key';
import { enabledSources } from '../registry';
import type { MarketCategory } from '../../market-kind';
import type { MarketDraft, OnChainMarket } from '../sources/base';
import type { MarketSource } from '../sources/base';
import type {
  ChainReaderLike,
  ChainWriterLike,
  LensPreloadResult,
  LensPreloaderLike,
  SeedLiquidityResult,
  SeedLiquidityLike,
} from './types';
import { safeErrorMessage } from './safe-report';

const CREATE_LIMIT = 5;
const RESOLVE_LIMIT = 10;
const CREATE_GUARD_SECONDS = 600;
const CHALLENGE_WINDOW_SECONDS = 72 * 3_600;
const MARKET_ID_RETRY_ATTEMPTS = 6;
const MARKET_ID_RETRY_DELAY_MS = 1_000;

export interface TickMarketReport {
  eventId: `0x${string}`;
  externalKey: string;
  category: MarketCategory;
  question: string;
  themeId?: string;
  status: 'opened' | 'existing' | 'skipped';
  marketId?: string;
  openTxHash?: `0x${string}`;
  seed?: SeedLiquidityResult | { status: 'already_seeded' };
  lensPreload?: LensPreloadResult;
}

export interface TickPerSourceReport {
  opened: number;
  skipped: number;
  seeded: number;
  resolvedSettled: number;
  resolvedProposed: number;
  resolvedFinalized: number;
  errors: string[];
  warnings: string[];
  markets: TickMarketReport[];
  deploymentId?: string;
}

export interface TickReport {
  generatedAt: string;
  perSource: Record<string, TickPerSourceReport>;
  totalDurationMs: number;
}

export interface RunTickArgs {
  now: Date;
  reader?: ChainReaderLike;
  writer?: ChainWriterLike;
  seedLiquidity?: SeedLiquidityLike;
  preloader?: LensPreloaderLike;
  runtimeForSource?: (source: MarketSource) => SourceTickRuntime | undefined | null;
}

export interface SourceTickRuntime {
  deploymentId?: string;
  reader: ChainReaderLike;
  writer: ChainWriterLike;
  seedLiquidity: SeedLiquidityLike;
  preloader: LensPreloaderLike;
}

export async function runTick(args: RunTickArgs): Promise<TickReport> {
  const start = Date.now();
  const report: TickReport = {
    generatedAt: args.now.toISOString(),
    perSource: {},
    totalDurationMs: 0,
  };

  for (const source of enabledSources()) {
    const perSource: TickPerSourceReport = {
      opened: 0,
      skipped: 0,
      seeded: 0,
      resolvedSettled: 0,
      resolvedProposed: 0,
      resolvedFinalized: 0,
      errors: [],
      warnings: [],
      markets: [],
    };
    report.perSource[source.id] = perSource;

    try {
      const runtime = runtimeForSource(args, source);
      perSource.deploymentId = runtime.deploymentId;
      const drafts = await source.fetchUpcoming(args.now);
      const nowSec = Math.floor(args.now.getTime() / 1000);
      const draftsByEventId = new Map<`0x${string}`, MarketDraft>();
      for (const draft of drafts) {
        draftsByEventId.set(computeMarketId(source.id, draft.externalKey), draft);
      }

      for (const draft of drafts) {
        if (perSource.opened >= CREATE_LIMIT) break;
        const eventId = computeMarketId(source.id, draft.externalKey);
        const marketReportBase = {
          eventId,
          externalKey: draft.externalKey,
          category: draft.category,
          question: draft.question,
          themeId: draft.themeId,
        };
        if (draft.betDeadline - nowSec < CREATE_GUARD_SECONDS) {
          perSource.skipped++;
          perSource.markets.push({
            ...marketReportBase,
            status: 'skipped',
          });
          continue;
        }

        const existing = await runtime.reader.marketIdForEventId(eventId);
        if (existing != null) {
          const seed = await seedIfNeeded(
            runtime.reader,
            runtime.seedLiquidity,
            existing,
            draft.outcomes.length,
          );
          if (seed.status === 'seeded') {
            perSource.seeded++;
          } else if (seed.status !== 'already_seeded' && seed.error) {
            perSource.warnings.push(seed.error);
          }
          perSource.markets.push({
            ...marketReportBase,
            status: 'existing',
            marketId: existing.toString(),
            seed,
          });
          perSource.skipped++;
          continue;
        }

        const openTxHash = await runtime.writer.openMarket({
          eventId,
          question: draft.question,
          outcomeCount: draft.outcomes.length,
          betDeadline: draft.betDeadline,
          resolveAfter: draft.resolveAfter,
        });
        const marketReport: TickMarketReport = {
          ...marketReportBase,
          status: 'opened',
          openTxHash,
        };

        const marketId = await waitForMarketId(runtime.reader, eventId);
        if (marketId != null) {
          marketReport.marketId = marketId.toString();
          const seed = await seedIfNeeded(
            runtime.reader,
            runtime.seedLiquidity,
            marketId,
            draft.outcomes.length,
          );
          marketReport.seed = seed;
          if (seed.status === 'seeded') {
            perSource.seeded++;
          } else if (seed.status !== 'already_seeded' && seed.error) {
            perSource.warnings.push(seed.error);
          }

          const lensPreload = await runtime.preloader.warm({
            eventId,
            category: draft.category,
            question: draft.question,
            externalKey: draft.externalKey,
            outcomes: draft.outcomes,
            themeId: draft.themeId,
          });
          marketReport.lensPreload = lensPreload;
          if (lensPreload.status === 'warning' && lensPreload.warning) {
            perSource.warnings.push(lensPreload.warning);
          }
        }
        perSource.markets.push(marketReport);
        perSource.opened++;
      }

      const pending = await runtime.reader.pendingMarketsForSource(
        source.id,
        Array.from(draftsByEventId.keys()),
      );

      let processed = 0;
      for (const market of pending) {
        if (processed >= RESOLVE_LIMIT) break;
        if (market.resolveAfter > nowSec) continue;

        switch (market.oracleStatus) {
          case 'pending': {
            const resolved = await source.resolve(
              toOnChainMarket(market, source.id, draftsByEventId.get(market.eventId)),
              args.now,
            );
            if (resolved.kind === 'still-open') break;
            if (resolved.kind === 'invalid') break;

            await runtime.writer.proposeOutcome(market.eventId, resolved.settledOutcomeIndex);
            perSource.resolvedProposed++;
            processed++;
            break;
          }
          case 'proposed': {
            const proposedAgo = market.proposedAt == null ? 0 : nowSec - market.proposedAt;
            if (proposedAgo >= CHALLENGE_WINDOW_SECONDS) {
              await runtime.writer.finalizeOutcome(market.eventId);
              await runtime.writer.settleMarket(market.marketId);
              perSource.resolvedFinalized++;
              perSource.resolvedSettled++;
              processed++;
            }
            break;
          }
          case 'challenged':
            break;
          case 'finalized':
            await runtime.writer.settleMarket(market.marketId);
            perSource.resolvedSettled++;
            processed++;
            break;
        }
      }
    } catch (err) {
      perSource.errors.push(safeErrorMessage(err));
    }
  }

  report.totalDurationMs = Date.now() - start;
  return report;
}

function runtimeForSource(args: RunTickArgs, source: MarketSource): SourceTickRuntime {
  const sourceRuntime = args.runtimeForSource?.(source);
  if (sourceRuntime) return sourceRuntime;

  if (!args.reader || !args.writer || !args.seedLiquidity || !args.preloader) {
    throw new Error(`missing runtime for source: ${source.id}`);
  }

  return {
    reader: args.reader,
    writer: args.writer,
    seedLiquidity: args.seedLiquidity,
    preloader: args.preloader,
  };
}

async function seedIfNeeded(
  reader: ChainReaderLike,
  seedLiquidity: SeedLiquidityLike,
  marketId: bigint,
  outcomeCount: number,
): Promise<SeedLiquidityResult | { status: 'already_seeded' }> {
  if (await reader.marketHasLiquidity(marketId)) {
    return { status: 'already_seeded' };
  }

  return seedLiquidity.seed(marketId, outcomeCount);
}

async function waitForMarketId(
  reader: ChainReaderLike,
  eventId: `0x${string}`,
): Promise<bigint | null> {
  for (let attempt = 0; attempt < MARKET_ID_RETRY_ATTEMPTS; attempt++) {
    const marketId = await reader.marketIdForEventId(eventId);
    if (marketId != null) return marketId;
    if (attempt < MARKET_ID_RETRY_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, MARKET_ID_RETRY_DELAY_MS));
    }
  }
  return null;
}

function toOnChainMarket(
  market: {
    marketId: bigint;
    eventId: `0x${string}`;
    resolveAfter: number;
    oracleStatus: OnChainMarket['oracleStatus'];
    proposedAt?: number;
    settled: boolean;
  },
  sourceId: string,
  draft: MarketDraft | undefined,
): OnChainMarket {
  return {
    marketId: market.marketId,
    eventId: market.eventId,
    sourceId,
    externalKey: draft?.externalKey ?? '',
    question: draft?.question ?? '',
    outcomeCount: draft?.outcomes.length ?? 0,
    betDeadline: draft?.betDeadline ?? 0,
    resolveAfter: market.resolveAfter,
    isSettled: market.settled,
    oracleStatus: market.oracleStatus,
    proposedAt: market.proposedAt,
  };
}
