import { HermesClient } from "@pythnetwork/hermes-client";
import { pathToFileURL } from "node:url";
import { parseAbi, type Abi, type Address, type Hex } from "viem";
import {
  makePublicClient,
  makeWalletClientForKey,
  normalizePrivateKey,
  withHexPrefix,
} from "./lib/clients.ts";
import { loadPredictionMarketAbi } from "./lib/abi.ts";
import { loadOwnerEnv } from "./lib/env.ts";

type Logger = Pick<Console, "log" | "error">;

type ReadContractArgs = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

type WriteContractArgs = {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  value: bigint;
};

type PriceUpdateOptions = {
  encoding: "hex";
  parsed: false;
};

type PriceUpdateResponse = {
  binary: {
    data: string[];
  };
};

export type MarketSnapshot = {
  pythPriceId: Hex;
  resolveAfter: bigint;
  outcome: number;
};

export type ResolveDueMarketsDependencies = {
  publicClient: {
    readContract(parameters: ReadContractArgs): Promise<unknown>;
  };
  walletClient: {
    writeContract(parameters: WriteContractArgs): Promise<Hex>;
  };
  hermesClient: {
    getPriceUpdatesAtTimestamp(
      publishTime: number,
      ids: string[],
      options: PriceUpdateOptions,
    ): Promise<PriceUpdateResponse>;
  };
  logger?: Logger;
  marketAddress: Address;
  pythAddress: Address;
  predictionMarketAbi: Abi;
  now?: () => number;
};

const PYTH_FEE_ABI = parseAbi(["function getUpdateFee(bytes[]) view returns (uint256)"]);
export { withHexPrefix, normalizePrivateKey };

export function decodeMarketSnapshot(rawMarket: unknown): MarketSnapshot {
  const pythPriceId = withHexPrefix(String(readMarketField(rawMarket, "pythPriceId", 0)));
  const resolveAfter = toBigIntValue(readMarketField(rawMarket, "resolveAfter", 4), "resolveAfter");
  const outcome = toNumberValue(readMarketField(rawMarket, "outcome", 11), "outcome");

  return {
    pythPriceId,
    resolveAfter,
    outcome,
  };
}

export function isDueUnresolvedMarket(market: MarketSnapshot, nowSec: number): boolean {
  return market.outcome === 0 && BigInt(nowSec) >= market.resolveAfter;
}

export async function resolveDueMarkets(
  dependencies: ResolveDueMarketsDependencies,
): Promise<void> {
  const logger = dependencies.logger ?? console;
  const now = dependencies.now ?? (() => Math.floor(Date.now() / 1000));
  const marketCount = toBigIntValue(
    await dependencies.publicClient.readContract({
      address: dependencies.marketAddress,
      abi: dependencies.predictionMarketAbi,
      functionName: "marketCount",
    }),
    "marketCount",
  );

  for (let marketId = 0n; marketId < marketCount; marketId += 1n) {
    try {
      const rawMarket = await dependencies.publicClient.readContract({
        address: dependencies.marketAddress,
        abi: dependencies.predictionMarketAbi,
        functionName: "getMarket",
        args: [marketId],
      });
      const market = decodeMarketSnapshot(rawMarket);
      const nowSec = now();

      if (!isDueUnresolvedMarket(market, nowSec)) {
        continue;
      }

      const resolveAfterSec = Number(market.resolveAfter);
      if (nowSec > resolveAfterSec + 300) {
        logger.log(`market ${marketId}: 实时窗口已过，尝试拉历史 update`);
      }

      const priceUpdates = await dependencies.hermesClient.getPriceUpdatesAtTimestamp(
        resolveAfterSec,
        [market.pythPriceId],
        { encoding: "hex", parsed: false },
      );
      const updateData = priceUpdates.binary.data.map((value) => withHexPrefix(value));
      const fee = toBigIntValue(
        await dependencies.publicClient.readContract({
          address: dependencies.pythAddress,
          abi: PYTH_FEE_ABI,
          functionName: "getUpdateFee",
          args: [updateData],
        }),
        "getUpdateFee",
      );

      const txHash = await dependencies.walletClient.writeContract({
        address: dependencies.marketAddress,
        abi: dependencies.predictionMarketAbi,
        functionName: "resolve",
        args: [marketId, updateData],
        value: fee,
      });

      logger.log(`market ${marketId}: 已提交结算交易 ${txHash}`);
    } catch (error) {
      logger.error(
        `market ${marketId}: 结算失败，继续扫描后续市场`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

export async function main(): Promise<void> {
  const runtimeConfig = loadOwnerEnv();
  const predictionMarketAbi = loadPredictionMarketAbi();
  const walletClient = makeWalletClientForKey(
    runtimeConfig.rpcUrl,
    runtimeConfig.ownerPrivateKey,
  );
  const publicClient = makePublicClient(runtimeConfig.rpcUrl);
  const hermesClient = new HermesClient(runtimeConfig.hermesEndpoint);

  await resolveDueMarkets({
    publicClient,
    walletClient,
    hermesClient,
    marketAddress: runtimeConfig.marketAddress,
    pythAddress: runtimeConfig.pythAddress,
    predictionMarketAbi,
  });
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

function isDirectExecution(): boolean {
  return process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error("自动结算脚本执行失败", error);
    process.exit(1);
  });
}
