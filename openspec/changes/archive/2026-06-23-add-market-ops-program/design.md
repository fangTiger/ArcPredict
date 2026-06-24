# Design: add-market-ops-program

## 目标

把 ArcPredict 下一阶段做成“自动化市场运营产品”：系统每天能自动开市和 seed，每周能推出一个可传播的主题市场包，每个市场都能清楚展示结算来源和生命周期。工程执行继续使用三角色流水线：主线程 Architecture Codex 规划，Implementation Codex 实现，Review Codex 审查。

## 当前基础

- `market-sources` 已定义 MarketSource 插件、cron tick、每 source 限额、自动 seed 和失败局部化。
- `market-category` 已覆盖 `crypto | worldcup | macro | chain`。
- `ai-lens` 已覆盖四类市场和 Lens 预生成。
- `event-oracle` 和 `worldcup-category` 已定义 EVENT 市场结算、72h challenge window 和前端结算来源展示。
- `openspec list` 当前无活跃变更。
- `.codex/session-state.md` 已重置为 `ActiveTaskStatus: NONE`。

## 推荐方案

采用“小核心、强运营”的方案：

1. **Market Ops 核心**：不引入数据库，先基于 cron response、链上事件、自动化钱包余额和现有 source 状态生成 ops report。所有 report 必须脱敏，不包含私钥、Authorization、RPC secret 或 DeepSeek key。
2. **Settlement Trust UI**：在市场详情页统一展示生命周期。PRICE 市场显示 Open / Resolvable / Resolved / Invalid / Claimable；EVENT 市场显示 Open / Proposed / Challenge Window / Finalized / Claimable。
3. **Weekly Theme Pack**：新增静态 manifest + source tag 的混合模型。每周主题包有稳定 `themeId`、标题、时间窗、描述、市场 externalKeys / marketIds、主推 category、share copy。自动化市场创建时可以带 `themeId` 标签，前端按 theme 聚合展示。
4. **Lens 协同**：主题包市场创建后 best-effort 预热 Lens；预热失败不阻塞开市和 seed。

## 备选方案

### 方案 A：只做运营脚本，不做用户界面

优点是快，风险低。缺点是产品感弱，用户仍看不到结算信任层，也不利于每周传播。

### 方案 B：做完整后台管理台

优点是运营效率高。缺点是需要登录、权限、审计和密钥边界，当前阶段过重。

### 方案 C：推荐方案，小核心 + 用户可见信任层

先把用户必须信任的信息做出来，把运营必须检查的 report 做成轻量 JSON/组件，把主题市场包作为增长入口。这个方案不改合约、不引入 DB，能延续现有架构。

## 数据流

```text
MarketSource.fetchUpcoming()
  -> MarketDraft(themeId?, externalKey, category, outcomes, times)
  -> cron tick createMarket
  -> seedLiquidity
  -> lensPreloader.warm
  -> OpsReport(perSource, transactions, warnings, seedHealth)
  -> Home / Theme board / Market detail
```

结算链路：

```text
PRICE market:
  PredictionMarket state + Pyth metadata -> SettlementTimeline

EVENT market:
  EventMarket state + AdminEventOracle status -> SettlementTimeline
```

## 角色与执行约束

- Architecture Codex：当前主线程，负责 OpenSpec、设计、任务包、integration checkpoint、最终 verify 和 archive。
- Implementation Codex：通过 `.codex/agents/worker-codex.toml` 执行，模型约束为 `gpt-5.4` + `xhigh`。
- Review Codex：通过 `.codex/agents/review-codex.toml` 审查，模型约束为 `gpt-5.4` + `xhigh`。
- 中 / 大任务必须使用 handoff task package。公共契约、schema、session-state、构建配置不得多 worker 并发直写。

## 切片建议

1. Slice A：Market Ops 数据契约与 report 生成。
2. Slice B：SettlementTimeline 与详情页信任层。
3. Slice C：Theme Pack manifest、聚合逻辑、首页/分享入口。
4. Slice D：Lens preload、cron report、失败降级整合。
5. Slice E：文档、QA、OpenSpec tasks 完成检查。

## 验证策略

- `cd web && pnpm vitest run test/markets test/lens`
- `cd web && pnpm typecheck`
- `cd web && pnpm lint`
- `cd web && pnpm build`
- 必要时补充 Playwright / screenshot QA，验证首页、主题页、市场详情页移动端和桌面端。

## 风险与缓解

- 外部 API 不稳定：source 失败必须局部化，主题包页面显示可用市场，不因部分 source 失败崩溃。
- 自动化钱包余额不足：tick report 必须输出 `needs_funding`，不能泄露私钥。
- 重复开市：继续依赖 deterministic externalKey，并在 theme pack 中声明 externalKey。
- 用户误解 AI Lens：主题包与详情页继续显示 “not financial advice / not settlement oracle”。
- UI 过度营销化：主题包是产品入口，不做空洞 landing page；第一屏直接展示可下注市场。
