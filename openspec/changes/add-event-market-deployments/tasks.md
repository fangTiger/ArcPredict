## 1. OpenSpec

- [x] 1.1 创建 proposal / design / spec delta。
- [x] 1.2 运行 `openspec validate add-event-market-deployments --strict --no-interactive`。

## 2. Deployment registry

- [x] 2.1 RED：为 deployment registry 写 category/source 映射测试。
- [x] 2.2 GREEN：新增 registry 与旧 automated 地址常量。

## 3. 前端聚合读取

- [x] 3.1 RED：测试 `resolveWorldCupMarkets` 保留 deployment metadata。
- [x] 3.2 GREEN：扩展 EventMarket row / WorldCup row 类型和 metadata 透传。
- [x] 3.3 RED：测试首页读取多个 EventMarket deployment。
- [x] 3.4 GREEN：首页聚合多个 deployment 的 dashboard rows。
- [x] 3.5 RED：测试详情链接与详情页按 deployment 读取。
- [x] 3.6 GREEN：WorldCupMarketCard / 详情页使用 deployment 查询参数。

## 4. 下注与 oracle 查询

- [x] 4.1 RED：测试 EventBetModal 使用 row 自带 EventMarket 地址授权和下注。
- [x] 4.2 GREEN：EventBetModal、SettlementTimeline oracle 查询使用 row deployment 地址。

## 5. cron per-source deployment

- [x] 5.1 RED：测试 `runTick` 按 source 选择 deployment reader / writer。
- [x] 5.2 GREEN：扩展 tick / route，让 source 写入对应 deployment。

## 6. 验证

- [x] 6.1 运行相关 vitest / node 检查。
- [x] 6.2 运行 `pnpm typecheck` 或说明无法运行原因。
- [x] 6.3 更新 tasks.md 完成状态。
