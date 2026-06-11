import assert from "node:assert/strict";
import {
  buildSeedFileContent,
  buildWebSeedListContent,
  parseGenerationArgs,
  parseSeedFileContent,
  type Seed,
} from "../GenerateSeeds.ts";

const cases: Array<{ name: string; fn: () => void }> = [];

function test(name: string, fn: () => void) {
  cases.push({ name, fn });
}

const sample: Seed[] = [
  {
    privateKey: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    address: "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa",
  },
  {
    privateKey: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    address: "0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb",
  },
];

test("buildSeedFileContent 含 count 与所有键", () => {
  const out = buildSeedFileContent(sample);
  assert.match(out, /SEED_WALLET_COUNT=2/);
  assert.match(out, /SEED_PRIVATE_KEY_0=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/);
  assert.match(out, /SEED_ADDRESS_0=0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa/);
  assert.match(out, /SEED_PRIVATE_KEY_1=0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/);
  assert.match(out, /SEED_ADDRESS_1=0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb/);
});

test("buildSeedFileContent 末尾有换行", () => {
  const out = buildSeedFileContent(sample);
  assert.equal(out.endsWith("\n"), true);
});

test("buildWebSeedListContent 只含地址且 lowercase", () => {
  const out = buildWebSeedListContent(sample);
  assert.match(out, /export const SEED_WALLETS/);
  assert.match(out, /"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"/);
  assert.match(out, /"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"/);
  assert.doesNotMatch(out, /0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/i);
  assert.doesNotMatch(out, /0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/i);
});

test("buildWebSeedListContent 输出 readonly 地址类型且不含 privateKey", () => {
  const out = buildWebSeedListContent(sample);
  assert.match(out, /readonly `0x\$\{string\}`\[\]/);
  assert.doesNotMatch(out, /privateKey/);
});

test("buildWebSeedListContent 注释说明 generate-seeds 写入真实公开地址且不写死阶段名", () => {
  const out = buildWebSeedListContent(sample);
  assert.match(out, /generate-seeds/);
  assert.match(out, /(写入|替换)[\s\S]{0,40}真实地址|真实地址[\s\S]{0,40}(写入|替换)/);
  assert.doesNotMatch(out, /E1/);
});

test("parseGenerationArgs 默认非 append 且 count=12", () => {
  assert.deepEqual(parseGenerationArgs([]), { append: false, count: 12 });
});

test("parseGenerationArgs 支持 --count=5", () => {
  assert.deepEqual(parseGenerationArgs(["--count=5"]), { append: false, count: 5 });
});

test("parseGenerationArgs 支持 --append=3", () => {
  assert.deepEqual(parseGenerationArgs(["--append=3"]), { append: true, count: 3 });
});

test("parseGenerationArgs 支持 --append --count=4", () => {
  assert.deepEqual(parseGenerationArgs(["--append", "--count=4"]), { append: true, count: 4 });
});

test("parseGenerationArgs 非法 count / append 数量抛中文错误", () => {
  assert.throws(() => parseGenerationArgs(["--count=0"]), /正整数/);
  assert.throws(() => parseGenerationArgs(["--count=abc"]), /正整数/);
  assert.throws(() => parseGenerationArgs(["--append=0"]), /正整数/);
  assert.throws(() => parseGenerationArgs(["--append=abc"]), /正整数/);
});

test("parseSeedFileContent 可解析完整 .env.seeds", () => {
  const content = buildSeedFileContent(sample);
  assert.deepEqual(parseSeedFileContent(content), sample);
});

test("parseSeedFileContent 要求 SEED_WALLET_COUNT 为正整数", () => {
  assert.throws(() => parseSeedFileContent("SEED_WALLET_COUNT=0\n"), /SEED_WALLET_COUNT.*正整数/);
  assert.throws(() => parseSeedFileContent("SEED_WALLET_COUNT=abc\n"), /SEED_WALLET_COUNT.*正整数/);
});

test("parseSeedFileContent 缺少私钥时报错，不允许静默跳过", () => {
  assert.throws(
    () =>
      parseSeedFileContent(
        [
          "SEED_WALLET_COUNT=2",
          `SEED_PRIVATE_KEY_0=${sample[0].privateKey}`,
          `SEED_ADDRESS_0=${sample[0].address}`,
          `SEED_ADDRESS_1=${sample[1].address}`,
          "",
        ].join("\n"),
      ),
    /SEED_PRIVATE_KEY_1 \/ SEED_ADDRESS_1 缺失/,
  );
});

test("parseSeedFileContent 缺少地址时报错，不允许静默跳过", () => {
  assert.throws(
    () =>
      parseSeedFileContent(
        [
          "SEED_WALLET_COUNT=2",
          `SEED_PRIVATE_KEY_0=${sample[0].privateKey}`,
          `SEED_ADDRESS_0=${sample[0].address}`,
          `SEED_PRIVATE_KEY_1=${sample[1].privateKey}`,
          "",
        ].join("\n"),
      ),
    /SEED_PRIVATE_KEY_1 \/ SEED_ADDRESS_1 缺失/,
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
