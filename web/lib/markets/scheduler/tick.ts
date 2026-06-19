import { computeMarketId } from '../external-key';
import { enabledSources } from '../registry';
import type { MarketDraft, OnChainMarket } from '../sources/base';
import type {
  ChainReaderLike,
  ChainWriterLike,
  LensPreloaderLike,
  SeedLiquidityLike,
} from './types';

const CREATE_LIMIT = 5;
const RESOLVE_LIMIT = 10;
const CREATE_GUARD_SECONDS = 600;
const CHALLENGE_WINDOW_SECONDS = 72 * 3_600;
const MARKET_ID_RETRY_ATTEMPTS = 6;
const MARKET_ID_RETRY_DELAY_MS = 1_000;

export interface TickReport {
  perSource: Record<string, {
    opened: number;
    skipped: number;
    resolvedSettled: number;
    resolvedProposed: number;
    resolvedFinalized: number;
    error?: string;
  }>;
  totalDurationMs: number;
}

export interface RunTickArgs {
  now: Date;
  reader: ChainReaderLike;
  writer: ChainWriterLike;
  seedLiquidity: SeedLiquidityLike;
  preloader: LensPreloaderLike;
}

export async function runTick(args: RunTickArgs): Promise<TickReport> {
  const start = Date.now();
  const report: TickReport = { perSource: {}, totalDurationMs: 0 };

  for (const source of enabledSources()) {
    const perSource: TickReport['perSource'][string] = {
      opened: 0,
      skipped: 0,
      resolvedSettled: 0,
      resolvedProposed: 0,
      resolvedFinalized: 0,
    };
    report.perSource[source.id] = perSource;

    try {
      const drafts = await source.fetchUpcoming(args.now);
      const nowSec = Math.floor(args.now.getTime() / 1000);
      const draftsByEventId = new Map<`0x${string}`, MarketDraft>();
      for (const draft of drafts) {
        draftsByEventId.set(computeMarketId(source.id, draft.externalKey), draft);
      }

      for (const draft of drafts) {
        if (perSource.opened >= CREATE_LIMIT) break;
        if (draft.betDeadline - nowSec < CREATE_GUARD_SECONDS) {
          perSource.skipped++;
          continue;
        }

        const eventId = computeMarketId(source.id, draft.externalKey);
        const existing = await args.reader.marketIdForEventId(eventId);
        if (existing != null) {
          await seedIfNeeded(args.reader, args.seedLiquidity, existing, draft.outcomes.length);
          perSource.skipped++;
          continue;
        }

        await args.writer.openMarket({
          eventId,
          question: draft.question,
          outcomeCount: draft.outcomes.length,
          betDeadline: draft.betDeadline,
          resolveAfter: draft.resolveAfter,
        });

        const marketId = await waitForMarketId(args.reader, eventId);
        if (marketId != null) {
          await seedIfNeeded(args.reader, args.seedLiquidity, marketId, draft.outcomes.length);
          await args.preloader.warm({
            eventId,
            category: draft.category,
            question: draft.question,
            externalKey: draft.externalKey,
            outcomes: draft.outcomes,
          });
        }
        perSource.opened++;
      }

      const pending = await args.reader.pendingMarketsForSource(
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

            await args.writer.proposeOutcome(market.eventId, resolved.settledOutcomeIndex);
            perSource.resolvedProposed++;
            processed++;
            break;
          }
          case 'proposed': {
            const proposedAgo = market.proposedAt == null ? 0 : nowSec - market.proposedAt;
            if (proposedAgo >= CHALLENGE_WINDOW_SECONDS) {
              await args.writer.finalizeOutcome(market.eventId);
              await args.writer.settleMarket(market.marketId);
              perSource.resolvedFinalized++;
              perSource.resolvedSettled++;
              processed++;
            }
            break;
          }
          case 'challenged':
            break;
          case 'finalized':
            await args.writer.settleMarket(market.marketId);
            perSource.resolvedSettled++;
            processed++;
            break;
        }
      }
    } catch (err) {
      perSource.error = err instanceof Error ? err.message : String(err);
    }
  }

  report.totalDurationMs = Date.now() - start;
  return report;
}

async function seedIfNeeded(
  reader: ChainReaderLike,
  seedLiquidity: SeedLiquidityLike,
  marketId: bigint,
  outcomeCount: number,
): Promise<void> {
  if (await reader.marketHasLiquidity(marketId)) return;
  await seedLiquidity.seed(marketId, outcomeCount);
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
