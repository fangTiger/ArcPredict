import type { OracleStatusName } from './chain-reader';
import type { LensPreloadTarget } from './lens-preloader';

export interface ChainReaderLike {
  marketIdForEventId(eventId: `0x${string}`): Promise<bigint | null>;
  oracleStatus(eventId: `0x${string}`): Promise<OracleStatusName>;
  marketSettled(marketId: bigint): Promise<boolean>;
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

export interface SeedLiquidityLike {
  seed(marketId: bigint, outcomeCount: number): Promise<void>;
}

export interface LensPreloaderLike {
  warm(target: LensPreloadTarget): Promise<void>;
}
