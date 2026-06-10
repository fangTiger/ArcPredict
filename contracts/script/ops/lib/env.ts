import dotenv from "dotenv";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Address, Hex } from "./clients.ts";
import { normalizePrivateKey } from "./clients.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

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

export function loadOwnerEnv(): OwnerEnv {
  dotenv.config({ path: pathResolve(HERE, "../../../.env") });
  const rpcUrl = req("RPC_URL");
  const marketAddress = req("PREDICTION_MARKET") as Address;
  const ownerPrivateKey = normalizePrivateKey(req("OWNER_PRIVATE_KEY"));
  const pythAddress = req("PYTH_ADDRESS") as Address;
  const hermesEndpoint = process.env.PYTH_HERMES_ENDPOINT ?? "https://hermes.pyth.network";
  return { rpcUrl, marketAddress, ownerPrivateKey, pythAddress, hermesEndpoint };
}

export function loadSeedsEnv(): SeedsEnv {
  dotenv.config({ path: pathResolve(HERE, "../../../.env") });
  dotenv.config({ path: pathResolve(HERE, "../../../.env.seeds") });
  const rpcUrl = req("RPC_URL");
  const marketAddress = req("PREDICTION_MARKET") as Address;
  const usdcAddress = req("USDC_ADDRESS") as Address;
  const count = Number(req("SEED_WALLET_COUNT"));
  if (!Number.isFinite(count) || !Number.isInteger(count) || count <= 0) {
    throw new Error("SEED_WALLET_COUNT 必须为正整数");
  }
  const seeds: SeedsEnv["seeds"] = [];
  for (let i = 0; i < count; i++) {
    const pk = process.env[`SEED_PRIVATE_KEY_${i}`];
    const addr = process.env[`SEED_ADDRESS_${i}`];
    if (!pk || !addr) {
      throw new Error(`SEED_PRIVATE_KEY_${i} / SEED_ADDRESS_${i} 缺失`);
    }
    seeds.push({ privateKey: normalizePrivateKey(pk), address: addr as Address });
  }
  return { rpcUrl, marketAddress, usdcAddress, seeds };
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`缺少必需环境变量 ${name}`);
  }
  return v;
}
