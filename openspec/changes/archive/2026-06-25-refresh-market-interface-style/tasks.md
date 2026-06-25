# Tasks: refresh-market-interface-style

## 0. Architecture Codex — 规划与治理

- [x] 0.1 提交并归档上一轮 `add-rich-market-surfaces` 变更。
- [x] 0.2 调研 Polymarket 风格参考，明确只借鉴信息架构与交易界面节奏，不复制品牌。
- [x] 0.3 执行 Graphify architecture / impact 查询并读取相关源码。
- [x] 0.4 创建并验证 OpenSpec proposal / design / spec delta。
- [x] 0.5 准备 Handoff Task Package 并更新 `.codex/session-state.md`。

## 1. Implementation Codex — Style Guard Tests

Executor: Implementation Codex (`worker-codex`, `gpt-5.4` + `xhigh`)

- [x] 1.1 RED：新增或更新静态检查，要求主要市场浏览界面使用 light market terminal tokens。
- [x] 1.2 RED：检查 HomeHero 不再依赖 `HeroParticleCanvas`、`.hero-arc-band`、`.hero-title` 等重装饰 hero 语言。
- [x] 1.3 RED：检查 BaseMarketCard / CryptoMarketCard / WorldCupMarketCard 不再使用 `.glass`、`.num-glow`、装饰 SVG rings 或大 `rounded-3xl` 外壳。
- [x] 1.4 RED：检查 MarketFilterBar / SiteHeader 有搜索或 browse-like affordance、紧凑分类 strip 和 active chip。

## 2. Implementation Codex — Global Visual System

Executor: Implementation Codex (`worker-codex`, `gpt-5.4` + `xhigh`)

- [x] 2.1 GREEN：更新 `globals.css` 和 Tailwind tokens，切换到浅色中性交易界面。
- [x] 2.2 GREEN：保留 Arc blue、Yes green、No red 语义色，但降低 glow / blur / radial gradient 使用。
- [x] 2.3 REFACTOR：删除或停用 primary homepage 不再使用的粒子/hero/glass视觉规则，避免旧样式继续影响主界面。

## 3. Implementation Codex — Homepage Shell

Executor: Implementation Codex (`worker-codex`, `gpt-5.4` + `xhigh`)

- [x] 3.1 GREEN：改造 `SiteHeader` 为紧凑产品导航，包含 browse/search-like affordance。
- [x] 3.2 GREEN：改造 `HomeHero` 为 compact market summary strip，移除粒子 canvas 和大渐变标题。
- [x] 3.3 GREEN：改造 `MarketFilterBar` 为 Polymarket-like category/topic strip，但保留 category/stage/asset/cadence 行为。
- [x] 3.4 验证：首页 URL query、category/stage、positions anchor、infinite loading 行为不回归。

## 4. Implementation Codex — Cards And Rich Sections

Executor: Implementation Codex (`worker-codex`, `gpt-5.4` + `xhigh`)

- [x] 4.1 GREEN：改造 `BaseMarketCard` 为 flat bordered card shell。
- [x] 4.2 GREEN：改造 Crypto / Event cards 为紧凑概率卡，保留详情 Link 与下注按钮分离。
- [x] 4.3 GREEN：改造 Today Board、Discovery Rail、Theme Board 为同一 flat panel system。
- [x] 4.4 验证：市场卡片和 rich section 静态检查、组件测试通过。

## 5. Implementation Codex — Detail Page Panels

Executor: Implementation Codex (`worker-codex`, `gpt-5.4` + `xhigh`)

- [x] 5.1 GREEN：改造 `MarketDetailCard` 为 flat market profile + trading ticket 风格。
- [x] 5.2 GREEN：统一 `MarketStoryPanel`、`ActivityTimeline`、`RelatedMarketsPanel` 的 compact panel 视觉。
- [x] 5.3 REFACTOR：确认 SettlementTimeline、AILensPanel、下注表单仍可用，不自动触发 Lens。
- [x] 5.4 验证：详情页静态检查、typecheck 和 build 通过。

## 6. Review Codex — 独立审查

Executor: Review Codex (`review-codex`, `gpt-5.4` + `xhigh`)

- [x] 6.1 审查 scope 是否符合 proposal / design / spec。
- [x] 6.2 审查 TDD evidence、RED/GREEN 命令、最终验证输出。
- [x] 6.3 审查 UI 行为：按钮不被链接包裹、Lens 不自动调用、无伪造数据。
- [x] 6.4 输出 `PASS` / `FIX_REQUIRED` / `DOWNGRADE`。

## 7. Architecture Codex — 集成验证与归档

- [x] 7.1 汇总 worker evidence 与 Review Decision。
- [x] 7.2 运行 fresh verification commands，包括静态检查、vitest、typecheck、build、OpenSpec validate。
- [x] 7.3 使用浏览器检查 desktop/mobile 首页和详情页视觉，必要时迭代修复。
- [x] 7.4 检查 `tasks.md` 与实际完成情况一致。
- [x] 7.5 如 Review Decision 为 `PASS`，归档 OpenSpec、提交代码并重置 `.codex/session-state.md`。
