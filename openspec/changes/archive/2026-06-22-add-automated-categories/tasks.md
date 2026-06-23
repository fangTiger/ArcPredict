# Tasks: add-automated-categories

> 进度：Phase 0-J 全部完成，归档于 2026-06-22。
> Phase I.1（E2E 测试代码）已落档但默认 skip。
> Phase I.2（testnet 部署 + 24h 观察）与 Phase J（归档）证据见 `docs/superpowers/plans/2026-06-18-automated-categories-deployment.md` 的 2026-06-19 生产记录。

## Phase 0: OpenSpec scaffolding
- [x] 0.1 创建 openspec/changes/add-automated-categories/ 骨架
- [x] 0.2 落档 spec delta（market-sources / market-category / ai-lens；fred-adapter v0.2 已废弃）
- [x] 0.3 运行 `openspec validate add-automated-categories --strict`

## Phase A: Types & primitives
- [x] A.1 扩展 MarketCategory enum
- [x] A.2 实现 external-key marketId 哈希工具
- [x] A.3 实现 MarketSource 接口与基础类型
- [x] A.4 实现 source registry

## Phase B: 数据源 clients
- [x] B.1 FRED API 客户端 + 缓存
- [x] B.2 DefiLlama API 客户端 + 缓存

## Phase D: 链上交互层
- [x] D.0 合约 ABI 收口（abi.ts，markets/getResult/getEventStatus/MarketCreated/ResultProposed）
- [x] D.1 chain-reader（扫 EventMarket events + 读 oracle status + pendingMarketsForSource）
- [x] D.2 chain-writer（createMarket / proposeResult / finalizeResult / EventMarket.resolve / approveUsdc）
- [x] D.3 seed-liquidity（1 USDC / 市场，按 outcome 均分）

## Phase E: Sources 实现
- [x] E.1 fred-macro source（CPI + Fed Funds + NFP，区间 outcomes）
- [x] E.2 chain-event source（ETH/Arbitrum TVL 阈值，yes/no outcomes）

## Phase F: AI Lens
- [x] F.1 macro.ts contextBuilder
- [x] F.2 chain.ts contextBuilder
- [x] F.3 route-handler dispatch 扩展（注入 [Category context]）
- [x] F.4 lens-preloader（best-effort cache warm）

## Phase G: Cron orchestrator
- [x] G.1 tick.ts 主循环（discovery + create stage）
- [x] G.2 tick resolve 分支（propose / finalize / settle，72h challenge gate）
- [x] G.3 /api/cron/markets/tick route + bootstrap
- [x] G.4 vercel.json cron 配置（0 2 * * *）

## Phase H: 前端
- [x] H.1 MarketFilterBar 扩 4 tab + page.tsx 路由扩展
- [x] H.2 HomeHero 暴露新品类入口（stash 隔离用户脏改）
- [x] H.3 Macro / On-chain 自动化市场主题图片（静态资产 + row metadata + 列表/详情渲染）

## Phase I: 验收
- [x] I.1 mainnet fork E2E smoke test（代码落档，默认 skip）
- [x] I.2 测试网 24h 稳定运行验收（依赖人工部署，runbook 见 deployment 文档）
  - 证据：deployment runbook `2026-06-19 Production 决策记录`、`2026-06-19 执行结果`、`2026-06-19 最终 Production 状态`：专用自动化钱包 `0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E` 已接管 owner；Macro/On-chain 生产合约 tick 新建 marketId `98-107` 并链上验证 outcome pools；最终 Vercel Production `https://web-7gostadug-arcpredict.vercel.app`（alias `https://web-one-weld-20.vercel.app`）手动触发 `POST /api/cron/markets/tick` 返回 HTTP 200；`marketId=119` seed 补齐后每个 outcome pool 为 `0.5` USDC。

## Phase J: 归档
- [x] J.1 合并 delta 到 openspec/specs/（等 I.2 通过后做）
  - 证据：2026-06-22 归档执行将 `market-sources`、`market-category`、`ai-lens` delta 合并到 `openspec/specs/`，并保留 I.2 runbook 证据指针。
- [x] J.2 归档变更到 archive/YYYY-MM-DD-add-automated-categories/（等 I.2 通过后做）
  - 证据：2026-06-22 归档执行将本 change 移动到 `openspec/changes/archive/2026-06-22-add-automated-categories/`。
