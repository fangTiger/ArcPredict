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

test("pickK 同种子同结果", () => {
  const pool = [0,1,2,3,4,5,6,7,8,9];
  const a = pickK(pool, 3, mulberry32(123));
  const b = pickK(pool, 3, mulberry32(123));
  assert.deepEqual(a, b);
});

test("deterministicSeedFromBigInt 在 uint32 范围内", () => {
  const huge = 2n ** 200n + 12345n;
  const s = deterministicSeedFromBigInt(huge);
  assert.ok(s >= 0 && s < 2 ** 32);
});

for (const c of cases) {
  try { c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
