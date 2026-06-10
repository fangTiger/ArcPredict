import { parseEther } from "viem";

// seed 钱包余额阈值：warn 进补资名单，skip 直接跳过，gasMin 保证能发交易。
export const BALANCE_THRESHOLDS = {
  warn: 50_000_000n,
  skip: 5_000_000n,
  gasMin: parseEther("0.01"),
};

export type Classification = "healthy" | "needsTopup" | "skipSeed";

// 余额分类只依赖当前余额快照，供 topup 与 seed 选择复用。
export function classifyBalance(b: { usdc: bigint; native: bigint }): Classification {
  if (b.native < BALANCE_THRESHOLDS.gasMin) {
    return "skipSeed";
  }
  if (b.usdc < BALANCE_THRESHOLDS.skip) {
    return "skipSeed";
  }
  if (b.usdc < BALANCE_THRESHOLDS.warn) {
    return "needsTopup";
  }
  return "healthy";
}
