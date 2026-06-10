import type { Address } from "./clients.ts";
import { deterministicSeedFromBigInt, mulberry32, pickK } from "./rng.ts";

// 用 marketId 派生稳定选择，便于重试时复现同一批 seed 钱包。
export function pickSeedWallets(marketId: bigint, pool: readonly Address[]): Address[] {
  if (pool.length === 0) {
    throw new Error("seed 钱包池为空");
  }

  const rand = mulberry32(deterministicSeedFromBigInt(marketId));
  const k = Math.min(1 + Math.floor(rand() * 3), pool.length);
  return pickK(pool, k, rand);
}
