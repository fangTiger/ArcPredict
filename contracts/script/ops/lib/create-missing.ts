import {
  decodeEventLog,
  isAddressEqual,
  parseAbiItem,
  type Abi,
  type Hex,
  type Log,
} from "viem";
import { CADENCE_DURATION, PYTH_PRICE_ID, type Asset } from "../scheduler.config.ts";
import { formatQuestion } from "./cadence-tag.ts";
import type { Address } from "./clients.ts";
import type { Gap } from "./gaps.ts";
import { fetchCurrentPrice, type HermesLike } from "./hermes.ts";

export type CreatedMarket = { id: bigint; gap: Gap; question: string };

type WaitReceiptArgs = { hash: Hex };
type WaitReceiptResult = { logs: readonly Log[] };

type CreateMarketArgs = readonly [
  priceId: `0x${string}`,
  threshold: bigint,
  feedExpo: number,
  betDeadline: bigint,
  resolveAfter: bigint,
  question: string,
];

type PublicClientLike = {
  waitForTransactionReceipt(parameters: WaitReceiptArgs): Promise<WaitReceiptResult>;
};

type WalletClientLike = {
  writeContract(parameters: {
    address: Address;
    abi: Abi;
    functionName: "createMarket";
    args: CreateMarketArgs;
  }): Promise<Hex>;
};

export type CreateMissingDeps = {
  publicClient: PublicClientLike;
  walletClient: WalletClientLike;
  hermes: HermesLike;
  marketAddress: Address;
  abi: Abi;
  feedExpo: number;
  now?: () => number;
  logger?: Pick<Console, "log" | "error">;
};

const INT64_MAX = 2n ** 63n - 1n;
const MARKET_CREATED_EVENT = parseAbiItem(
  "event MarketCreated(uint256 indexed id, bytes32 indexed pythPriceId, int64 threshold, int32 thresholdExpo, uint64 betDeadline, uint64 resolveAfter, uint16 feeBpsSnapshot, address feeRecipientSnapshot, string question)",
);

function defaultNow(): number {
  return Math.floor(Date.now() / 1000);
}

function readNow(now?: () => number): number {
  const value = (now ?? defaultNow)();
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`当前时间无效：${value}`);
  }
  return value;
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function fetchPriceOnce(
  asset: Asset,
  hermes: HermesLike,
  priceCache: Map<Asset, Promise<number>>,
): Promise<number> {
  const cached = priceCache.get(asset);
  if (cached) {
    return cached;
  }

  const pending = fetchCurrentPrice(hermes, PYTH_PRICE_ID[asset]);
  priceCache.set(asset, pending);
  return pending;
}

export function humanThresholdFor(currentPrice: number, offsetPct: number): number {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    throw new Error(`当前价格无效：${currentPrice}`);
  }
  if (!Number.isFinite(offsetPct)) {
    throw new Error(`offsetPct 无效：${offsetPct}`);
  }

  const human = Math.round(currentPrice * (1 + offsetPct / 100));
  if (!Number.isSafeInteger(human) || human <= 0) {
    throw new Error(`人类阈值无效：${human}`);
  }

  return human;
}

export function scaleHumanThreshold(human: number, feedExpo: number): bigint {
  if (!Number.isSafeInteger(human) || human <= 0) {
    throw new Error(`人类阈值无效：${human}`);
  }
  if (!Number.isInteger(feedExpo) || feedExpo > 0 || feedExpo < -18) {
    throw new Error(`feedExpo 只允许 -18 到 0：${feedExpo}`);
  }

  const scaled = BigInt(human) * 10n ** BigInt(-feedExpo);
  if (scaled > INT64_MAX) {
    throw new Error(`阈值超过 int64 上限：${scaled}`);
  }

  return scaled;
}

export function decodeMarketCreatedId(logs: readonly Log[], marketAddress: Address): bigint {
  for (const log of logs) {
    if (!isAddressEqual(log.address, marketAddress)) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: [MARKET_CREATED_EVENT],
        data: log.data,
        topics: log.topics,
        strict: true,
      });

      if (decoded.eventName !== "MarketCreated") {
        continue;
      }

      if (typeof decoded.args.id !== "bigint") {
        throw new Error("MarketCreated id 不是 bigint");
      }

      return decoded.args.id;
    } catch {
      continue;
    }
  }

  throw new Error("未找到 MarketCreated event");
}

export async function createMissingMarkets(
  gaps: Gap[],
  deps: CreateMissingDeps,
): Promise<CreatedMarket[]> {
  const logger = deps.logger ?? console;
  const created: CreatedMarket[] = [];
  const priceCache = new Map<Asset, Promise<number>>();

  for (const gap of gaps) {
    try {
      const currentPrice = await fetchPriceOnce(gap.asset, deps.hermes, priceCache);
      const human = humanThresholdFor(currentPrice, gap.offsetPct);
      const threshold = scaleHumanThreshold(human, deps.feedExpo);
      const nowSec = readNow(deps.now);
      const duration = CADENCE_DURATION[gap.cadence];
      const betDeadline = BigInt(nowSec + duration.betHours * 3600);
      const resolveAfter = BigInt(nowSec + duration.resolveHours * 3600);
      const question = formatQuestion(gap.asset, human, resolveAfter, gap.cadence);
      const priceId = PYTH_PRICE_ID[gap.asset];

      const hash = await deps.walletClient.writeContract({
        address: deps.marketAddress,
        abi: deps.abi,
        functionName: "createMarket",
        args: [priceId, threshold, deps.feedExpo, betDeadline, resolveAfter, question],
      });
      const receipt = await deps.publicClient.waitForTransactionReceipt({ hash });
      const id = decodeMarketCreatedId(receipt.logs, deps.marketAddress);

      created.push({ id, gap, question });
      logger.log(
        `gap 已造单：${gap.asset}/${gap.cadence} offset=${gap.offsetPct} marketId=${id} tx=${hash}`,
      );
    } catch (error) {
      logger.error(
        `gap 造单失败 ${gap.asset}/${gap.cadence} offset=${gap.offsetPct}：${formatErrorMessage(error)}`,
      );
    }
  }

  return created;
}
