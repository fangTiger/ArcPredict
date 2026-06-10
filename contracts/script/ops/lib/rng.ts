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

// Fisher-Yates 从 pool 取前 k 个不重复元素；不修改原数组
export function pickK<T>(pool: readonly T[], k: number, rand: () => number): T[] {
  if (k > pool.length) throw new Error(`pickK: k(${k}) > pool.length(${pool.length})`);
  const arr = [...pool];
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rand() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, k);
}
