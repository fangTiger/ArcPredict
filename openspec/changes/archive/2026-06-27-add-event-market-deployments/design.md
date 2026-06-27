# Design: 多 EventMarket deployment 聚合

## 背景

ArcPredict 已有两个有效的 Arc Testnet EventMarket deployment：

- `automated-v1`：旧 automated categories 合约，包含 macro / chain 市场。
- `worldcup-v1`：新 WorldCup 合约，包含 98 个 WorldCup 市场。

两者链上状态不能合并：marketId、用户仓位、outcomePools、oracle 状态和结算窗口都绑定在各自合约中。因此本变更在应用层聚合 deployment，而不是尝试链上迁移。

## 架构

新增 `web/lib/markets/deployments.ts`：

- `EVENT_MARKET_DEPLOYMENTS`：所有已知 deployment 的静态 registry。
- `EVENT_MARKET_DEPLOYMENTS_BY_ID`：按 id 查询。
- `eventMarketDeploymentsForCategory(category)`：前端按品类选择读取目标。
- `eventMarketDeploymentForSource(sourceId)`：cron 按 source 选择写入目标。

每个 event row 归一化时附带：

- `deploymentId`
- `eventMarketAddress`
- `oracleAddress`

这样列表页、详情页、下注 modal、settlement timeline 和 oracle 状态查询都从 row 获取地址，而不是使用单一 `EVENT_MARKET_ADDRESS`。

## 数据流

首页：

1. Crypto 仍读 `PredictionMarket`。
2. Event 市场分别读 `automated-v1` 与 `worldcup-v1` 的 `getDashboardLatest(user, 100)`。
3. 合并 rows，交给 `resolveWorldCupMarkets` 分类为 `worldcup | macro | chain`。
4. `MarketFilterBar` 按 category 过滤。

详情页：

1. event 链接携带 `deployment=<id>` 查询参数。
2. 详情页根据 deployment id 读取对应合约的 `getDashboard(user, id, id + 1)`。
3. 下注和 oracle 状态查询使用当前 row 的 deployment 地址。

cron：

1. `bootstrapSources()` 保持 source 注册。
2. `runTick` 为每个 source 选择 `eventMarketDeploymentForSource(source.id)`。
3. 每个 source 使用对应 deployment 的 reader / writer / seedLiquidity，避免 automated source 写到 WorldCup deployment。

## 错误处理

- 未识别 deployment 查询参数时，详情页回退到当前 WorldCup deployment，仅用于向后兼容旧链接。
- deployment registry 缺少 source 映射时，cron 在该 source report 中记录错误并继续其他 source。
- 单 deployment 读取失败时，前端仍展示其他 deployment 已读出的市场。

## 测试策略

- registry 单元测试：category 和 source 映射正确。
- `resolveWorldCupMarkets` 测试：row 保留 deployment metadata。
- 首页静态/组件测试：页面读取多个 EventMarket deployment。
- EventBetModal 测试：approve / bet 使用 row 的 eventMarketAddress。
- tick 测试：不同 source 使用不同 deployment writer / reader。
- route 测试：cron 不再只依赖单一 EventMarket 地址。
