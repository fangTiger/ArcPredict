import assert from "node:assert/strict";
import type { Address } from "../lib/clients.ts";
import { pickSeedWallets } from "../lib/pick-seeds.ts";

const cases: Array<{ name: string; fn: () => void }> = [];

function test(name: string, fn: () => void) {
  cases.push({ name, fn });
}

function addressAt(i: number): Address {
  return `0x${i.toString(16).padStart(40, "0")}` as Address;
}

const pool = Array.from({ length: 6 }, (_, i) => addressAt(i + 1));

test("同一 marketId 重复调用结果相同", () => {
  const marketId = 123456789n;
  assert.deepEqual(
    pickSeedWallets(marketId, pool),
    pickSeedWallets(marketId, pool),
  );
});

test("pool 长度至少 3 时返回长度始终在 1..3", () => {
  for (let i = 0; i < 50; i++) {
    const picked = pickSeedWallets(BigInt(i + 1), pool);
    assert.ok(picked.length >= 1 && picked.length <= 3, `长度超出范围: ${picked.length}`);
  }
});

test("返回钱包都来自 pool 且不重复", () => {
  for (let i = 0; i < 50; i++) {
    const picked = pickSeedWallets(BigInt(i + 100), pool);
    assert.ok(picked.every((wallet) => pool.includes(wallet)), "返回了池外地址");
    assert.equal(new Set(picked).size, picked.length, "返回了重复地址");
  }
});

test("不修改原 pool", () => {
  const snapshot = [...pool];
  pickSeedWallets(42n, pool);
  assert.deepEqual(pool, snapshot);
});

test("pool 长度为 1/2 时返回长度不超过 pool 且至少 1", () => {
  const single = [addressAt(101)];
  const pair = [addressAt(201), addressAt(202)];

  for (let i = 0; i < 50; i++) {
    const pickedSingle = pickSeedWallets(BigInt(i + 1), single);
    assert.ok(pickedSingle.length >= 1 && pickedSingle.length <= single.length);
    assert.ok(pickedSingle.every((wallet) => single.includes(wallet)));

    const pickedPair = pickSeedWallets(BigInt(i + 1), pair);
    assert.ok(pickedPair.length >= 1 && pickedPair.length <= pair.length);
    assert.ok(pickedPair.every((wallet) => pair.includes(wallet)));
    assert.equal(new Set(pickedPair).size, pickedPair.length, "双钱包池返回了重复地址");
  }
});

test("空 pool 抛中文错误", () => {
  assert.throws(
    () => pickSeedWallets(1n, []),
    /seed 钱包池为空/,
  );
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
