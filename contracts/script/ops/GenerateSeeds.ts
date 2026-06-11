// 一次性脚本：生成 N 个 seed 钱包，写出 .env.seeds 与 web/lib/seed-wallets.ts。
// 只在 owner 人工门禁 E1 后执行；测试只覆盖纯函数，避免误生成真实钱包池。
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "./lib/clients.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_SEEDS_PATH = pathResolve(HERE, "../../.env.seeds");
const WEB_SEEDS_TS_PATH = pathResolve(HERE, "../../../web/lib/seed-wallets.ts");

export type Seed = { privateKey: Hex; address: Address };

const DEFAULT_COUNT = 12;

export function buildSeedFileContent(seeds: readonly Seed[]): string {
  const lines = [
    "# 自动生成，勿手动编辑。",
    "# 由 contracts/script/ops/GenerateSeeds.ts 写出。",
    `SEED_WALLET_COUNT=${seeds.length}`,
  ];

  for (let i = 0; i < seeds.length; i += 1) {
    lines.push(`SEED_PRIVATE_KEY_${i}=${seeds[i].privateKey}`);
    lines.push(`SEED_ADDRESS_${i}=${seeds[i].address}`);
  }

  return lines.join("\n") + "\n";
}

export function buildWebSeedListContent(seeds: readonly Seed[]): string {
  const addrs = seeds.map((seed) => `  "${seed.address.toLowerCase()}"`).join(",\n");

  return [
    "// 自动生成，勿手动编辑。",
    "// 由 npm run generate-seeds 写入真实地址；重跑时会替换这里的公开地址。",
    "// 由 contracts/script/ops/GenerateSeeds.ts 写出。",
    "// 用于前端披露：扫 Bet 事件时判断是否属于 seed 钱包。",
    "",
    "export const SEED_WALLETS: readonly `0x${string}`[] = [",
    addrs,
    "] as const;",
    "",
  ].join("\n");
}

function generateSeeds(count: number): Seed[] {
  const out: Seed[] = [];

  for (let i = 0; i < count; i += 1) {
    const privateKey = generatePrivateKey();
    const address = privateKeyToAccount(privateKey).address;
    out.push({ privateKey, address });
  }

  return out;
}

function parsePositiveInteger(value: string | undefined, label: string): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`${label} 必须为正整数`);
  }

  return count;
}

export function parseGenerationArgs(
  args: readonly string[] = process.argv.slice(2),
): { append: boolean; count: number } {
  const appendCountArg = args.find((value) => value.startsWith("--append="));
  const countArg = args.find((value) => value.startsWith("--count="));
  const append = appendCountArg !== undefined || args.some((value) => value === "--append");

  let count = DEFAULT_COUNT;
  if (appendCountArg !== undefined) {
    count = parsePositiveInteger(appendCountArg.slice("--append=".length), "--append=数字");
  }
  if (countArg !== undefined) {
    count = parsePositiveInteger(countArg.slice("--count=".length), "--count");
  }

  return { append, count };
}

export function parseSeedFileContent(content: string): Seed[] {
  const map: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex);
    const value = trimmed.slice(equalsIndex + 1);
    map[key] = value;
  }

  const count = parsePositiveInteger(map.SEED_WALLET_COUNT, "SEED_WALLET_COUNT");
  const out: Seed[] = [];

  for (let i = 0; i < count; i += 1) {
    const privateKey = map[`SEED_PRIVATE_KEY_${i}`];
    const address = map[`SEED_ADDRESS_${i}`];
    if (!privateKey || !address) {
      throw new Error(`SEED_PRIVATE_KEY_${i} / SEED_ADDRESS_${i} 缺失`);
    }

    out.push({ privateKey: privateKey as Hex, address: address as Address });
  }

  return out;
}

function existingSeedsFromFile(): Seed[] {
  if (!existsSync(ENV_SEEDS_PATH)) {
    return [];
  }

  return parseSeedFileContent(readFileSync(ENV_SEEDS_PATH, "utf8"));
}

function isDirect(): boolean {
  return process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
}

if (isDirect()) {
  const { append, count } = parseGenerationArgs();
  const existing = append ? existingSeedsFromFile() : [];
  const newOnes = generateSeeds(count);
  const all = [...existing, ...newOnes];

  mkdirSync(dirname(WEB_SEEDS_TS_PATH), { recursive: true });
  writeFileSync(ENV_SEEDS_PATH, buildSeedFileContent(all), { mode: 0o600 });
  chmodSync(ENV_SEEDS_PATH, 0o600);
  writeFileSync(WEB_SEEDS_TS_PATH, buildWebSeedListContent(all));

  console.log(`已生成 ${newOnes.length} 个钱包；钱包池总数 ${all.length}`);
  console.log("\n请把以下地址复制到 Circle faucet 领第一轮 testnet 资产：\n");
  for (const seed of newOnes) {
    console.log(seed.address);
  }
}
