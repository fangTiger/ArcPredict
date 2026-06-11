import assert from "node:assert/strict";
import { BALANCE_THRESHOLDS, classifyBalance } from "../lib/thresholds.ts";

const cases: Array<{ name: string; fn: () => void }> = [];

function test(name: string, fn: () => void) {
  cases.push({ name, fn });
}

test("BALANCE_THRESHOLDS 单调 skip < warn", () => {
  assert.ok(BALANCE_THRESHOLDS.skip < BALANCE_THRESHOLDS.warn);
});

test("BALANCE_THRESHOLDS.warn 固定为最低 10 USDC", () => {
  assert.equal(BALANCE_THRESHOLDS.warn, 10_000_000n);
});

test("USDC >= warn 且 native >= gasMin -> healthy", () => {
  const result = classifyBalance({
    usdc: 100_000_000n,
    native: BALANCE_THRESHOLDS.gasMin,
  });
  assert.equal(result, "healthy");
});

test("USDC < skip -> skipSeed", () => {
  const result = classifyBalance({
    usdc: 1_000_000n,
    native: BALANCE_THRESHOLDS.gasMin,
  });
  assert.equal(result, "skipSeed");
});

test("skip <= USDC < warn -> needsTopup", () => {
  const result = classifyBalance({
    usdc: 9_999_999n,
    native: BALANCE_THRESHOLDS.gasMin,
  });
  assert.equal(result, "needsTopup");
});

test("USDC 低于 10 USDC 但未低于 skip 时归类 needsTopup", () => {
  const result = classifyBalance({
    usdc: 5_000_001n,
    native: BALANCE_THRESHOLDS.gasMin,
  });
  assert.equal(result, "needsTopup");
});

test("native < gasMin -> skipSeed，即便 USDC 满", () => {
  const result = classifyBalance({
    usdc: 100_000_000n,
    native: 0n,
  });
  assert.equal(result, "skipSeed");
});

test("USDC == skip 时归类 needsTopup", () => {
  const result = classifyBalance({
    usdc: BALANCE_THRESHOLDS.skip,
    native: BALANCE_THRESHOLDS.gasMin,
  });
  assert.equal(result, "needsTopup");
});

test("USDC == warn 时归类 healthy", () => {
  const result = classifyBalance({
    usdc: 10_000_000n,
    native: BALANCE_THRESHOLDS.gasMin,
  });
  assert.equal(result, "healthy");
});

test("native == gasMin 不因 gas 触发 skip", () => {
  const result = classifyBalance({
    usdc: BALANCE_THRESHOLDS.warn,
    native: BALANCE_THRESHOLDS.gasMin,
  });
  assert.equal(result, "healthy");
});

for (const c of cases) {
  try {
    c.fn();
    console.log(`OK: ${c.name}`);
  } catch (error) {
    console.error(`FAIL: ${c.name}`, error);
    process.exit(1);
  }
}
