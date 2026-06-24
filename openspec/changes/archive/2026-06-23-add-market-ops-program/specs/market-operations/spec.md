## ADDED Requirements

### Requirement: 自动市场生命周期报告

系统 SHALL 为每次自动化 market tick 生成可审计的 OpsReport。OpsReport 至少包含：执行时间、总耗时、每个 source 的 opened / skipped / seeded / proposed / finalized / settled / errors 计数、关键交易 hash、seed 结果、Lens preload 结果与 warning 列表。

#### Scenario: tick 成功返回 report
- **WHEN** `/api/cron/markets/tick` 成功执行
- **THEN** response body SHALL 包含 `ok: true`
- **AND** SHALL 包含 `report.perSource`
- **AND** 每个 source 的 report SHALL 包含 opened / skipped / seeded / errors 字段

#### Scenario: 单 source 失败局部化
- **WHEN** `fred-macro` 抛出外部 API timeout
- **THEN** OpsReport SHALL 在 `perSource["fred-macro"].errors` 中记录脱敏错误
- **AND** 其他 source SHALL 继续执行
- **AND** tick SHALL 返回 200，除非所有 source 都因为配置缺失无法执行

### Requirement: 自动 seed 可观测

系统 SHALL 对自动 seed 的成功、失败和资金不足状态进行显式报告。每个自动化市场的 seed 结果 SHALL 能被 OpsReport 表达为 `seeded`、`seed_failed` 或 `needs_funding`。

#### Scenario: seed 成功
- **WHEN** cron 创建新市场并完成 1 USDC seed
- **THEN** OpsReport SHALL 标记该 market 的 seed 状态为 `seeded`
- **AND** SHALL 记录对应 approve / bet transaction hash（如运行环境返回）

#### Scenario: 自动化钱包余额不足
- **WHEN** 自动化钱包 USDC 余额不足以 seed 新市场
- **THEN** OpsReport SHALL 标记 `needs_funding`
- **AND** SHALL NOT 泄露自动化钱包私钥或环境变量值

### Requirement: 结算信任层

系统 SHALL 在市场详情页展示统一的 Settlement Timeline。PRICE 市场 SHALL 展示 Pyth 结算路径；EVENT 市场 SHALL 展示 AdminEventOracle 结算路径、当前状态、challenge window 与 claimable 状态。

#### Scenario: EVENT 市场处于 challenge window
- **WHEN** EVENT 市场的 `AdminEventOracle` 状态为 `Proposed`
- **THEN** 详情页 SHALL 显示 `Challenge Window`
- **AND** SHALL 显示剩余时间或已结束状态
- **AND** SHALL 显示 `Resolution Source: AdminEventOracle`

#### Scenario: PRICE 市场已结算
- **WHEN** PRICE 市场 outcome 不再是 Unresolved
- **THEN** Settlement Timeline SHALL 显示 `Resolved` 或 `Invalid`
- **AND** 若用户有可领取赢家仓位，页面 SHALL 显示 claimable 状态

### Requirement: 密钥与错误脱敏

系统 SHALL 对所有 OpsReport、UI error、console-safe error 做脱敏处理，不得泄露 private key、Authorization header、DeepSeek API key、RPC token 或 Vercel secret。

#### Scenario: 环境变量错误不泄密
- **WHEN** cron 因缺少或错误的 `AUTOMATION_PRIVATE_KEY` 失败
- **THEN** response SHALL 仅返回脱敏错误码或通用错误说明
- **AND** response SHALL NOT 包含私钥、`sk-`、Bearer token 或完整 RPC URL query secret

### Requirement: 三角色执行治理

市场运营规划与实现 SHALL 遵循三角色流水线：Architecture Codex 负责 OpenSpec、设计、handoff、集成与最终验证；Implementation Codex 负责 TDD 实现；Review Codex 负责独立审查。Implementation Codex 与 Review Codex SHALL 使用各自项目配置中的 `gpt-5.4` + `xhigh`。

#### Scenario: 中大型任务进入 handoff
- **WHEN** `add-market-ops-program` 进入实现阶段
- **THEN** Architecture Codex SHALL 为每个 slice 输出 Handoff Task Package
- **AND** Implementation Codex SHALL 只修改 task package 的 Editable files
- **AND** Review Codex 未输出 `PASS` 前，Architecture Codex SHALL NOT archive 该变更
