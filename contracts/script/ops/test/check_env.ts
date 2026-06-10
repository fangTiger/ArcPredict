import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { loadOwnerEnv, loadSeedsEnv } from "../lib/env.ts";

type AsyncVoid = () => Promise<void> | void;

const testCases: Array<{ name: string; fn: AsyncVoid }> = [];

function test(name: string, fn: AsyncVoid) {
  testCases.push({ name, fn });
}

function createEnvFiles(options?: {
  ownerEnv?: string;
  seedsEnv?: string;
}) {
  const dir = mkdtempSync(path.join(tmpdir(), "arcpredict-env-"));
  const ownerEnvPath = path.join(dir, ".env");
  const seedsEnvPath = path.join(dir, ".env.seeds");

  writeFileSync(
    ownerEnvPath,
    options?.ownerEnv ??
      [
        "RPC_URL=https://owner.example/rpc",
        "PREDICTION_MARKET=0x1111111111111111111111111111111111111111",
        "USDC_ADDRESS=0x2222222222222222222222222222222222222222",
        "OWNER_PRIVATE_KEY=1234",
        "PYTH_ADDRESS=0x3333333333333333333333333333333333333333",
      ].join("\n"),
    "utf8",
  );

  writeFileSync(
    seedsEnvPath,
    options?.seedsEnv ??
      [
        "SEED_WALLET_COUNT=1",
        "SEED_PRIVATE_KEY_0=0x1111",
        "SEED_ADDRESS_0=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ].join("\n"),
    "utf8",
  );

  return { ownerEnvPath, seedsEnvPath };
}

test("loadSeedsEnv 只从 .env.seeds 读取 seed 钱包，公共配置允许 runtime 覆盖", () => {
  const { ownerEnvPath, seedsEnvPath } = createEnvFiles();

  const env = loadSeedsEnv({
    ownerEnvPath,
    seedsEnvPath,
    runtimeEnv: {
      RPC_URL: "https://runtime.example/rpc",
      SEED_WALLET_COUNT: "3",
      SEED_PRIVATE_KEY_0: "0x2222",
      SEED_ADDRESS_0: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
  });

  assert.equal(env.rpcUrl, "https://runtime.example/rpc");
  assert.equal(env.marketAddress, "0x1111111111111111111111111111111111111111");
  assert.equal(env.usdcAddress, "0x2222222222222222222222222222222222222222");
  assert.deepEqual(env.seeds, [
    {
      privateKey: "0x1111",
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  ]);
});

test("loadSeedsEnv 缺少 seed 私钥时报中文错误", () => {
  const { ownerEnvPath, seedsEnvPath } = createEnvFiles({
    seedsEnv: [
      "SEED_WALLET_COUNT=1",
      "SEED_ADDRESS_0=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    ].join("\n"),
  });

  assert.throws(
    () =>
      loadSeedsEnv({
        ownerEnvPath,
        seedsEnvPath,
        runtimeEnv: {},
      }),
    /SEED_PRIVATE_KEY_0 \/ SEED_ADDRESS_0 缺失/,
  );
});

test("loadSeedsEnv 缺少 seed 地址时报中文错误", () => {
  const { ownerEnvPath, seedsEnvPath } = createEnvFiles({
    seedsEnv: [
      "SEED_WALLET_COUNT=1",
      "SEED_PRIVATE_KEY_0=0x1111",
    ].join("\n"),
  });

  assert.throws(
    () =>
      loadSeedsEnv({
        ownerEnvPath,
        seedsEnvPath,
        runtimeEnv: {},
      }),
    /SEED_PRIVATE_KEY_0 \/ SEED_ADDRESS_0 缺失/,
  );
});

test("loadOwnerEnv 允许 runtime 覆盖公共配置，并规范化私钥", () => {
  const { ownerEnvPath } = createEnvFiles();

  const env = loadOwnerEnv({
    ownerEnvPath,
    runtimeEnv: {
      RPC_URL: "https://runtime.example/rpc",
      OWNER_PRIVATE_KEY: "abcd",
    },
  });

  assert.equal(env.rpcUrl, "https://runtime.example/rpc");
  assert.equal(env.marketAddress, "0x1111111111111111111111111111111111111111");
  assert.equal(env.ownerPrivateKey, "0xabcd");
  assert.equal(env.pythAddress, "0x3333333333333333333333333333333333333333");
  assert.equal(env.hermesEndpoint, "https://hermes.pyth.network");
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
  console.error(`共 ${failures} 个 env 检查失败`);
  process.exit(1);
}

console.log(`全部 ${testCases.length} 个 env 检查通过`);
