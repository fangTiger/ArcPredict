import type { MarketCategory } from '../../market-kind';
import type { ExternalKey, MarketSourceId } from '../external-key';

export interface OutcomeOption {
  id: string;
  label: string;
}

export interface MarketDraft {
  externalKey: ExternalKey;
  category: MarketCategory;
  question: string;
  outcomes: OutcomeOption[];
  betDeadline: number;
  resolveAfter: number;
  resolveSourceMeta: Record<string, unknown>;
}

export type OracleStatus = 'pending' | 'proposed' | 'challenged' | 'finalized';

export type OnChainMarket = {
  marketId: bigint;
  eventId: `0x${string}`;
  sourceId: MarketSourceId;
  externalKey: ExternalKey;
  question: string;
  outcomeCount: number;
  betDeadline: number;
  resolveAfter: number;
  isSettled: boolean;
  oracleStatus: OracleStatus;
  proposedAt?: number;
};

export type ResolvedOutcome =
  | { kind: 'still-open' }
  | { kind: 'invalid'; reason: string }
  | {
      kind: 'settled';
      settledOutcomeIndex: number;
      publishedAt: number;
      evidence?: { sourceUrl: string; rawValue: unknown };
    };

export const ResolveStillOpen: ResolvedOutcome = { kind: 'still-open' };

export interface MarketSource {
  id: MarketSourceId;
  category: MarketCategory;
  enabled: boolean;
  fetchUpcoming(now: Date): Promise<MarketDraft[]>;
  resolve(market: OnChainMarket, now: Date): Promise<ResolvedOutcome>;
  buildLensContext?(market: OnChainMarket): Promise<Record<string, unknown>>;
}
