# Tasks: add-rich-market-surfaces

## 0. Architecture Codex — 提案与治理

- [x] 0.1 读取项目指令、OpenSpec 状态、Graphify context、首页/卡片/详情源码。
- [x] 0.2 创建 OpenSpec proposal / design / spec delta。
- [x] 0.3 运行 `openspec validate add-rich-market-surfaces --strict --no-interactive`。
- [x] 0.4 准备 Handoff Task Package，并更新 `.codex/session-state.md`。

## 1. Implementation Codex — Slice A: 公共派生层

Executor: Implementation Codex (`worker-codex`, `gpt-5.4` + `xhigh`)

- [x] 1.1 RED：新增 `web/test/market-richness.test.ts`，覆盖 rich market ref、TodayBoard、Trending、Closing Soon、Recently Resolved、Market Story、Related Markets。
- [x] 1.2 GREEN：新增 `web/lib/market-richness.ts`，实现纯函数派生层。
- [x] 1.3 REFACTOR：确认函数无浏览器、链上、LLM 副作用。
- [x] 1.4 验证：运行对应 vitest。

## 2. Implementation Codex — Slice B: 首页丰富内容层

Executor: Implementation Codex (`worker-codex`, `gpt-5.4` + `xhigh`)

- [x] 2.1 RED：补首页丰富内容组件测试或静态检查，覆盖 Today Board、Trending、Closing Soon、Recently Resolved。
- [x] 2.2 GREEN：新增 `MarketDiscoveryRail` / `TodayBoard` 或等价组件。
- [x] 2.3 GREEN：接入 `web/app/page.tsx`，基于 price + event rows 派生 rich sections。
- [x] 2.4 REFACTOR：确保 `PositionStripe`、过滤器、市场网格和无限加载行为不回归。
- [x] 2.5 验证：运行首页相关测试与 typecheck。

## 3. Implementation Codex — Slice C: 卡片与主题包视觉增强

Executor: Implementation Codex (`worker-codex`, `gpt-5.4` + `xhigh`)

- [x] 3.1 RED：更新 `CryptoMarketCard`、`WorldCupMarketCard`、`ThemeMarketBoard` 相关测试，覆盖活动度、池子 skew、主题视觉或 rich metadata。
- [x] 3.2 GREEN：增强卡片信息密度，同时保持下注按钮和详情链接分离。
- [x] 3.3 GREEN：升级 `ThemeMarketBoard` 的层级和空状态，使主题包更像主推内容区。
- [x] 3.4 验证：运行卡片、主题包相关测试。

## 4. Implementation Codex — Slice D: 详情页预测档案

Executor: Implementation Codex (`worker-codex`, `gpt-5.4` + `xhigh`)

- [x] 4.1 RED：新增详情页 rich story / related / activity 测试。
- [x] 4.2 GREEN：新增 `MarketStoryPanel`、`RelatedMarketsPanel`、`ActivityTimeline` 或等价组件。
- [x] 4.3 GREEN：接入 `web/app/market/[id]/page.tsx`，不破坏 `SettlementTimeline`、`AILensPanel`、下注表单。
- [x] 4.4 验证：运行详情页相关测试与 typecheck。

## 5. Review Codex — 独立审查

Executor: Review Codex (`review-codex`, `gpt-5.4` + `xhigh`)

- [x] 5.1 审查 scope 是否符合 proposal / design / spec。
- [x] 5.2 审查 TDD evidence、RED/GREEN 命令、最终验证输出。
- [x] 5.3 审查 UI 行为：无伪造趋势、无自动 Lens 调用、下注按钮不被链接包裹。
- [x] 5.4 输出 `PASS` / `FIX_REQUIRED` / `DOWNGRADE`。

## 6. Architecture Codex — 集成验证与归档

- [x] 6.1 汇总 worker evidence 与 Review Decision。
- [x] 6.2 运行 fresh verification commands。
- [x] 6.3 检查 `tasks.md` 与实际完成情况一致。
- [x] 6.4 如 Review Decision 为 `PASS`，归档 OpenSpec 并重置 `.codex/session-state.md`。
