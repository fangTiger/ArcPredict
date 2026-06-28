# Change: 支持多 EventMarket deployment 并存

## 为什么

当前前端和 cron 都假设只有一个 `EventMarket` / `AdminEventOracle` 地址。WorldCup 新合约部署后，生产前端切到新地址，旧 automated 合约中的 macro / chain 市场不再展示，形成“一个品类生效、另一个品类失效”的地址覆盖问题。

## 变更内容

- 新增 EventMarket deployment registry，声明每个 deployment 的 `id`、market 地址、oracle 地址、负责品类和扫描起始区块。
- 首页与详情页按 deployment 聚合读取 `EventMarket` 数据，保留 WorldCup 新合约，同时继续展示旧 automated 合约中的 macro / chain 市场。
- Event 下注、结算时间线和 oracle 状态查询使用 row 自带 deployment 地址，不再依赖单一全局 EventMarket 地址。
- cron tick 按 source 选择目标 deployment，使 `fred-macro` / `chain-event` 可继续写入和推进旧 automated 合约，WorldCup 合约不被 automated source 覆盖。

## 影响范围

- 受影响的规范：market-sources, worldcup-category, event-oracle
- 受影响的代码：
  - `web/lib/addresses.ts`
  - `web/lib/markets/deployments.ts`（新增）
  - `web/lib/worldcup-markets.ts`
  - `web/app/page.tsx`
  - `web/app/market/[id]/page.tsx`
  - `web/app/theme/[themeId]/page.tsx`
  - `web/components/EventBetModal.tsx`
  - `web/lib/markets/scheduler/*`
  - `web/app/api/cron/markets/tick/route.ts`
  - 对应测试

## 非目标

- 不迁移链上历史状态，不重放旧市场到新合约。
- 不部署生产，不修改 Vercel 生产环境变量，不触发生产 cron。
- 不改变 `EventMarket` / `AdminEventOracle` 合约 ABI。
