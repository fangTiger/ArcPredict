import assert from "node:assert/strict";

import {
  decodeMarketSnapshot,
  isDueUnresolvedMarket,
  normalizePrivateKey,
  resolveDueMarkets,
  withHexPrefix,
} from "../ResolveDueMarkets.ts";

type AsyncVoid = () => Promise<void> | void;
type MockReadConfig = {
  functionName: string;
  args?: readonly unknown[];
};
type MockWriteConfig = {
  args?: readonly unknown[];
  value?: bigint;
};
type MockHermesOptions = { encoding: "hex"; parsed: false };

const testCases: Array<{ name: string; fn: AsyncVoid }> = [];

function test(name: string, fn: AsyncVoid) {
  testCases.push({ name, fn });
}

test("normalizePrivateKey 支持有无 0x 前缀", () => {
  assert.equal(normalizePrivateKey("0x1234"), "0x1234");
  assert.equal(normalizePrivateKey("abcd"), "0xabcd");
  assert.equal(withHexPrefix("beef"), "0xbeef");
  assert.equal(withHexPrefix("0xcafe"), "0xcafe");
});

test("isDueUnresolvedMarket 只识别未结算且已到期市场", () => {
  assert.equal(
    isDueUnresolvedMarket(
      {
        outcome: 0,
        resolveAfter: 100n,
        pythPriceId: "0x01",
      },
      100,
    ),
    true,
  );
  assert.equal(
    isDueUnresolvedMarket(
      {
        outcome: 1,
        resolveAfter: 100n,
        pythPriceId: "0x01",
      },
      100,
    ),
    false,
  );
  assert.equal(
    isDueUnresolvedMarket(
      {
        outcome: 0,
        resolveAfter: 101n,
        pythPriceId: "0x01",
      },
      100,
    ),
    false,
  );
});

test("decodeMarketSnapshot 兼容 tuple-like 返回值", () => {
  const tupleLike = [
    "0xprice",
    0n,
    0,
    0n,
    123n,
    0n,
    0n,
    0n,
    0n,
    0,
    "0x0000000000000000000000000000000000000000",
    0,
    0n,
    0n,
    "BTC >= 70000",
  ] as unknown as readonly unknown[] & {
    pythPriceId: string;
    resolveAfter: bigint;
    outcome: number;
  };
  tupleLike.pythPriceId = "0xprice";
  tupleLike.resolveAfter = 123n;
  tupleLike.outcome = 0;

  const decoded = decodeMarketSnapshot(tupleLike);

  assert.equal(decoded.pythPriceId, "0xprice");
  assert.equal(decoded.resolveAfter, 123n);
  assert.equal(decoded.outcome, 0);
});

test("resolveDueMarkets 只处理到期未结算市场，并把 fee 传给 resolve", async () => {
  const logs: string[] = [];
  const errors: string[] = [];
  const hermesCalls: Array<{
    timestamp: number;
    priceIds: string[];
    options: { encoding: "hex"; parsed: false };
  }> = [];
  const writeCalls: Array<{
    args: readonly [bigint, readonly `0x${string}`[]];
    value: bigint;
  }> = [];
  const feeCalls: Array<readonly `0x${string}`[]> = [];
  const now = 1_000;

  const markets = [
    { pythPriceId: "0xaaa", resolveAfter: 900n, outcome: 0 },
    { pythPriceId: "0xbbb", resolveAfter: 1_100n, outcome: 0 },
    { pythPriceId: "0xccc", resolveAfter: 800n, outcome: 2 },
    { pythPriceId: "0xddd", resolveAfter: 600n, outcome: 0 },
  ];

  await resolveDueMarkets({
    publicClient: {
      async readContract(config: MockReadConfig) {
        if (config.functionName === "marketCount") {
          return 4n;
        }
        if (config.functionName === "getMarket") {
          return markets[Number(config.args?.[0] ?? 0n)];
        }
        if (config.functionName === "getUpdateFee") {
          const updateData = config.args?.[0] as readonly `0x${string}`[];
          feeCalls.push(updateData);
          return 123n;
        }
        throw new Error(`未知 readContract 调用: ${String(config.functionName)}`);
      },
    },
    walletClient: {
      async writeContract(config: MockWriteConfig) {
        writeCalls.push({
          args: config.args as readonly [bigint, readonly `0x${string}`[]],
          value: config.value ?? 0n,
        });
        return "0xhash";
      },
    },
    hermesClient: {
      async getPriceUpdatesAtTimestamp(
        timestamp: number,
        priceIds: string[],
        options: MockHermesOptions,
      ) {
        hermesCalls.push({ timestamp, priceIds, options });
        return {
          binary: {
            data: ["abcd"],
          },
        };
      },
    },
    logger: {
      log: (...args: unknown[]) => logs.push(args.join(" ")),
      error: (...args: unknown[]) => errors.push(args.join(" ")),
    },
    marketAddress: "0x1000000000000000000000000000000000000000",
    pythAddress: "0x2000000000000000000000000000000000000000",
    predictionMarketAbi: [],
    now: () => now,
  });

  assert.equal(errors.length, 0);
  assert.equal(hermesCalls.length, 2);
  assert.deepEqual(hermesCalls[0], {
    timestamp: 900,
    priceIds: ["0xaaa"],
    options: { encoding: "hex", parsed: false },
  });
  assert.deepEqual(hermesCalls[1], {
    timestamp: 600,
    priceIds: ["0xddd"],
    options: { encoding: "hex", parsed: false },
  });
  assert.equal(feeCalls.length, 2);
  assert.deepEqual(feeCalls[0], ["0xabcd"]);
  assert.equal(writeCalls.length, 2);
  assert.deepEqual(writeCalls[0], {
    args: [0n, ["0xabcd"]],
    value: 123n,
  });
  assert.deepEqual(writeCalls[1], {
    args: [3n, ["0xabcd"]],
    value: 123n,
  });
  assert.equal(logs.some((line) => line.includes("实时窗口已过") && line.includes("3")), true);
});

test("resolveDueMarkets 单个市场失败时记录错误并继续后续市场", async () => {
  const errors: string[] = [];
  const resolvedIds: bigint[] = [];

  await resolveDueMarkets({
    publicClient: {
      async readContract(config: MockReadConfig) {
        if (config.functionName === "marketCount") {
          return 3n;
        }
        if (config.functionName === "getMarket") {
          return [
            { pythPriceId: "0x111", resolveAfter: 500n, outcome: 0 },
            { pythPriceId: "0x222", resolveAfter: 400n, outcome: 0 },
            { pythPriceId: "0x333", resolveAfter: 300n, outcome: 0 },
          ][Number(config.args?.[0] ?? 0n)];
        }
        if (config.functionName === "getUpdateFee") {
          return 9n;
        }
        throw new Error(`未知 readContract 调用: ${String(config.functionName)}`);
      },
    },
    walletClient: {
      async writeContract(config: MockWriteConfig) {
        const id = config.args?.[0] as bigint;
        if (id === 1n) {
          throw new Error("resolve 失败");
        }
        resolvedIds.push(id);
        return "0xok";
      },
    },
    hermesClient: {
      async getPriceUpdatesAtTimestamp(timestamp: number) {
        if (timestamp === 500) {
          throw new Error("hermes 失败");
        }
        return {
          binary: {
            data: ["0x99"],
          },
        };
      },
    },
    logger: {
      log: () => undefined,
      error: (...args: unknown[]) => errors.push(args.join(" ")),
    },
    marketAddress: "0x1000000000000000000000000000000000000000",
    pythAddress: "0x2000000000000000000000000000000000000000",
    predictionMarketAbi: [],
    now: () => 1_000,
  });

  assert.equal(errors.length, 2);
  assert.equal(errors[0].includes("market 0"), true);
  assert.equal(errors[1].includes("market 1"), true);
  assert.deepEqual(resolvedIds, [2n]);
});

let failures = 0;

for (const { name, fn } of testCases) {
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
  console.error(`共 ${failures} 个测试失败`);
  process.exit(1);
}

console.log(`全部 ${testCases.length} 个测试通过`);
