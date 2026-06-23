# Design: add-automated-categories

完整技术设计见：
[`docs/superpowers/specs/2026-06-17-categories-expansion-design.md`](../../../docs/superpowers/specs/2026-06-17-categories-expansion-design.md)

OpenSpec design.md 仅列要点与决策记录，避免双份维护。

## 关键决策

| # | 决策 | 选择 | 备选 | 理由 |
|---|---|---|---|---|
| D1 | 数据持久化 | 无外部 DB | Postgres / JSON | 链上 + 数据源即真相 |
| D2 | price kind 自动结题 | 新增 FredPriceAdapter | 题目 event 化 | 保留数字目标颗粒度 |
| D3 | cron 平台 | Vercel Cron | GH Actions | 已有部署，零新基础设施 |
| D4 | Phase 1 品类 | macro + chain | sports / esports | 数据源最稳、与 Lens 协同最强 |
| D5 | tick 上限 | 5 新建 + 10 resolve / source | 不限 | Vercel 60s 限制 |
| D6 | 引导流动性 | 固定 1 USDC | 策略化 | Phase 1 成本更低，便于测试网持续跑通 |

## 架构图

参见 superpowers 设计文档 §3。
