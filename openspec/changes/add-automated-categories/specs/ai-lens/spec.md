## MODIFIED Requirements

### Requirement: Lens 覆盖 4 类市场

`web/lib/lens/route-handler.ts` SHALL 按 `market.category` 分发到对应
contextBuilder：crypto / event / macro / chain。

#### Scenario: macro 市场 Lens 分析
- **WHEN** 用户对 category=macro 的市场触发 Ask AI
- **THEN** route-handler SHALL 使用 `contextBuilders/macro.ts` 拼装 context
- **AND** context SHALL 包含 FRED 历史序列 + 同类指标对照 + 相关资产联动

#### Scenario: chain 市场 Lens 分析
- **WHEN** 用户对 category=chain 的市场触发 Ask AI
- **THEN** route-handler SHALL 使用 `contextBuilders/chain.ts` 拼装 context
- **AND** context SHALL 包含 DefiLlama 当前值 + 子组成拆解 + 历史里程碑

### Requirement: Lens cache 预生成

Cron 在创建新市场后 SHALL 立即调用 lens-preloader，预生成 Lens 分析并写入
现有 cache 层，TTL 24 小时。预生成失败不阻塞 createMarket 主流程。

#### Scenario: 预生成失败不阻塞开市
- **WHEN** cron 创建新市场后调用 lens-preloader 失败
- **THEN** createMarket 主流程 SHALL 保持成功
- **AND** 失败信息 SHALL 被记录供后续排查
