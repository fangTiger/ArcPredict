# Design: worldcup-category

## 目的

`worldcup-category` 记录 ArcPredict 世界杯事件市场的合约、前端与运营设计。该能力在不破坏现有 Crypto 价格市场的前提下，新增离散赛事市场、世界杯品类导航和赛事卡片体验。

## 架构形态

```
World Cup Tab / 详情页
    │
    ├─ 读取静态赛程种子与展示 metadata
    ├─ 低频读取 TheSportsDB 展示比分（非结算路径）
    │
    ▼
EventMarket
    ├─ 多 outcome 资金池与 stakeByOutcome 记账
    ├─ 1X2 / goals-25 / winner 市场
    └─ 结算时读取 IEventOracle
            │
            ▼
AdminEventOracle
    └─ owner 提案 + 72h 异议期 + challenge/finalize
```

## 关键决策

### 独立 EventMarket 合约

现有 `PredictionMarket` 是单合约多市场 + pool-based AMM 结构，世界杯能力新增独立 `EventMarket.sol`，镜像现有下注、结算、领奖流程，但将固定二元池扩展为 `uint128[] outcomePools` 和 `stakeByOutcome[marketId][user][outcomeIndex]`。

这样可以保持 Crypto 市场零回归风险，同时让 1X2、二元让分和 48 选 1 冠军盘共享同一资金与结算模型。

### 前端按品类与 marketKind 路由

前端通过 `MarketCategory` / `marketKind` 区分 `crypto` 与 `worldcup`。`web/lib/addresses.ts` 同时持有 `PREDICTION_MARKET_ADDRESS`、`EVENT_MARKET_ADDRESS` 和 `ADMIN_EVENT_ORACLE_ADDRESS`；页面按当前品类决定读取哪个合约和渲染哪类卡片。

不引入链上 router 或 factory，避免额外合约面和 gas 成本。

### 卡片与详情页变体

世界杯卡片使用 `WorldCupMarketCard` 与 `WorldCupOutcomePanel`，展示队伍、阶段、开赛时间和三种 outcome 布局。详情页用赛事信息模块、隐含概率曲线和 `AdminEventOracle` 结算来源替换 Crypto 的 Pyth 价格模块。

### 静态赛程 + 低频比分展示

赛程数据以静态种子打包到前端，比赛比分只作为展示数据低频请求 TheSportsDB。比分数据不得进入合约结算路径；合约结算只信任 `AdminEventOracle` 的最终化结果。

轮询仅在比赛进行中、详情页聚焦且可见时启动，间隔 60 秒；列表页不轮询。

### 资金池共享但视觉隔离

World Cup 与 Crypto 使用同一 USDC token 地址，但分别由 `PredictionMarket` 与 `EventMarket` 持有资金池。用户需要按合约地址分别授权，前端持仓视图按品类过滤。

### 灰度与回滚

`NEXT_PUBLIC_WORLDCUP_ENABLED=false` 时隐藏 World Cup 品类入口，回退到 Crypto-only 体验。该 flag 是前端灰度与快速回滚入口，不影响链上已存在市场的最终结算职责。

## 部署形态

- 部署 `AdminEventOracle`
- 部署绑定该 oracle 的 `EventMarket`
- seed 72 场小组赛的 1X2 与 goals-25 市场、final-1 1X2 市场、winner 市场
- 回填 `web/lib/addresses.ts`
- 测试网首笔下注使用 final-1 `marketId = 144`，outcomeIndex 0 表示 home / MATCH_101_W

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 多 outcome 流动性分散 | MVP 接受低流动性，前端显示隐含概率和池子状态 |
| 比分 API 失败 | 只影响展示，隐藏比分模块并保留下注/领奖流程 |
| 赛事结果中心化 | 通过 `event-oracle` 能力的 72h 异议期和挑战路径缓解 |
| 品类 UI 增加复杂度 | 用 BaseMarketCard slot 与 category 路由控制变体边界 |
| 旧地址废弃 | 重新部署后前端地址表只指向最新 EventMarket/AdminEventOracle，旧测试网持仓不迁移 |

## 后续

Phase 10.7 需要在测试网对 final-1 执行 propose ARG、等待 72h、finalize、claim，并把 tx 与 payout 追加到 Phase 7b QA 文档。
