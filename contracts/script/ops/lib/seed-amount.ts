import { deterministicSeedFromBigInt, mulberry32 } from "./rng.ts";

export type SeedSide = "yes" | "no";

// 返回 6 decimals 的 USDC 金额；冷启动期把单边注入降到 1–2 USDC，
// 避免 26 个市场首轮 seed 的总消耗超过当前 faucet 供给。
export function seedAmount(marketId: bigint, walletIndex: number, side: SeedSide): bigint {
  if (!Number.isInteger(walletIndex) || walletIndex < 0) {
    throw new Error("walletIndex 必须是非负整数");
  }

  const sideBit = side === "yes" ? 0 : 1;
  const seed = (deterministicSeedFromBigInt(marketId) ^ walletIndex ^ sideBit) >>> 0;
  const rand = mulberry32(seed);
  const usdc = 1 + Math.floor(rand() * 2);
  return BigInt(usdc) * 1_000_000n;
}
