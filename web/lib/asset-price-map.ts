// 与 contracts/script/ops/scheduler.config.ts 手动同步、手动对齐。
// 已按 E1 验证填入真实 priceId，并保持 lowercase 便于前端反查。
export type Asset = 'BTC' | 'ETH' | 'SOL';

// 与 contracts/script/ops/scheduler.config.ts 的 DEPLOY_BLOCK 手动同步；已按 E1 验证填入。
export const FRONTEND_DEPLOY_BLOCK = 46435108n;

export const PYTH_PRICE_ID_TO_ASSET: Record<string, Asset> = {
  '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43': 'BTC',
  '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace': 'ETH',
  '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d': 'SOL',
};
