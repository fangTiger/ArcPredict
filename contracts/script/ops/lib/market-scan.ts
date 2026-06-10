import { parseCadenceTag } from "./cadence-tag.ts";
import { PYTH_PRICE_ID, type Asset, type Cadence } from "../scheduler.config.ts";

export type ScannedMarket = {
  id: bigint;
  pythPriceId: string;
  betDeadline: bigint;
  resolveAfter: bigint;
  outcome: number;
  question: string;
};

export type BucketedMarkets = Record<Asset, Record<Cadence, ScannedMarket[]>> & {
  unknown: ScannedMarket[];
};

type MarketPageItem = Omit<ScannedMarket, "id"> & {
  id?: bigint;
};

export type MarketReader = {
  marketCount(): Promise<bigint>;
  getMarketsPage(from: bigint, toExclusive: bigint): Promise<MarketPageItem[]>;
};

const PAGE_SIZE = 50n;

function createEmptyBuckets(): BucketedMarkets {
  return {
    BTC: { daily: [], weekly: [], monthly: [], quarterly: [] },
    ETH: { daily: [], weekly: [], monthly: [], quarterly: [] },
    SOL: { daily: [], weekly: [], monthly: [], quarterly: [] },
    unknown: [],
  };
}

function normalizePriceId(priceId: string): string {
  return priceId.trim().replace(/^0x/i, "").toLowerCase();
}

function assetFromPriceId(priceId: string): Asset | undefined {
  const normalizedInput = normalizePriceId(priceId);

  for (const asset of Object.keys(PYTH_PRICE_ID) as Asset[]) {
    if (normalizePriceId(PYTH_PRICE_ID[asset]) === normalizedInput) {
      return asset;
    }
  }

  return undefined;
}

function isActiveMarket(market: ScannedMarket, nowSec: number): boolean {
  return market.outcome === 0 && market.betDeadline > BigInt(nowSec);
}

export function bucketMarkets(markets: ScannedMarket[], nowSec: number): BucketedMarkets {
  const buckets = createEmptyBuckets();

  for (const market of markets) {
    if (!isActiveMarket(market, nowSec)) {
      continue;
    }

    const asset = assetFromPriceId(market.pythPriceId);
    const cadence = parseCadenceTag(market.question);

    if (!asset || cadence === "unknown") {
      buckets.unknown.push(market);
      continue;
    }

    buckets[asset][cadence].push(market);
  }

  return buckets;
}

export async function scanActiveMarkets(
  reader: MarketReader,
  nowSec: number,
): Promise<BucketedMarkets> {
  const total = await reader.marketCount();
  const markets: ScannedMarket[] = [];

  for (let from = 0n; from < total; from += PAGE_SIZE) {
    const toExclusive = from + PAGE_SIZE > total ? total : from + PAGE_SIZE;
    const page = await reader.getMarketsPage(from, toExclusive);

    for (let index = 0; index < page.length; index += 1) {
      const market = page[index];
      markets.push({
        ...market,
        id: from + BigInt(index),
      });
    }
  }

  return bucketMarkets(markets, nowSec);
}
