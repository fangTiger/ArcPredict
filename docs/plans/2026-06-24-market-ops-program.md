# Market Ops Program Planning Proposal

**Goal:** 将 ArcPredict 下一阶段规划为“自动化市场运营产品”：自动开市、自动 seed、每周主题市场包、结算信任层和可审计 OpsReport。

**Architecture:** 不新增合约、不引入数据库，复用现有 MarketSource、EventMarket、AdminEventOracle、AI Lens 与 Next.js 前端。新增能力集中在 ops report、theme manifest、SettlementTimeline 和主题市场聚合层。

**Tech Stack:** Next.js 14 · TypeScript · viem · wagmi · Vitest · Foundry · OpenSpec · Vercel Cron

---

## Product Thesis

ArcPredict 现在应该从“功能演示”转向“可持续运营”。产品差异化不是更多零散品类，而是每周有主题、有市场、有自动 seed、有 AI Lens、有清楚结算路径。用户打开首页，应该马上看到本周主推市场包；进入详情页，应该马上知道这个市场由什么结算、什么时候可 challenge、何时可 claim。

## Scope

本提案只做产品化运营层：

- Market Ops report：让自动化开市、seed、结算、Lens preload 都可审计。
- Settlement trust layer：让详情页展示 PRICE / EVENT 生命周期。
- Weekly theme market pack：每周主题包 manifest、首页展示、分享入口、历史归档。
- Agent governance：主 Agent 规划；worker 实现；reviewer 独立审查。

不做新合约、不做新 oracle、不做积分排行、不做后台登录、不做用户创建市场。

## Execution Model

- Architecture Codex：当前主线程，负责 OpenSpec、设计、任务包、集成裁决、最终验证。
- Implementation Codex：使用 `.codex/agents/worker-codex.toml`，`gpt-5.4` + `xhigh`。
- Review Codex：使用 `.codex/agents/review-codex.toml`，`gpt-5.4` + `xhigh`。

实现阶段按 slice handoff，避免 worker 直接改共享契约或 session-state。

## Proposed Slices

### Slice A: OpsReport

建立 tick report 契约，覆盖 per-source 结果、seed 状态、Lens preload warning、错误脱敏和自动化钱包余额健康。

### Slice B: SettlementTimeline

新增统一结算时间线组件，并接入市场详情页。EVENT 市场重点展示 AdminEventOracle、challenge window、finalized/claimable；PRICE 市场展示 Pyth resolve 状态。

### Slice C: Weekly Theme Pack

新增 theme manifest、当前主题识别、首页主题板块和可分享主题入口。主题入口必须直接展示市场，不做空营销页。

### Slice D: Automation Integration

MarketDraft 支持 `themeId`，cron report 记录主题市场创建与 seed，Lens preload best-effort。

### Slice E: QA + Docs + Archive

补测试、视觉验证、runbook 和 OpenSpec archive。

## Acceptance Criteria

- `openspec validate add-market-ops-program --strict --no-interactive` 通过。
- 首页能展示 active weekly theme market pack。
- 市场详情页能展示 PRICE / EVENT lifecycle。
- Cron OpsReport 能表达成功、局部失败、seed 失败、Lens preload warning 和 secret redaction。
- worker/reviewer 证据完整，Review Codex 给出 `PASS` 后才归档。

## Graphify Context

已查询 `market operations weekly theme market package architecture dependencies`。命中显示相关前端影响点集中在 `MarketFilterBar.tsx`、`MarketDetailCard.tsx`、`WorldCupMarketCard.tsx` 及市场组件测试；`GRAPH_REPORT.md` 显示项目核心社区包括市场扫描、结算、前端卡片、测试辅助与 ops 脚本，后续实现应优先保护这些边界。
