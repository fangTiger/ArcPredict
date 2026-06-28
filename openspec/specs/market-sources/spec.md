# Capability: market-sources

## Purpose

ArcPredict 的 MarketSource 能力定义自动化市场的数据源插件、幂等开市、
跨 tick 结题与 cron 编排约束。该能力让新品类通过注册 source 即可接入
统一的 EventMarket + AdminEventOracle 自动化管道。
## Requirements
### Requirement: MarketSource 插件接口

系统 SHALL 提供 `MarketSource` 接口供新品类实现，每个 source 自包含
`fetchUpcoming` 与 `resolve` 两个生命周期方法，并通过 deterministic
`externalKey` 保证 cron 多次 tick 的幂等。系统 SHALL 通过 EventMarket
deployment registry 为每个 source 选择目标 `EventMarket` / `AdminEventOracle`
deployment；同一个 cron tick 可以处理多个 deployment，且一个 source 的目标
deployment 不得由另一个品类部署覆盖。

#### Scenario: 新品类无需改动 cron
- **WHEN** 工程师新增一个 `MarketSource` 实现并注册到 registry
- **THEN** cron tick SHALL 自动调用它的 `fetchUpcoming` 与 `resolve`
- **AND** 无需修改 `tick.ts` / `chain-writer.ts` / `chain-reader.ts`

#### Scenario: 幂等去重
- **WHEN** cron 在同一天连跑两次 tick
- **THEN** 同一 `externalKey` 对应的 marketId SHALL 不会被重复 createMarket
- **AND** 链上 `markets[marketId]` 已存在的检查 SHALL 阻止重复开市

#### Scenario: source 写入指定 deployment
- **WHEN** `fred-macro` 与 `chain-event` 已配置到 `automated-v1` deployment
- **THEN** cron SHALL 使用 `automated-v1` 的 EventMarket / AdminEventOracle 地址创建、seed 和推进结题
- **AND** SHALL NOT 把这些 source 写入 `worldcup-v1` deployment
- **AND** `worldcup-v1` 中已有 WorldCup 市场 SHALL 继续保留并可读

### Requirement: Cron 单次执行约束

系统 SHALL 在单次 cron tick 内对每个 source 限制：最多创建 5 个新市场、
最多结题 10 个已到期市场，剩余项延后到下次 tick 处理。

#### Scenario: 限额生效
- **WHEN** 某个 source 的 `fetchUpcoming` 返回 8 个 drafts
- **THEN** chain-writer SHALL 仅处理前 5 个
- **AND** 剩余 3 个在下次 tick 自动重新出现并被处理

### Requirement: Automated market seed budget

系统 SHALL 对 cron 新建的每个自动化市场注入 1 USDC 项目方引导流动性，
并按 outcome 数量均分。

#### Scenario: 新建自动化市场使用低成本 seed
- **WHEN** cron 创建 macro 或 chain 市场
- **THEN** seed liquidity SHALL approve 1 USDC
- **AND** seed liquidity SHALL 将该 1 USDC 按 outcome 数量均分下注

### Requirement: 失败局部化

系统 SHALL 在单个 source 抛错时局部化失败，其他 source 不受影响。

#### Scenario: 单 source 失败不阻塞
- **WHEN** `fred-macro` 在 `fetchUpcoming` 抛 fetch timeout
- **THEN** `chain-event` source SHALL 仍正常执行
- **AND** cron tick 整体 SHALL 返回 200，但 response body 包含 per-source error
