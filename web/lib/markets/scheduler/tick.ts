import { computeMarketId } from '../external-key';
import { enabledSources } from '../registry';
import type {
  ChainReaderLike,
  ChainWriterLike,
  LensPreloaderLike,
  SeedLiquidityLike,
} from './types';

const CREATE_LIMIT = 5;
const CREATE_GUARD_SECONDS = 600;

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
    const perSource = {
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

      for (const draft of drafts) {
        if (perSource.opened >= CREATE_LIMIT) break;
        if (draft.betDeadline - nowSec < CREATE_GUARD_SECONDS) {
          perSource.skipped++;
          continue;
        }

        const eventId = computeMarketId(source.id, draft.externalKey);
        const existing = await args.reader.marketIdForEventId(eventId);
        if (existing != null) {
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

        const marketId = await args.reader.marketIdForEventId(eventId);
        if (marketId != null) {
          await args.seedLiquidity.seed(marketId, draft.outcomes.length);
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
    } catch (err) {
      perSource.error = err instanceof Error ? err.message : String(err);
    }
  }

  report.totalDurationMs = Date.now() - start;
  return report;
}
