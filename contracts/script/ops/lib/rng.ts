// 确定性 RNG：同种子复现 seed 钱包选择与金额，便于排障。

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t ^= (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 把 bigint 收敛到 uint32 范围，用于喂 mulberry32
export function deterministicSeedFromBigInt(v: bigint): number {
  return Number(v & 0xffffffffn);
}

// Fisher-Yates 从 pool 的不同位置取前 k 项；若 pool 本身有重复值，返回值也可能重复；不修改原数组
export function pickK<T>(pool: readonly T[], k: number, rand: () => number): T[] {
  if (!Number.isInteger(k)) throw new Error("pickK: k 必须是整数");
  if (k < 0 || k > pool.length) throw new Error("pickK: k 必须满足 0 <= k <= pool.length");
  const arr = [...pool];
  for (let i = 0; i < k; i++) {
    const r = rand();
    if (!Number.isFinite(r) || r < 0 || r >= 1) {
      throw new Error("pickK: rand() 必须返回 [0, 1) 范围内的有限数");
    }
    const j = i + Math.floor(r * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, k);
}
