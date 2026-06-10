import assert from "node:assert/strict";
import { seedAmount } from "../lib/seed-amount.ts";

const cases: Array<{ name: string; fn: () => void }> = [];

function test(name: string, fn: () => void) {
  cases.push({ name, fn });
}

test("金额始终在 1_000_000n 到 10_000_000n 之间", () => {
  for (let marketId = 1n; marketId <= 50n; marketId++) {
    for (let walletIndex = 0; walletIndex < 6; walletIndex++) {
      for (const side of ["yes", "no"] as const) {
        const amount = seedAmount(marketId, walletIndex, side);
        assert.ok(
          amount >= 1_000_000n && amount <= 10_000_000n,
          `金额超出范围: ${amount.toString()}`,
        );
      }
    }
  }
});

test("YES/NO 对同一 marketId 与 walletIndex 在多次采样里至少有 20 次不同", () => {
  let diffCount = 0;

  for (let marketId = 1n; marketId <= 50n; marketId++) {
    if (seedAmount(marketId, 0, "yes") !== seedAmount(marketId, 0, "no")) {
      diffCount += 1;
    }
  }

  assert.ok(diffCount >= 20, `YES/NO 差异次数不足: ${diffCount}`);
});

test("同输入稳定", () => {
  assert.equal(seedAmount(123n, 2, "yes"), seedAmount(123n, 2, "yes"));
  assert.equal(seedAmount(456n, 3, "no"), seedAmount(456n, 3, "no"));
});

test("不同 walletIndex 在多次采样里能出现差异", () => {
  let diffCount = 0;

  for (let marketId = 1n; marketId <= 50n; marketId++) {
    if (seedAmount(marketId, 0, "yes") !== seedAmount(marketId, 1, "yes")) {
      diffCount += 1;
    }
  }

  assert.ok(diffCount >= 20, `walletIndex 差异次数不足: ${diffCount}`);
});

test("walletIndex 非整数或负数抛中文错误", () => {
  assert.throws(() => seedAmount(1n, -1, "yes"), /walletIndex 必须是非负整数/);
  assert.throws(() => seedAmount(1n, 1.5, "no"), /walletIndex 必须是非负整数/);
});

for (const c of cases) {
  try {
    c.fn();
    console.log(`OK: ${c.name}`);
  } catch (e) {
    console.error(`FAIL: ${c.name}`, e);
    process.exit(1);
  }
}
