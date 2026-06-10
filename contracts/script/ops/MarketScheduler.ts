import { pathToFileURL } from "node:url";
import type { CreatedMarket } from "./lib/create-missing.ts";
import { createMissingMarkets as realCreate } from "./lib/create-missing.ts";
import type { SeedConfig } from "./lib/ensure-seed.ts";
import { ensureSeedForMarkets as realEnsureSeed } from "./lib/ensure-seed.ts";
import { loadPredictionMarketAbi } from "./lib/abi.ts";
import { makePublicClient, makeWalletClientForKey, withHexPrefix } from "./lib/clients.ts";
import { loadOwnerEnv, loadSeedsEnv } from "./lib/env.ts";
import { computeGaps } from "./lib/gaps.ts";
import { makeHermesClient } from "./lib/hermes.ts";
import type { BucketedMarkets, MarketReader, ScannedMarket } from "./lib/market-scan.ts";
import { scanActiveMarkets as realScan } from "./lib/market-scan.ts";
import { collectSeededMarketIds, fetchBetEvents } from "./lib/seed-events.ts";
import { DEPLOY_BLOCK, validateConfig } from "./scheduler.config.ts";

const ASSETS = ["BTC", "ETH", "SOL"] as const;
const CADENCES = ["daily", "weekly", "monthly", "quarterly"] as const;
const FEED_EXPO = -8;

type Logger = Pick<Console, "log" | "error">;

export type ScheduleDeps = {
  dryRun: boolean;
  scanActiveMarkets: () => Promise<BucketedMarkets>;
  createMissingMarkets: (gaps: ReturnType<typeof computeGaps>) => Promise<CreatedMarket[]>;
  fetchAlreadySeeded: () => Promise<Set<bigint>>;
  ensureSeedForMarkets: (ids: bigint[]) => Promise<void>;
  logger: Logger;
};

export function listSnapshotMarketIds(snapshot: BucketedMarkets): bigint[] {
  const ids: bigint[] = [];

  for (const asset of ASSETS) {
    for (const cadence of CADENCES) {
      ids.push(...snapshot[asset][cadence].map((market) => market.id));
    }
  }

  ids.push(...snapshot.unknown.map((market) => market.id));
  return ids;
}

export async function runScheduleOnce(deps: ScheduleDeps): Promise<void> {
  const snapshot = await deps.scanActiveMarkets();
  const gaps = computeGaps(snapshot);
  deps.logger.log(
    `gaps=${gaps.length} snapshot=${countKnownSnapshotMarkets(snapshot)} unknown=${snapshot.unknown.length}`,
  );

  if (deps.dryRun) {
    deps.logger.log("DRY_RUN：只扫描与计算缺口，跳过写链和 seed 检查");
    return;
  }

  const created = await deps.createMissingMarkets(gaps);
  const allIds = [...listSnapshotMarketIds(snapshot), ...created.map((market) => market.id)];
  const alreadySeeded = await deps.fetchAlreadySeeded();
  await deps.ensureSeedForMarkets(allIds.filter((id) => !alreadySeeded.has(id)));
}

function countKnownSnapshotMarkets(snapshot: BucketedMarkets): number {
  let count = 0;

  for (const asset of ASSETS) {
    for (const cadence of CADENCES) {
      count += snapshot[asset][cadence].length;
    }
  }

  return count;
}

function readMarketField(rawMarket: unknown, key: string, tupleIndex: number): unknown {
  if (rawMarket && typeof rawMarket === "object") {
    const record = rawMarket as Record<string, unknown>;
    if (record[key] !== undefined) {
      return record[key];
    }
  }

  if (Array.isArray(rawMarket) && rawMarket[tupleIndex] !== undefined) {
    return rawMarket[tupleIndex];
  }

  throw new Error(`市场字段缺失：${key}`);
}

function toBigIntValue(value: unknown, fieldName: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value);
  }

  if (typeof value === "string" && value.trim() !== "") {
    return BigInt(value);
  }

  throw new Error(`字段 ${fieldName} 不是有效整数`);
}

function toNumberValue(value: unknown, fieldName: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }

  throw new Error(`字段 ${fieldName} 不是有效数字`);
}

function toStringValue(value: unknown, fieldName: string): string {
  if (typeof value === "string") {
    return value;
  }

  throw new Error(`字段 ${fieldName} 不是有效字符串`);
}

function decodeScannedMarket(rawMarket: unknown): Omit<ScannedMarket, "id"> {
  return {
    pythPriceId: withHexPrefix(String(readMarketField(rawMarket, "pythPriceId", 0))),
    betDeadline: toBigIntValue(readMarketField(rawMarket, "betDeadline", 3), "betDeadline"),
    resolveAfter: toBigIntValue(readMarketField(rawMarket, "resolveAfter", 4), "resolveAfter"),
    outcome: toNumberValue(readMarketField(rawMarket, "outcome", 11), "outcome"),
    question: toStringValue(readMarketField(rawMarket, "question", 14), "question"),
  };
}

function isDirectExecution(): boolean {
  return process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
}

export async function main(): Promise<void> {
  validateConfig();

  const ownerConfig = loadOwnerEnv();
  const seedsConfig = loadSeedsEnv();
  const dryRun = process.env.DRY_RUN === "1";
  const publicClient = makePublicClient(ownerConfig.rpcUrl);
  const walletClient = makeWalletClientForKey(ownerConfig.rpcUrl, ownerConfig.ownerPrivateKey);
  const hermes = makeHermesClient(ownerConfig.hermesEndpoint);
  const abi = loadPredictionMarketAbi();
  let latestAlreadySeeded = new Set<bigint>();

  const reader: MarketReader = {
    async marketCount() {
      return toBigIntValue(
        await publicClient.readContract({
          address: ownerConfig.marketAddress,
          abi,
          functionName: "marketCount",
        }),
        "marketCount",
      );
    },
    async getMarketsPage(from, toExclusive) {
      const rawMarkets = await publicClient.readContract({
        address: ownerConfig.marketAddress,
        abi,
        functionName: "getMarketsPaged",
        args: [from, toExclusive],
      });

      if (!Array.isArray(rawMarkets)) {
        throw new Error("getMarketsPaged 返回值不是数组");
      }

      return rawMarkets.map((rawMarket) => decodeScannedMarket(rawMarket));
    },
  };

  const seedConfig: SeedConfig = {
    rpcUrl: seedsConfig.rpcUrl,
    marketAddress: seedsConfig.marketAddress,
    usdcAddress: seedsConfig.usdcAddress,
    marketAbi: abi,
    seeds: seedsConfig.seeds,
  };

  await runScheduleOnce({
    dryRun,
    scanActiveMarkets: async () => realScan(reader, Math.floor(Date.now() / 1000)),
    createMissingMarkets: async (gaps) =>
      realCreate(gaps, {
        publicClient,
        walletClient,
        hermes,
        marketAddress: ownerConfig.marketAddress,
        abi,
        feedExpo: FEED_EXPO,
      }),
    fetchAlreadySeeded: async () => {
      const events = await fetchBetEvents(publicClient, ownerConfig.marketAddress, DEPLOY_BLOCK);
      latestAlreadySeeded = collectSeededMarketIds(
        events,
        seedsConfig.seeds.map((seed) => seed.address),
      );
      return latestAlreadySeeded;
    },
    ensureSeedForMarkets: async (ids) => {
      await realEnsureSeed(ids, {
        publicClient,
        config: seedConfig,
        alreadySeeded: latestAlreadySeeded,
      });
    },
    logger: console,
  });
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error("MarketScheduler 失败", error);
    process.exit(1);
  });
}
