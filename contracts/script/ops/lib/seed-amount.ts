import { deterministicSeedFromBigInt, mulberry32 } from "./rng.ts";

export type SeedSide = "yes" | "no";

// 返回 6 decimals 的 USDC 金额，范围固定在 1–10 USDC。
export function seedAmount(marketId: bigint, walletIndex: number, side: SeedSide): bigint {
  if (!Number.isInteger(walletIndex) || walletIndex < 0) {
    throw new Error("walletIndex 必须是非负整数");
  }

  const sideBit = side === "yes" ? 0 : 1;
  const seed = (deterministicSeedFromBigInt(marketId) ^ walletIndex ^ sideBit) >>> 0;
  const rand = mulberry32(seed);
  const usdc = 1 + Math.floor(rand() * 10);
  return BigInt(usdc) * 1_000_000n;
}
