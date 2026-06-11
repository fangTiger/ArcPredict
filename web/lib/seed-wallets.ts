// D5 先保留公开地址占位，E1 会由 generate-seeds 写入并覆盖真实地址。
// 这里只有可公开的钱包地址数组，后续重跑 generate-seeds 时会替换为真实地址清单。
export const SEED_WALLETS: readonly `0x${string}`[] = [];
