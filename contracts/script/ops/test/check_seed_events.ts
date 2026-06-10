import assert from "node:assert/strict";
import type { Address } from "../lib/clients.ts";
import { collectSeededMarketIds, fetchBetEvents, type BetEvent } from "../lib/seed-events.ts";

type TestCase = {
  name: string;
  fn: () => void | Promise<void>;
};

const cases: TestCase[] = [];

function test(name: string, fn: TestCase["fn"]) {
  cases.push({ name, fn });
}

function addressAt(i: number): Address {
  return `0x${i.toString(16).padStart(40, "0")}` as Address;
}

const seedA = addressAt(1);
const seedB = addressAt(2);
const outsider = addressAt(3);
const marketAddress = addressAt(999);
const seeds: Address[] = [seedA, seedB];

test("seed 钱包 Bet -> marketId 进集合", () => {
  const events: BetEvent[] = [
    { id: 1n, user: seedA, yes: true, amount: 5_000_000n },
  ];

  const seeded = collectSeededMarketIds(events, seeds);

  assert.ok(seeded.has(1n));
  assert.equal(seeded.size, 1);
});

test("非 seed Bet -> 不进集合", () => {
  const events: BetEvent[] = [
    { id: 2n, user: outsider, yes: true, amount: 5_000_000n },
  ];

  const seeded = collectSeededMarketIds(events, seeds);

  assert.equal(seeded.size, 0);
});

test("地址大小写不敏感", () => {
  const events: BetEvent[] = [
    { id: 3n, user: seedA.toUpperCase() as Address, yes: false, amount: 7_000_000n },
  ];

  const seeded = collectSeededMarketIds(events, seeds.map((seed) => seed.toUpperCase() as Address));

  assert.ok(seeded.has(3n));
});

test("同一市场多个 seed Bet 只在集合出现一次", () => {
  const events: BetEvent[] = [
    { id: 4n, user: seedA, yes: true, amount: 1_000_000n },
    { id: 4n, user: seedB, yes: false, amount: 2_000_000n },
    { id: 4n, user: seedA, yes: false, amount: 3_000_000n },
  ];

  const seeded = collectSeededMarketIds(events, seeds);

  assert.deepEqual([...seeded], [4n]);
});

test("空 seed 池不会匹配任何事件", () => {
  const events: BetEvent[] = [
    { id: 5n, user: seedA, yes: true, amount: 5_000_000n },
  ];

  const seeded = collectSeededMarketIds(events, []);

  assert.equal(seeded.size, 0);
});

test("fetchBetEvents 用 stub client 校验参数并映射日志", async () => {
  let captured:
    | {
        address: Address;
        event: unknown;
        fromBlock: bigint;
        toBlock: bigint | "latest";
      }
    | undefined;

  const client = {
    async getLogs(params: {
      address: Address;
      event: unknown;
      fromBlock: bigint;
      toBlock: bigint | "latest";
    }) {
      captured = params;
      return [
        { args: { id: 11n, user: seedA, yes: true, amount: 6_000_000n } },
        { args: { id: 12n, user: seedB, yes: false, amount: 8_000_000n } },
      ];
    },
  };

  const events = await fetchBetEvents(client, marketAddress, 123n);

  assert.deepEqual(captured, {
    address: marketAddress,
    event: captured?.event,
    fromBlock: 123n,
    toBlock: "latest",
  });
  assert.deepEqual(events, [
    { id: 11n, user: seedA, yes: true, amount: 6_000_000n },
    { id: 12n, user: seedB, yes: false, amount: 8_000_000n },
  ]);
});

test("fetchBetEvents 遇到缺少必需参数的日志会抛中文错误", async () => {
  const client = {
    async getLogs() {
      return [
        { args: { id: 21n, user: seedA, yes: true } },
      ];
    },
  };

  await assert.rejects(
    () => fetchBetEvents(client, marketAddress, 456n, 789n),
    /Bet 事件缺少必需参数/,
  );
});

for (const c of cases) {
  try {
    await c.fn();
    console.log(`OK: ${c.name}`);
  } catch (error) {
    console.error(`FAIL: ${c.name}`, error);
    process.exit(1);
  }
}
