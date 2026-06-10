import assert from "node:assert/strict";
import { computeGaps } from "../lib/gaps.ts";
import {
  TARGET_ACTIVE,
  THRESHOLD_OFFSETS_PCT,
  type Asset,
  type Cadence,
} from "../scheduler.config.ts";
import type { BucketedMarkets, ScannedMarket } from "../lib/market-scan.ts";

type AsyncVoid = () => Promise<void> | void;

const cases: Array<{ name: string; fn: AsyncVoid }> = [];
const ASSETS: Asset[] = ["BTC", "ETH", "SOL"];
const CADENCES: Cadence[] = ["daily", "weekly", "monthly", "quarterly"];

function test(name: string, fn: AsyncVoid) {
  cases.push({ name, fn });
}

function makeMarket(id: bigint): ScannedMarket {
  return {
    id,
    pythPriceId: "0x0",
    betDeadline: 0n,
    resolveAfter: 0n,
    outcome: 0,
    question: "stub [daily]",
  };
}

function makeEmptyBuckets(): BucketedMarkets {
  return {
    BTC: { daily: [], weekly: [], monthly: [], quarterly: [] },
    ETH: { daily: [], weekly: [], monthly: [], quarterly: [] },
    SOL: { daily: [], weekly: [], monthly: [], quarterly: [] },
    unknown: [],
  };
}

function totalActive(): number {
  let total = 0;
  for (const asset of ASSETS) {
    for (const cadence of CADENCES) {
      total += TARGET_ACTIVE[asset][cadence];
    }
  }
  return total;
}

function fillBucket(
  snapshot: BucketedMarkets,
  asset: Asset,
  cadence: Cadence,
  count: number,
): void {
  for (let i = 0; i < count; i += 1) {
    snapshot[asset][cadence].push(makeMarket(BigInt(i + 1)));
  }
}

test("空快照 → gap 数等于 TARGET_ACTIVE 总和", () => {
  const gaps = computeGaps(makeEmptyBuckets());
  assert.equal(gaps.length, totalActive());
  assert.equal(gaps.length, 26);
});

test("某档已满 → 该档无 gap", () => {
  const snapshot = makeEmptyBuckets();
  fillBucket(snapshot, "BTC", "weekly", TARGET_ACTIVE.BTC.weekly);

  const gaps = computeGaps(snapshot);

  assert.equal(
    gaps.filter((gap) => gap.asset === "BTC" && gap.cadence === "weekly").length,
    0,
  );
});

test("某档超额 → 不删、不返回负 gap", () => {
  const snapshot = makeEmptyBuckets();
  fillBucket(snapshot, "BTC", "weekly", TARGET_ACTIVE.BTC.weekly + 5);

  const gaps = computeGaps(snapshot);

  assert.equal(
    gaps.filter((gap) => gap.asset === "BTC" && gap.cadence === "weekly").length,
    0,
  );
});

test("offsetPct 从阶梯第 have 个开始补到 want - 1", () => {
  const snapshot = makeEmptyBuckets();
  fillBucket(snapshot, "BTC", "weekly", 1);

  const offsets = computeGaps(snapshot)
    .filter((gap) => gap.asset === "BTC" && gap.cadence === "weekly")
    .map((gap) => gap.offsetPct);

  assert.deepEqual(offsets, THRESHOLD_OFFSETS_PCT.weekly.slice(1, TARGET_ACTIVE.BTC.weekly));
  assert.deepEqual(offsets, [0, 3]);
});

test("输出顺序稳定：按 asset/cadence 固定顺序展开", () => {
  const gaps = computeGaps(makeEmptyBuckets());

  assert.deepEqual(gaps[0], {
    asset: "BTC",
    cadence: "daily",
    offsetPct: THRESHOLD_OFFSETS_PCT.daily[0],
  });

  const collapsed = gaps.reduce<string[]>((pairs, gap) => {
    const current = `${gap.asset}/${gap.cadence}`;
    if (pairs[pairs.length - 1] !== current) {
      pairs.push(current);
    }
    return pairs;
  }, []);

  assert.deepEqual(collapsed, [
    "BTC/daily",
    "BTC/weekly",
    "BTC/monthly",
    "BTC/quarterly",
    "ETH/daily",
    "ETH/weekly",
    "ETH/monthly",
    "ETH/quarterly",
    "SOL/daily",
    "SOL/weekly",
    "SOL/monthly",
    "SOL/quarterly",
  ]);
});

test("unknown 桶不抵消任何 gap", () => {
  const emptyGaps = computeGaps(makeEmptyBuckets());
  const snapshot = makeEmptyBuckets();
  snapshot.unknown.push(makeMarket(100n), makeMarket(101n));

  const gaps = computeGaps(snapshot);

  assert.deepEqual(gaps, emptyGaps);
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
  console.error(`共 ${failures} 个 compute-gaps 检查失败`);
  process.exit(1);
}

console.log(`全部 ${cases.length} 个 compute-gaps 检查通过`);
