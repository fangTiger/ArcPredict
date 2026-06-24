# Tasks: add-market-ops-program

## 0. Architecture Codex — 提案与治理

- [x] 0.1 重置 `.codex/session-state.md` 为 `ActiveTaskStatus: NONE`
- [x] 0.2 创建 OpenSpec 提案、设计与 spec delta
- [x] 0.3 运行 `openspec validate add-market-ops-program --strict --no-interactive`
- [x] 0.4 用户确认提案范围后，Architecture Codex 准备 Handoff Task Package

## 1. Architecture Codex — Handoff 切片

- [x] 1.1 为 Slice A 准备 Market Ops 数据契约任务包
- [x] 1.2 为 Slice B 准备 SettlementTimeline 信任层任务包
- [x] 1.3 为 Slice C 准备 Weekly Theme Pack 任务包
- [x] 1.4 为 Slice D 准备 Lens preload / cron report 整合任务包
- [x] 1.5 为 Slice E 准备 QA / 文档 / OpenSpec 收口任务包

> 执行决策：由于 Slice A-D 共享 `web/lib/markets` 数据契约与前端聚合类型，为避免多 worker 并发改公共契约，Architecture Codex 将它们合并为单一纵切 Handoff Task Package：`worker-codex-market-ops-001 / market-ops-vertical`。

## 2. Implementation Codex — Slice A: Market Ops 数据契约

Executor: Implementation Codex (`.codex/agents/worker-codex.toml`, `gpt-5.4` + `xhigh`)

- [x] 2.1 先写失败测试，覆盖 tick report 字段、per-source 错误、seed health 和 secret redaction
- [x] 2.2 实现 OpsReport 类型与生成逻辑
- [x] 2.3 将 cron tick 输出扩展为可审计 report，保持现有成功/失败语义兼容
- [x] 2.4 运行并记录验证命令

## 3. Implementation Codex — Slice B: SettlementTimeline

Executor: Implementation Codex (`.codex/agents/worker-codex.toml`, `gpt-5.4` + `xhigh`)

- [x] 3.1 先写 PRICE / EVENT lifecycle 推导单测
- [x] 3.2 新增 `SettlementTimeline` 组件
- [x] 3.3 接入市场详情页，展示 oracle 来源、challenge window 与 claimable 状态
- [x] 3.4 验证移动端和桌面端布局

## 4. Implementation Codex — Slice C: Weekly Theme Pack

Executor: Implementation Codex (`.codex/agents/worker-codex.toml`, `gpt-5.4` + `xhigh`)

- [x] 4.1 先写 theme manifest schema 测试
- [x] 4.2 新增 `web/lib/themes/**`，定义 `themeId`、时间窗、市场引用和 copy
- [x] 4.3 新增主题市场聚合逻辑
- [x] 4.4 新增首页主题板块和可分享主题入口
- [x] 4.5 保证没有可用市场时优雅降级

## 5. Implementation Codex — Slice D: Automation + Lens 协同

Executor: Implementation Codex (`.codex/agents/worker-codex.toml`, `gpt-5.4` + `xhigh`)

- [x] 5.1 先写 MarketDraft `themeId` 标签测试
- [x] 5.2 将 source draft 与 theme manifest 连接，但不破坏无主题市场
- [x] 5.3 确认 seed 成功 / 失败都进入 OpsReport
- [x] 5.4 确认 Lens preload 失败不阻塞 createMarket / seed

## 6. Review Codex — 独立审查

Executor: Review Codex (`.codex/agents/review-codex.toml`, `gpt-5.4` + `xhigh`)

- [x] 6.1 审查 scope 是否符合 proposal / spec
- [x] 6.2 审查 TDD evidence、验证输出和 dirty baseline
- [x] 6.3 审查密钥边界、cron 行为、外部 API 失败降级
- [x] 6.4 输出 `PASS` / `FIX_REQUIRED` / `DOWNGRADE`

## 7. Architecture Codex — 最终验证与归档

- [x] 7.1 汇总 worker evidence 与 Review Decision
- [x] 7.2 运行 fresh verification commands
- [x] 7.3 检查 OpenSpec tasks 与实际 diff 一致
- [x] 7.4 archive `add-market-ops-program`
- [x] 7.5 重置 `.codex/session-state.md`
