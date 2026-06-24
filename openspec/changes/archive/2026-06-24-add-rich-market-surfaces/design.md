# Design: add-rich-market-surfaces

## 目标

把 ArcPredict 从“市场卡片列表”推进为“可浏览的预测市场产品页”。用户打开首页时应立即看到今日主推、本周主题、趋势、临期、最近结算和个人持仓；进入详情页时应看到一个完整的预测档案，包括题面、概率、资金池、故事、AI Lens、结算路径、相关市场和活动动态。

本轮重点是页面丰富度和内容组织，不处理法务合规，不改合约，不新增后端数据库。

## 当前基础

- 首页已有 `HomeHero`、`ThemeMarketBoard`、`MarketFilterBar`、`PositionStripe`、市场卡片网格、`PositionList` 与 `ResolvedList`。
- 市场卡片已有 `CryptoMarketCard`、`WorldCupMarketCard`、`AILensCompact`。
- 详情页已有 `MarketDetailCard`、`SettlementTimeline`、`AILensPanel`、价格市场下注侧栏和事件市场下注弹窗。
- `theme-market-pack` 已定义主题包 manifest 与 `/theme/[themeId]` 页面。
- Graphify 查询命中 `CryptoMarketCard.tsx`、`WorldCupMarketCard.tsx`、`MarketDetailCard.tsx`、`BaseMarketCard.tsx` 等前端影响点；`GRAPH_REPORT.md` 显示测试辅助、卡片、详情和结算相关社区是主要影响面。
- `openspec/config.yaml`、`openspec/project.md`、`openspec/AGENTS.md` 当前不存在，按项目现有 proposals/specs 格式降级创建。

## 产品方向

采用“交易面板 + 预测杂志”的页面结构。页面仍以可下注市场为核心，不做营销落地页；但在市场列表之外增加可浏览内容层，让用户感到网站每天都有变化。

视觉方向延续现有 Synthra 风格：深色玻璃、Arc 蓝、暖色热度、绿色成功态、运动/链上/宏观主题图形。避免单纯堆卡片和空洞说明，优先展示真实市场、真实状态和可点击入口。

## 首页结构

首页按以下顺序组织：

1. `HomeHero`：保留第一屏品牌和统计，但文案按 category 覆盖 crypto / worldcup / macro / chain，不再只有 crypto/worldcup 两套。
2. `TodayBoard`：从 open markets 中派生 1 个主推市场和 2-4 个 secondary markets，优先选择临期、池子较大、主题包市场或用户有持仓的市场。
3. `ThemeMarketBoard`：保留并升级为更有视觉层级的本周主题包，直接展示市场。
4. `MarketDiscoveryRail`：展示 Trending、Closing Soon、Recently Resolved 三组紧凑列表；每组均直接链接详情页。
5. `PositionStripe`：用户有持仓时仍展示在市场网格前。
6. 原市场网格：保留筛选与无限加载。
7. 底部 `PositionList` / `ResolvedList`：保留。

## 卡片增强

卡片保持现有下注按钮可用性，不把按钮包进链接。增强内容：

- 主题视觉/封面区域：crypto 用资产 accent，event/macro/chain 用现有 `themeVisual` 或 category icon。
- 活动度：基于总池子、是否临期、是否可 claim、是否主题包市场派生 `activityLabel`。
- 概率变化：本轮无历史序列时不伪造 24h delta；可展示 `Market balance` / `Pool skew` 等由当前池子计算的真实指标。
- Lens 摘要入口：继续使用 `AILensCompact`，首页 rich sections 可展示 Lens highlight 占位，不自动调用 LLM。

## 详情页增强

详情页增加两个内容组件：

1. `MarketStoryPanel`：基于市场类型和题面生成短故事区，包括“Why it matters”、“What moves it”、“What to watch”。这些是静态/派生文案，不依赖 LLM，不构成投注建议。
2. `RelatedMarketsPanel`：基于 category、themeId、asset 或 stage 从当前已读取市场中挑选 3-5 个相关市场，直接链接详情页。

详情页还应新增 `ActivityTimeline` 或等价模块，用现有状态派生最近事件，例如 market open、betting closes、resolution window、oracle proposed、claimable。没有真实事件日志时，不伪造下注 feed。

## 派生数据层

新增 `web/lib/market-richness.ts`，聚合纯函数：

- `toRichMarketRef(row)`：统一 price / event 的标题、href、category、deadline、liquidity、claimable、settled 状态。
- `selectTodayBoard(markets, now)`：输出 hero market + secondary markets。
- `selectTrendingMarkets(markets, now)`：按 liquidity、临期、主题权重排序。
- `selectClosingSoon(markets, now)`：按 deadline 升序，过滤已关闭/已结算。
- `selectRecentlyResolved(markets)`：输出已结算或可 claim 的市场。
- `deriveMarketStory(marketRef)`：生成详情页故事文案。
- `selectRelatedMarkets(current, allMarkets)`：输出相关市场。

这些函数必须可单测，不访问浏览器、不读取链、不调用 LLM。

## 执行模式

- Architecture Codex：负责 OpenSpec、任务包、worker 边界、集成、最终验证。
- Implementation Codex：使用 `worker-codex` 角色，配置为 `gpt-5.4` + `xhigh`，按 TDD 实现。
- Review Codex：使用 `review-codex` 角色，配置为 `gpt-5.4` + `xhigh`，独立审查。

## 切片

1. Slice A：OpenSpec + 公共派生层 + 测试。
2. Slice B：首页丰富内容组件与接入。
3. Slice C：市场卡片和主题包视觉增强。
4. Slice D：详情页故事、相关市场、活动时间线。
5. Slice E：视觉 QA、回归测试、Review 和归档。

为了减少冲突，公共派生层先由单一 worker 固化；其余 UI slice 在同一 worker 纵切实现，或在确认文件白名单不重叠后再并行拆分。

## 验证策略

- `cd web && pnpm exec vitest run test/market-richness.test.ts`
- `cd web && pnpm exec vitest run test/theme-market-pages.test.ts web/components/__tests__/ThemeMarketBoard.test.tsx`
- `cd web && node test/check_home_page.mjs`
- `cd web && node test/check_market_components.mjs`
- `cd web && pnpm typecheck`
- `cd web && pnpm build`
- 如启动本地页面，则用浏览器或截图检查桌面/移动端不重叠、不空白、主入口可点击。

## 风险与缓解

- 页面过度拥挤：rich sections 使用紧凑列表和清晰层级，市场网格仍是主操作区。
- 伪造热度/趋势：只使用当前已读取数据派生，不制造不存在的 24h 变化或下注 feed。
- 与下注按钮冲突：卡片主体链接与按钮区域保持分离，沿用现有无嵌套按钮结构。
- 现有静态检查脆弱：新增行为测试优先，必要时更新静态检查 token，但不删除原有覆盖。
- Lens 成本误触发：rich sections 不自动 POST Lens，只展示入口或已有 Lens 组件。
