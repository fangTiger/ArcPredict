import assert from "node:assert/strict";
import { mulberry32, pickK, deterministicSeedFromBigInt } from "../lib/rng.ts";

const cases: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void) { cases.push({ name, fn }); }

test("mulberry32 同种子结果一致", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    assert.equal(a(), b());
  }
});

test("mulberry32(42) 前 5 个输出固定", () => {
  const rng = mulberry32(42);
  assert.deepEqual(
    Array.from({ length: 5 }, () => rng()),
    [
      0.6011037519201636,
      0.44829055899754167,
      0.8524657934904099,
      0.6697340414393693,
      0.17481389874592423,
    ],
  );
});

test("mulberry32 不同种子结果不同", () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  let diff = 0;
  for (let i = 0; i < 100; i++) {
    if (a() !== b()) diff++;
  }
  assert.ok(diff > 90, "100 次取值至少 90 次不同");
});

test("pickK 长度正确且不重复", () => {
  const pool = [0,1,2,3,4,5,6,7,8,9];
  const picked = pickK(pool, 3, mulberry32(123));
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked).size, 3);
  for (const p of picked) assert.ok(pool.includes(p));
});

test("pickK 固定种子固定选择结果", () => {
  assert.deepEqual(
    pickK([0,1,2,3,4,5,6,7,8,9], 3, mulberry32(123)),
    [7, 2, 5],
  );
});

test("pickK 同种子同结果", () => {
  const pool = [0,1,2,3,4,5,6,7,8,9];
  const a = pickK(pool, 3, mulberry32(123));
  const b = pickK(pool, 3, mulberry32(123));
  assert.deepEqual(a, b);
});

test("pickK 不修改原数组", () => {
  const pool = [0,1,2,3,4,5,6,7,8,9];
  const snapshot = [...pool];
  pickK(pool, 3, mulberry32(123));
  assert.deepEqual(pool, snapshot);
});

test("pickK 对 k 大于 pool.length 抛错", () => {
  assert.throws(() => pickK([0,1,2], 4, mulberry32(1)));
});

test("pickK 对 k 小于 0 抛错", () => {
  assert.throws(() => pickK([0,1,2], -1, mulberry32(1)));
});

test("pickK 对非整数 k 抛错", () => {
  assert.throws(() => pickK([0,1,2], 1.5, mulberry32(1)));
});

test("pickK 对 rand() 返回 1 抛错", () => {
  assert.throws(() => pickK([0,1,2], 1, () => 1));
});

test("pickK 对 rand() 返回负数抛错", () => {
  assert.throws(() => pickK([0,1,2], 1, () => -0.1));
});

test("pickK 对 rand() 返回 NaN 抛错", () => {
  assert.throws(() => pickK([0,1,2], 1, () => Number.NaN));
});

test("deterministicSeedFromBigInt 在 uint32 范围内", () => {
  const huge = 2n ** 200n + 12345n;
  const s = deterministicSeedFromBigInt(huge);
  assert.ok(s >= 0 && s < 2 ** 32);
});

test("deterministicSeedFromBigInt 保留低 32 位", () => {
  assert.equal(deterministicSeedFromBigInt(2n ** 200n + 12345n), 12345);
});

for (const c of cases) {
  try { c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
