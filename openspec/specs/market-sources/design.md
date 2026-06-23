# Design: market-sources

## 目的

MarketSource 是 ArcPredict 自动化品类的插件边界。它把新品类的题目发现、
数据源解析、结题判断和 Lens 预热从 cron 编排中拆出，使 macro、chain 以及
后续品类可以通过注册 source 接入统一自动化管道。

详细实施期设计来源：
`docs/superpowers/specs/2026-06-17-categories-expansion-design.md`。

## 架构形态

```
Vercel Cron POST /api/cron/markets/tick
    │
    ▼
registry.enabled()
    │
    ├─ source.fetchUpcoming(now)
    ├─ chainWriter.createMarket(eventId, draft)
    ├─ seedLiquidity(marketId)
    ├─ lensPreloader.warm(marketId)
    └─ source.resolve(openMarket, now)
```

所有自动化品类统一使用 `EventMarket` + `AdminEventOracle`。宏观题目也以
discrete outcome 区间表达，不新增合约，不引入外部数据库；链上事件和公开
数据源是 cron 每次 tick 的可重建真相。

## 核心契约

| 契约 | 说明 |
| --- | --- |
| `MarketSource.id` | source 唯一标识，例如 `fred-macro` / `chain-event` |
| `MarketDraft.externalKey` | 从数据源派生的现实事件唯一键，用于幂等 |
| `fetchUpcoming(now)` | 返回未来可开市的 market drafts |
| `resolve(market, now)` | 返回 `settled` / `invalid` / `still-open` 三态结果 |
| `computeMarketId(sourceId, externalKey)` | 同一哈希同时作为幂等键和 oracle eventId |

## 关键决策

- **无外部 DB**：链上事件和数据源可重建状态，避免新增运维面。
- **统一事件市场路径**：自动化品类不走 Pyth price adapter，全部走 EventMarket。
- **单 tick 限额**：每个 source 最多 5 个新建、10 个 resolve，适配 Vercel 60s 限制。
- **跨 tick 结题**：`AdminEventOracle` 72h challenge window 由多次 tick 推进。
- **固定 seed**：Phase 1 每个自动化市场注入 1 USDC，并按 outcome 均分。
- **失败局部化**：单 source 失败记录在 per-source report 中，不阻断其他 source。

## 生产验收证据

2026-06-19 Arc Testnet 生产记录显示，专用自动化钱包已接管 EventMarket 与
AdminEventOracle owner；生产合约 tick 已新建 macro / chain 市场并链上验证
outcome pools；最终 Vercel Production tick 返回 HTTP 200，`marketId=119`
完成 seed 补偿验证。
