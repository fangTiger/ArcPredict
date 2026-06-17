# Tasks: add-automated-categories

## Phase 0: OpenSpec scaffolding
- [ ] 0.1 创建 openspec/changes/add-automated-categories/ 骨架
- [ ] 0.2 落档 spec delta（market-sources / fred-adapter / market-category / ai-lens）
- [ ] 0.3 运行 `openspec validate add-automated-categories --strict`

## Phase A: Types & primitives
- [ ] A.1 扩展 MarketCategory enum
- [ ] A.2 实现 external-key marketId 哈希工具
- [ ] A.3 实现 MarketSource 接口与基础类型
- [ ] A.4 实现 source registry

## Phase B: 数据源 clients
- [ ] B.1 FRED API 客户端 + 缓存
- [ ] B.2 DefiLlama API 客户端 + 缓存

## Phase D: 链上交互层
- [ ] D.1 chain-reader（扫 EventMarket events + 读 oracle status）
- [ ] D.2 chain-writer（createMarket / proposeResult / finalizeResult / EventMarket.resolve / seedLiquidity）

## Phase E: Sources 实现
- [ ] E.1 fred-macro source（CPI + Fed Funds + NFP）
- [ ] E.2 chain-event source（Token unlock + TVL 阈值）

## Phase F: AI Lens
- [ ] F.1 macro.ts contextBuilder
- [ ] F.2 chain.ts contextBuilder
- [ ] F.3 route-handler dispatch 扩展
- [ ] F.4 lens-preloader

## Phase G: Cron orchestrator
- [ ] G.1 tick.ts 主循环
- [ ] G.2 /api/cron/markets/tick route handler
- [ ] G.3 vercel.json cron 配置

## Phase H: 前端
- [ ] H.1 MarketFilterBar 扩 4 tab
- [ ] H.2 HomeHero 暴露新品类入口

## Phase I: 验收
- [ ] I.1 mainnet fork E2E smoke test
- [ ] I.2 测试网 24h 稳定运行验收

## Phase J: 归档
- [ ] J.1 合并 delta 到 openspec/specs/
- [ ] J.2 归档变更到 archive/YYYY-MM-DD-add-automated-categories/
