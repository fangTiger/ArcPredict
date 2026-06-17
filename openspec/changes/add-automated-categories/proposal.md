# Change: 引入 macro / chain 两个全自动化品类与 MarketSource 框架

## Why
当前 ArcPredict 只有 crypto + worldcup 两类市场，且 worldcup 题目手工 seed，
持续运营成本高。为支持 Arc Discord builder 路径上的持续可见迭代，需建立
"零人工维护、自动开市 + 自动结题"的品类管道，并立刻填充 2 个新品类。

## What Changes
- 新增 capability **market-sources**：MarketSource 插件接口 + 注册表 + cron orchestrator
- **MODIFIED** capability **market-category**：MarketCategory enum 扩展 `'macro' | 'chain'`
- **MODIFIED** capability **ai-lens**：新增 macro / chain 两个 contextBuilder
- Phase 1 接入 2 个具体 source：`fred-macro`（CPI / Fed Funds / NFP，全部 discrete outcome 区间）+ `chain-event`（Token unlock / TVL 阈值）
- 全品类统一走 EventMarket + AdminEventOracle，零新合约（v0.2 pivot，见 spec §9 D2）

## Impact
- Affected specs: market-category, ai-lens, market-sources (new)
- Affected code:
  - web/lib/market-kind.ts (扩 enum)
  - web/lib/markets/** (整个新目录)
  - web/lib/lens/contextBuilders/{macro,chain}.ts (NEW)
  - web/lib/lens/route-handler.ts (新增 dispatch)
  - web/app/api/cron/markets/tick/route.ts (NEW)
  - web/components/{MarketFilterBar,HomeHero}.tsx (扩展)
  - vercel.json (cron 配置)
- 无破坏性变更（worldcup / crypto 流程不动）
- 无合约改动（FredPriceAdapter 方案已废弃，见 spec v0.2 修订）
