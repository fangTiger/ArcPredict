// Phase 16+ 调度器目标矩阵与时间常量
// 改这个文件 = 改菜单；重启 launchd 即生效。

export type Cadence = "daily" | "weekly" | "monthly" | "quarterly";
export type Asset = "BTC" | "ETH" | "SOL";

// 下注窗口与结算时间（小时）；betHours 必须严格小于 resolveHours
export const CADENCE_DURATION: Record<Cadence, { betHours: number; resolveHours: number }> = {
  daily: { betHours: 20, resolveHours: 24 },
  weekly: { betHours: 7 * 24 - 4, resolveHours: 7 * 24 },
  monthly: { betHours: 30 * 24 - 8, resolveHours: 30 * 24 },
  quarterly: { betHours: 90 * 24 - 12, resolveHours: 90 * 24 },
};

// Pyth Hermes 上的 priceId（32 字节 hex），实施前必须按 spec §10 用 cast 验证
// 占位：实施时由 owner 替换为真实值
export const PYTH_PRICE_ID: Record<Asset, `0x${string}`> = {
  BTC: "0x0000000000000000000000000000000000000000000000000000000000000000",
  ETH: "0x0000000000000000000000000000000000000000000000000000000000000000",
  SOL: "0x0000000000000000000000000000000000000000000000000000000000000000",
};

// 同时活跃市场数目标，主力放在周/月/季度
export const TARGET_ACTIVE: Record<Asset, Record<Cadence, number>> = {
  BTC: { daily: 1, weekly: 3, monthly: 3, quarterly: 2 },
  ETH: { daily: 1, weekly: 3, monthly: 3, quarterly: 2 },
  SOL: { daily: 1, weekly: 3, monthly: 2, quarterly: 2 },
};

// 阈值偏移百分比阶梯；长度必须覆盖该 cadence 的目标活跃数上限
export const THRESHOLD_OFFSETS_PCT: Record<Cadence, number[]> = {
  daily: [0],
  weekly: [-3, 0, +3],
  monthly: [-8, 0, +8],
  quarterly: [-15, 0, +15],
};

// 合约部署区块（用于扫 Bet 事件）；实施时由 owner 填真实值
export const DEPLOY_BLOCK: bigint = 0n;

export function totalActive(): number {
  let s = 0;
  for (const a of Object.keys(TARGET_ACTIVE) as Asset[]) {
    for (const c of Object.keys(TARGET_ACTIVE[a]) as Cadence[]) {
      s += TARGET_ACTIVE[a][c];
    }
  }
  return s;
}

export function validateConfig(): void {
  for (const c of Object.keys(CADENCE_DURATION) as Cadence[]) {
    const d = CADENCE_DURATION[c];
    if (d.betHours >= d.resolveHours) {
      throw new Error(`${c} 的 betHours 必须严格小于 resolveHours`);
    }
  }
  for (const a of Object.keys(TARGET_ACTIVE) as Asset[]) {
    for (const c of Object.keys(TARGET_ACTIVE[a]) as Cadence[]) {
      const available = THRESHOLD_OFFSETS_PCT[c].length;
      const actual = TARGET_ACTIVE[a][c];
      if (actual > available) {
        throw new Error(`${a}/${c}：TARGET_ACTIVE(${actual}) 不能超过 THRESHOLD_OFFSETS_PCT 长度(${available})`);
      }
    }
  }
  const total = totalActive();
  if (total !== 26) {
    throw new Error(`总活跃数必须等于 26，当前为 ${total}`);
  }
  for (const id of Object.values(PYTH_PRICE_ID)) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(id)) {
      throw new Error(`priceId ${id} 不是 32 字节 hex`);
    }
  }
}
