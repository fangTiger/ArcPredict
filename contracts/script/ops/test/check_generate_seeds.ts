import assert from "node:assert/strict";
import { buildSeedFileContent, buildWebSeedListContent } from "../GenerateSeeds.ts";

const cases: Array<{ name: string; fn: () => void }> = [];

function test(name: string, fn: () => void) {
  cases.push({ name, fn });
}

const sample = [
  { privateKey: "0xaa", address: "0xAlice" },
  { privateKey: "0xbb", address: "0xBob" },
];

test("buildSeedFileContent 含 count 与所有键", () => {
  const out = buildSeedFileContent(sample as any);
  assert.match(out, /SEED_WALLET_COUNT=2/);
  assert.match(out, /SEED_PRIVATE_KEY_0=0xaa/);
  assert.match(out, /SEED_ADDRESS_0=0xAlice/);
  assert.match(out, /SEED_PRIVATE_KEY_1=0xbb/);
  assert.match(out, /SEED_ADDRESS_1=0xBob/);
});

test("buildSeedFileContent 末尾有换行", () => {
  const out = buildSeedFileContent(sample as any);
  assert.equal(out.endsWith("\n"), true);
});

test("buildWebSeedListContent 只含地址且 lowercase", () => {
  const out = buildWebSeedListContent(sample as any);
  assert.match(out, /export const SEED_WALLETS/);
  assert.match(out, /"0xalice"/);
  assert.match(out, /"0xbob"/);
  assert.doesNotMatch(out, /0xaa/i);
  assert.doesNotMatch(out, /0xbb/i);
});

test("buildWebSeedListContent 输出 readonly 地址类型且不含 privateKey", () => {
  const out = buildWebSeedListContent(sample as any);
  assert.match(out, /readonly `0x\$\{string\}`\[\]/);
  assert.doesNotMatch(out, /privateKey/);
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
