# 变更：建立 Market Ops Program 与每周主题市场包

## 为什么

ArcPredict 已具备自动开市与自动 seed 的基础能力，下一阶段需要把“市场供给”变成可持续运营系统：每周有明确主题、市场可自动上线、seed 和结算状态可观测，用户能理解市场如何结算并敢于下注。

当前产品风险不在于缺少更多品类，而在于运营闭环还不够产品化：cron 是否健康、自动化钱包是否够钱、某个市场处于何种结算状态、每周应该推什么主题，都需要从工程能力变成用户和运营都能感知的产品能力。

## 变更内容

- 新增 capability `market-operations`：定义自动开市、自动 seed、结算状态、自动化钱包健康、cron report、错误降级与密钥边界。
- 新增 capability `theme-market-pack`：定义每周主题市场包的数据模型、首页/分享入口、市场归组、Lens 预热与历史归档。
- 在市场详情页增加结算信任层：展示 PRICE / EVENT 市场的生命周期、oracle 来源、challenge window、claimable 状态。
- 建立实施治理：Architecture Codex 只负责 OpenSpec、设计、任务包、集成裁决和最终验证；Implementation Codex 使用 `.codex/agents/worker-codex.toml`（`gpt-5.4` + `xhigh`）执行；Review Codex 使用 `.codex/agents/review-codex.toml`（`gpt-5.4` + `xhigh`）审查。

## 影响范围

- 受影响规范：新增 `market-operations`、新增 `theme-market-pack`。
- 预计受影响代码：
  - `web/lib/markets/scheduler/**`
  - `web/lib/markets/sources/**`
  - `web/lib/markets/registry.ts`
  - `web/lib/market-kind.ts`
  - `web/lib/lens/**`
  - `web/app/page.tsx`
  - `web/app/market/[id]/page.tsx`
  - `web/components/MarketDetailCard.tsx`
  - `web/components/MarketFilterBar.tsx`
  - 新增 `web/lib/themes/**`
  - 新增 `web/components/SettlementTimeline.tsx`
  - 新增 `web/components/ThemeMarketBoard.tsx`
  - 可选新增 `web/app/theme/[themeId]/page.tsx`
- 不预期影响：
  - 不新增合约。
  - 不改 `PredictionMarket.sol` / `EventMarket.sol` / `AdminEventOracle.sol` 的核心资金逻辑。
  - 不引入数据库。
  - 不改变自动化钱包私钥管理方式。

## 非目标

- 不做积分、排行榜、成就或代币激励。
- 不做任意用户创建市场。
- 不做新 oracle。
- 不做后台管理系统登录态。
- 不把 AI Lens 输出作为结算依据。
