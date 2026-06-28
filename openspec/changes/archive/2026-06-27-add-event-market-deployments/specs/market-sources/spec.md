## MODIFIED Requirements

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
