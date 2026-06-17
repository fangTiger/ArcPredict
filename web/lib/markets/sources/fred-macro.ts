import type { FredClient } from '../clients/fred';
import {
  ResolveStillOpen,
  type MarketDraft,
  type MarketSource,
  type OnChainMarket,
  type ResolvedOutcome,
} from './base';

interface SeriesSpec {
  seriesId: string;
  label: string;
  questionTemplate: (releaseDate: string) => string;
  outcomes: { id: string; label: string; range: [number, number] }[];
}

const SERIES: SeriesSpec[] = [
  {
    seriesId: 'CPIAUCSL',
    label: 'US CPI YoY',
    questionTemplate: (d) => `US CPI YoY released on ${d} - what range?`,
    outcomes: [
      { id: 'lt25', label: '< 2.5%', range: [-Infinity, 2.5] },
      { id: 'mid', label: '2.5%-3.5%', range: [2.5, 3.5] },
      { id: 'gt35', label: '> 3.5%', range: [3.5, Infinity] },
    ],
  },
  {
    seriesId: 'FEDFUNDS',
    label: 'Fed Funds Rate',
    questionTemplate: (d) => `Fed Funds Rate on ${d} - what range?`,
    outcomes: [
      { id: 'lt450', label: '< 4.5%', range: [-Infinity, 4.5] },
      { id: 'mid', label: '4.5%-5.0%', range: [4.5, 5.0] },
      { id: 'gt500', label: '> 5.0%', range: [5.0, Infinity] },
    ],
  },
  {
    seriesId: 'PAYEMS',
    label: 'Non-Farm Payrolls (MoM change, thousands)',
    questionTemplate: (d) => `NFP released on ${d} - MoM change?`,
    outcomes: [
      { id: 'lt100', label: '< 100k', range: [-Infinity, 100] },
      { id: 'mid', label: '100k-200k', range: [100, 200] },
      { id: 'gt200', label: '> 200k', range: [200, Infinity] },
    ],
  },
];

// FRED 数据通常每月发布一次；Phase 1 用每月 15 号作为近似发布日期。
const RELEASE_OFFSET_DAYS = 15;

function upcomingReleaseDates(now: Date, lookAheadDays: number): string[] {
  const dates: string[] = [];
  const end = new Date(now.getTime() + lookAheadDays * 86_400_000);
  const cursor = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    RELEASE_OFFSET_DAYS,
  ));

  while (cursor <= end) {
    if (cursor > now) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return dates;
}

function valueToOutcomeIndex(value: number, outcomes: SeriesSpec['outcomes']): number {
  for (let i = 0; i < outcomes.length; i++) {
    const [lo, hi] = outcomes[i].range;
    if (value >= lo && value < hi) return i;
  }
  return outcomes.length - 1;
}

export interface FredMacroSourceOptions {
  fredClient: FredClient;
  lookAheadDays?: number;
  resolutionGraceHours?: number;
}

export function createFredMacroSource(opts: FredMacroSourceOptions): MarketSource {
  const lookAheadDays = opts.lookAheadDays ?? 90;
  const grace = (opts.resolutionGraceHours ?? 36) * 3_600_000;

  return {
    id: 'fred-macro',
    category: 'macro',
    enabled: true,

    async fetchUpcoming(now: Date): Promise<MarketDraft[]> {
      const out: MarketDraft[] = [];

      for (const series of SERIES) {
        for (const releaseDate of upcomingReleaseDates(now, lookAheadDays)) {
          const releaseTs = Math.floor(Date.parse(`${releaseDate}T12:00:00Z`) / 1000);
          out.push({
            externalKey: `${series.seriesId}:${releaseDate}`,
            category: 'macro',
            question: series.questionTemplate(releaseDate),
            outcomes: series.outcomes.map(({ id, label }) => ({ id, label })),
            betDeadline: releaseTs - 3600,
            resolveAfter: releaseTs + Math.floor(grace / 1000),
            resolveSourceMeta: {
              seriesId: series.seriesId,
              releaseDate,
              outcomeRanges: series.outcomes.map((o) => o.range),
            },
          });
        }
      }

      return out;
    },

    async resolve(market: OnChainMarket, _now: Date): Promise<ResolvedOutcome> {
      const [seriesId, releaseDate] = market.externalKey.split(':');
      const series = SERIES.find((s) => s.seriesId === seriesId);
      if (!series) return { kind: 'invalid', reason: `unknown series: ${seriesId}` };

      const obs = await opts.fredClient.getObservationByDate(seriesId, releaseDate)
        ?? await opts.fredClient.getLatestObservation(seriesId);
      if (!obs) return ResolveStillOpen;

      const idx = valueToOutcomeIndex(obs.value, series.outcomes);
      return {
        kind: 'settled',
        settledOutcomeIndex: idx,
        publishedAt: Math.floor(Date.parse(`${obs.date}T12:00:00Z`) / 1000),
        evidence: {
          sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
          rawValue: obs.value,
        },
      };
    },
  };
}
