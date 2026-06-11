// 与 contracts/script/ops/scheduler.config.ts 手动同步、手动对齐。
// D5 先用全 0 priceId 占位，E1 时由 owner 填入真实 priceId 后再同步这里。
export type Asset = 'BTC' | 'ETH' | 'SOL';

export const PYTH_PRICE_ID_TO_ASSET: Record<string, Asset> = {
  '0x0000000000000000000000000000000000000000000000000000000000000000': 'BTC',
};
