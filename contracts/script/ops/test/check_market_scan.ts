import assert from "node:assert/strict";
import {
  bucketMarkets,
  scanActiveMarkets,
  type MarketReader,
  type ScannedMarket,
} from "../lib/market-scan.ts";
import { PYTH_PRICE_ID } from "../scheduler.config.ts";

type AsyncVoid = () => Promise<void> | void;

const cases: Array<{ name: string; fn: AsyncVoid }> = [];

function test(name: string, fn: AsyncVoid) {
  cases.push({ name, fn });
}

const NOW = 1_000_000;
const BTC_ID = PYTH_PRICE_ID.BTC;

function mkMarket(
  overrides: Partial<ScannedMarket> = {},
): ScannedMarket {
  return {
    id: 1n,
    pythPriceId: BTC_ID,
    betDeadline: BigInt(NOW + 3600),
    resolveAfter: BigInt(NOW + 7200),
    outcome: 0,
    question: "BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [weekly]",
    ...overrides,
  };
}

test("已结算 outcome 不入桶也不进 unknown", () => {
  const result = bucketMarkets([mkMarket({ outcome: 1 })], NOW);
  assert.equal(result.BTC.weekly.length, 0);
  assert.equal(result.unknown.length, 0);
});

test("betDeadline 小于等于当前时间时不入桶", () => {
  const result = bucketMarkets([mkMarket({ betDeadline: BigInt(NOW) })], NOW);
  assert.equal(result.BTC.weekly.length, 0);
  assert.equal(result.unknown.length, 0);
});

test("正常活跃市场按 asset 与 cadence 入桶", () => {
  const result = bucketMarkets([mkMarket()], NOW);
  assert.equal(result.BTC.weekly.length, 1);
  assert.equal(result.BTC.weekly[0]?.id, 1n);
  assert.equal(result.unknown.length, 0);
});

test("question 无尾部 cadence tag 时进入 unknown", () => {
  const result = bucketMarkets([mkMarket({ question: "BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC" })], NOW);
  assert.equal(result.BTC.weekly.length, 0);
  assert.equal(result.unknown.length, 1);
});

test("priceId 未知 asset 时进入 unknown", () => {
  const result = bucketMarkets([mkMarket({ pythPriceId: "0xffff" })], NOW);
  assert.equal(result.BTC.weekly.length, 0);
  assert.equal(result.unknown.length, 1);
});

test("priceId 大小写与无 0x 前缀兼容", () => {
  const result = bucketMarkets([mkMarket({ pythPriceId: BTC_ID.slice(2).toUpperCase() })], NOW);
  assert.equal(result.BTC.weekly.length, 1);
  assert.equal(result.unknown.length, 0);
});

test("priceId 大小写与带 0X 前缀兼容", () => {
  const result = bucketMarkets([mkMarket({ pythPriceId: `0X${BTC_ID.slice(2).toUpperCase()}` })], NOW);
  assert.equal(result.BTC.weekly.length, 1);
  assert.equal(result.unknown.length, 0);
});

test("scanActiveMarkets 分页读取并按页内索引覆写 id", async () => {
  const calls: Array<[bigint, bigint]> = [];
  const reader: MarketReader = {
    async marketCount() {
      return 55n;
    },
    async getMarketsPage(from, toExclusive) {
      calls.push([from, toExclusive]);
      const page: ScannedMarket[] = [];
      for (let id = from; id < toExclusive; id += 1n) {
        page.push(mkMarket({ id: 999n + id }));
      }
      return page;
    },
  };

  const result = await scanActiveMarkets(reader, NOW);

  assert.deepEqual(calls, [
    [0n, 50n],
    [50n, 55n],
  ]);
  assert.equal(result.BTC.weekly.length, 55);
  assert.equal(result.BTC.weekly[0]?.id, 0n);
  assert.equal(result.BTC.weekly[49]?.id, 49n);
  assert.equal(result.BTC.weekly[50]?.id, 50n);
  assert.equal(result.BTC.weekly[54]?.id, 54n);
});

let failures = 0;

for (const { name, fn } of cases) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  console.error(`共 ${failures} 个 market-scan 检查失败`);
  process.exit(1);
}

console.log(`全部 ${cases.length} 个 market-scan 检查通过`);
