import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BucketedMarkets } from "../lib/market-scan.ts";
import {
  listSnapshotMarketIds,
  runScheduleOnce,
  type ScheduleDeps,
} from "../MarketScheduler.ts";

type AsyncVoid = () => Promise<void> | void;

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON_PATH = pathResolve(HERE, "../package.json");
const cases: Array<{ name: string; fn: AsyncVoid }> = [];

function test(name: string, fn: AsyncVoid) {
  cases.push({ name, fn });
}

function makeMarket(id: bigint): BucketedMarkets["unknown"][number] {
  return {
    id,
    pythPriceId: "0x01",
    betDeadline: 1n,
    resolveAfter: 2n,
    outcome: 0,
    question: `market-${id}`,
  };
}

function makeEmptySnapshot(): BucketedMarkets {
  return {
    BTC: { daily: [], weekly: [], monthly: [], quarterly: [] },
    ETH: { daily: [], weekly: [], monthly: [], quarterly: [] },
    SOL: { daily: [], weekly: [], monthly: [], quarterly: [] },
    unknown: [],
  };
}

test("dryRun=true 时只 scan + compute gaps + log，不触发写链或 seed 查询", async () => {
  const snapshot = makeEmptySnapshot();
  const calls = {
    scan: 0,
    create: 0,
    fetchSeeded: 0,
    ensureSeed: 0,
  };
  const logs: string[] = [];
  const deps: ScheduleDeps = {
    dryRun: true,
    async scanActiveMarkets() {
      calls.scan += 1;
      return snapshot;
    },
    async createMissingMarkets() {
      calls.create += 1;
      return [];
    },
    async fetchAlreadySeeded() {
      calls.fetchSeeded += 1;
      return new Set<bigint>();
    },
    async ensureSeedForMarkets() {
      calls.ensureSeed += 1;
    },
    logger: {
      log(message) {
        logs.push(String(message));
      },
      error() {},
    },
  };

  await runScheduleOnce(deps);

  assert.deepEqual(calls, {
    scan: 1,
    create: 0,
    fetchSeeded: 0,
    ensureSeed: 0,
  });
  assert.equal(logs.length, 2);
  assert.match(logs[0], /^gaps=\d+ snapshot=\d+ unknown=\d+$/);
  assert.match(logs[1], /DRY_RUN.*跳过写链/);
});

test("非 dryRun 时会调用 create 与 ensureSeed", async () => {
  const snapshot = makeEmptySnapshot();
  snapshot.BTC.daily.push(makeMarket(10n));
  const calls = {
    create: 0,
    fetchSeeded: 0,
    ensureSeed: 0,
  };
  const seededInputs: bigint[][] = [];

  const deps: ScheduleDeps = {
    dryRun: false,
    async scanActiveMarkets() {
      return snapshot;
    },
    async createMissingMarkets() {
      calls.create += 1;
      return [
        {
          id: 20n,
          gap: { asset: "BTC", cadence: "weekly", offsetPct: 0 },
          question: "created-20",
        },
      ];
    },
    async fetchAlreadySeeded() {
      calls.fetchSeeded += 1;
      return new Set<bigint>();
    },
    async ensureSeedForMarkets(ids) {
      calls.ensureSeed += 1;
      seededInputs.push([...ids]);
    },
    logger: {
      log() {},
      error() {},
    },
  };

  await runScheduleOnce(deps);

  assert.deepEqual(calls, {
    create: 1,
    fetchSeeded: 1,
    ensureSeed: 1,
  });
  assert.deepEqual(seededInputs, [[10n, 20n]]);
});

test("已 seed 的 marketId 不传给 ensureSeed，unknown 桶 active id 与新建 id 仍进入候选", async () => {
  const snapshot = makeEmptySnapshot();
  snapshot.BTC.daily.push(makeMarket(101n));
  snapshot.unknown.push(makeMarket(202n));
  let ensureIds: bigint[] | undefined;

  const deps: ScheduleDeps = {
    dryRun: false,
    async scanActiveMarkets() {
      return snapshot;
    },
    async createMissingMarkets() {
      return [
        {
          id: 303n,
          gap: { asset: "ETH", cadence: "weekly", offsetPct: 0 },
          question: "created-303",
        },
      ];
    },
    async fetchAlreadySeeded() {
      return new Set<bigint>([101n]);
    },
    async ensureSeedForMarkets(ids) {
      ensureIds = [...ids];
    },
    logger: {
      log() {},
      error() {},
    },
  };

  await runScheduleOnce(deps);

  assert.deepEqual(ensureIds, [202n, 303n]);
});

test("listSnapshotMarketIds 遍历 BTC/ETH/SOL 四档并追加 unknown", () => {
  const snapshot = makeEmptySnapshot();
  snapshot.BTC.daily.push(makeMarket(1n));
  snapshot.BTC.weekly.push(makeMarket(2n));
  snapshot.ETH.monthly.push(makeMarket(3n));
  snapshot.SOL.quarterly.push(makeMarket(4n));
  snapshot.unknown.push(makeMarket(5n), makeMarket(6n));

  assert.deepEqual(listSnapshotMarketIds(snapshot), [1n, 2n, 3n, 4n, 5n, 6n]);
});

test("package.json 的 check 包含全部 C 段 checker、QA 文档检查，且保留 A/B 既有 checker", () => {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as {
    scripts?: { check?: string };
  };
  const check = pkg.scripts?.check ?? "";
  const existingCheckers = [
    "tsx test/check_resolve_due_markets.ts",
    "tsx test/check_readme.ts",
    "tsx test/check_scheduler_config.ts",
    "tsx test/check_cadence_tag.ts",
    "tsx test/check_rng.ts",
    "tsx test/check_env.ts",
    "tsx test/check_hermes.ts",
    "tsx test/check_generate_seeds.ts",
    "tsx test/check_topup_thresholds.ts",
    "tsx test/check_topup_main.ts",
  ];
  const cSectionTail = [
    "tsx test/check_market_scan.ts",
    "tsx test/check_compute_gaps.ts",
    "tsx test/check_pick_seeds.ts",
    "tsx test/check_seed_amount.ts",
    "tsx test/check_seed_events.ts",
    "tsx test/check_scheduler_main.ts",
  ];
  const qaCheckers = [
    "node ../../../docs/qa/check_phase16_manual_qa.mjs",
    "node ../../../docs/qa/check_phase16_manual_qa_selftest.mjs",
  ];

  for (const checker of existingCheckers) {
    assert.match(check, new RegExp(checker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const checker of qaCheckers) {
    assert.match(check, new RegExp(checker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.equal(check.endsWith(`${cSectionTail.join(" && ")} && ${qaCheckers.join(" && ")}`), true);
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
  console.error(`共 ${failures} 个 scheduler 主入口检查失败`);
  process.exit(1);
}

console.log(`全部 ${cases.length} 个 scheduler 主入口检查通过`);
