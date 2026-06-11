import assert from "node:assert/strict";
import {
  formatReport,
  scanWallets,
  shouldExitWithFailure,
  type BalanceFetcher,
  type ScanResult,
} from "../TopUpSeeds.ts";

type AsyncVoid = () => Promise<void> | void;

const testCases: Array<{ name: string; fn: AsyncVoid }> = [];

function test(name: string, fn: AsyncVoid) {
  testCases.push({ name, fn });
}

const seeds = [
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "0xcccccccccccccccccccccccccccccccccccccccc",
] as const;

const usdcByAddress: Record<(typeof seeds)[number], bigint> = {
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": 100_000_000n,
  "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb": 9_999_999n,
  "0xcccccccccccccccccccccccccccccccccccccccc": 0n,
};

function createFetcher(nativeBalance: bigint): BalanceFetcher {
  return {
    async fetchUsdc(addr) {
      return usdcByAddress[addr as keyof typeof usdcByAddress] ?? 0n;
    },
    async fetchNative() {
      return nativeBalance;
    },
  };
}

test("scanWallets 在 gas 充足时把地址分成 healthy / needsTopup / skipSeed", async () => {
  const result = await scanWallets(seeds, createFetcher(100_000_000_000_000_000n));

  assert.deepEqual(result, {
    healthy: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    needsTopup: ["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
    skipSeed: ["0xcccccccccccccccccccccccccccccccccccccccc"],
  });
});

test("gas 不足优先导致所有地址进入 skipSeed", async () => {
  const result = await scanWallets(seeds, createFetcher(1_000_000_000_000_000n));

  assert.deepEqual(result, {
    healthy: [],
    needsTopup: [],
    skipSeed: [...seeds],
  });
});

test("formatReport 输出中文报告、计数摘要与地址清单", () => {
  const result: ScanResult = {
    healthy: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    needsTopup: ["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
    skipSeed: ["0xcccccccccccccccccccccccccccccccccccccccc"],
  };

  const text = formatReport(result);

  assert.match(text, /ArcPredict TopUpSeeds 报告/);
  assert.match(text, /healthy=1 needsTopup=1 skipSeed=1/);
  assert.match(text, /需要顶配的钱包/);
  assert.match(text, /跳过 seed 的钱包/);
  assert.match(text, /0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/);
  assert.match(text, /0xcccccccccccccccccccccccccccccccccccccccc/);
});

test("shouldExitWithFailure 在 needsTopup 或 skipSeed 非空时返回 true，全健康返回 false", () => {
  assert.equal(
    shouldExitWithFailure({
      healthy: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
      needsTopup: [],
      skipSeed: [],
    }),
    false,
  );

  assert.equal(
    shouldExitWithFailure({
      healthy: [],
      needsTopup: ["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
      skipSeed: [],
    }),
    true,
  );

  assert.equal(
    shouldExitWithFailure({
      healthy: [],
      needsTopup: [],
      skipSeed: ["0xcccccccccccccccccccccccccccccccccccccccc"],
    }),
    true,
  );
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
  console.error(`共 ${failures} 个 topup 主流程检查失败`);
  process.exit(1);
}

console.log(`全部 ${testCases.length} 个 topup 主流程检查通过`);
