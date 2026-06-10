import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Address, Hex } from "./clients.ts";
import { normalizePrivateKey } from "./clients.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OWNER_ENV_PATH = pathResolve(HERE, "../../../.env");
const DEFAULT_SEEDS_ENV_PATH = pathResolve(HERE, "../../../.env.seeds");

type EnvSource = Record<string, string | undefined>;

export type EnvLoadOptions = {
  ownerEnvPath?: string;
  seedsEnvPath?: string;
  runtimeEnv?: EnvSource;
};

export type OwnerEnv = {
  rpcUrl: string;
  marketAddress: Address;
  ownerPrivateKey: Hex;
  pythAddress: Address;
  hermesEndpoint: string;
};

export type SeedsEnv = {
  rpcUrl: string;
  marketAddress: Address;
  usdcAddress: Address;
  seeds: Array<{ privateKey: Hex; address: Address }>;
};

export function loadOwnerEnv(options: EnvLoadOptions = {}): OwnerEnv {
  const ownerEnv = readEnvFile(options.ownerEnvPath ?? DEFAULT_OWNER_ENV_PATH);
  const source = { ...ownerEnv, ...(options.runtimeEnv ?? process.env) };
  const rpcUrl = req(source, "RPC_URL");
  const marketAddress = req(source, "PREDICTION_MARKET") as Address;
  const ownerPrivateKey = normalizePrivateKey(req(source, "OWNER_PRIVATE_KEY"));
  const pythAddress = req(source, "PYTH_ADDRESS") as Address;
  const hermesEndpoint = source.PYTH_HERMES_ENDPOINT ?? "https://hermes.pyth.network";
  return { rpcUrl, marketAddress, ownerPrivateKey, pythAddress, hermesEndpoint };
}

export function loadSeedsEnv(options: EnvLoadOptions = {}): SeedsEnv {
  const ownerEnv = readEnvFile(options.ownerEnvPath ?? DEFAULT_OWNER_ENV_PATH);
  const seedEnv = readEnvFile(options.seedsEnvPath ?? DEFAULT_SEEDS_ENV_PATH);
  const baseSource = { ...ownerEnv, ...(options.runtimeEnv ?? process.env) };
  const rpcUrl = req(baseSource, "RPC_URL");
  const marketAddress = req(baseSource, "PREDICTION_MARKET") as Address;
  const usdcAddress = req(baseSource, "USDC_ADDRESS") as Address;
  const count = Number(req(seedEnv, "SEED_WALLET_COUNT"));
  if (!Number.isFinite(count) || !Number.isInteger(count) || count <= 0) {
    throw new Error("SEED_WALLET_COUNT 必须为正整数");
  }
  const seeds: SeedsEnv["seeds"] = [];
  for (let i = 0; i < count; i++) {
    const pk = seedEnv[`SEED_PRIVATE_KEY_${i}`];
    const addr = seedEnv[`SEED_ADDRESS_${i}`];
    if (!pk || !addr) {
      throw new Error(`SEED_PRIVATE_KEY_${i} / SEED_ADDRESS_${i} 缺失`);
    }
    seeds.push({ privateKey: normalizePrivateKey(pk), address: addr as Address });
  }
  return { rpcUrl, marketAddress, usdcAddress, seeds };
}

function readEnvFile(envPath: string): EnvSource {
  try {
    return dotenv.parse(readFileSync(envPath, "utf8")) as EnvSource;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function req(source: EnvSource, name: string): string {
  const v = source[name];
  if (!v) {
    throw new Error(`缺少必需环境变量 ${name}`);
  }
  return v;
}
