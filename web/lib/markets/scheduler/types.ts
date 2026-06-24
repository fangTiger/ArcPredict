import type { OracleStatusName } from './chain-reader';
import type { LensPreloadTarget } from './lens-preloader';

export interface PendingMarketForSource {
  marketId: bigint;
  eventId: `0x${string}`;
  resolveAfter: number;
  oracleStatus: OracleStatusName;
  proposedAt?: number;
  settled: boolean;
}

export interface ChainReaderLike {
  marketIdForEventId(eventId: `0x${string}`): Promise<bigint | null>;
  oracleStatus(eventId: `0x${string}`): Promise<OracleStatusName>;
  marketSettled(marketId: bigint): Promise<boolean>;
  marketHasLiquidity(marketId: bigint): Promise<boolean>;
  pendingMarketsForSource(
    sourceId: string,
    knownEventIds: `0x${string}`[],
  ): Promise<PendingMarketForSource[]>;
}

export interface ChainWriterLike {
  openMarket(args: {
    eventId: `0x${string}`;
    question: string;
    outcomeCount: number;
    betDeadline: number;
    resolveAfter: number;
  }): Promise<`0x${string}`>;
  proposeOutcome(eventId: `0x${string}`, idx: number): Promise<`0x${string}`>;
  finalizeOutcome(eventId: `0x${string}`): Promise<`0x${string}`>;
  settleMarket(marketId: bigint): Promise<`0x${string}`>;
}

export interface SeedLiquidityResult {
  status: 'seeded' | 'needs_funding' | 'seed_failed';
  approveTxHash?: `0x${string}`;
  betTxHashes?: `0x${string}`[];
  error?: string;
}

export interface SeedLiquidityLike {
  seed(marketId: bigint, outcomeCount: number): Promise<SeedLiquidityResult>;
}

export interface LensPreloadResult {
  status: 'warmed' | 'warning';
  warning?: string;
}

export interface LensPreloaderLike {
  warm(target: LensPreloadTarget): Promise<LensPreloadResult>;
}
