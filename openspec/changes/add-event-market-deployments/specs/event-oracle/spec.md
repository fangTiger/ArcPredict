## MODIFIED Requirements

### Requirement: 透明性与可审计

`AdminEventOracle` 的所有状态变更（提交、挑战、撤销、确认、超时最终化、暂停）SHALL 通过 Solidity event 广播。前端 SHALL 在市场详情页显示 "Resolution Source: AdminEventOracle" 标识，并提供链接到链上事件历史。当前端展示多个 EventMarket deployment 时，详情页 SHALL 使用当前 market row 的 `oracleAddress` 展示链接并查询 oracle 状态，而不是使用单一全局 oracle 地址。

#### Scenario: 赛事状态事件发出
- **WHEN** 任一状态变更方法成功执行
- **THEN** 合约 SHALL 发出对应 event（`ResultProposed`、`Challenged`、`ProposalRevoked`、`ProposalConfirmed`、`Finalized`、`FinalizedOnTimeout`）
- **AND** event 参数 SHALL 包含 `eventId`、相关地址、时间戳

#### Scenario: 暂停事件发出
- **WHEN** owner 调用 `pause()` 或 `unpause()`
- **THEN** 合约 SHALL 发出 OpenZeppelin `Paused(address)` 或 `Unpaused(address)` event
- **AND** event 参数 SHALL 包含触发账户

#### Scenario: 前端展示结算来源
- **WHEN** 用户进入 World Cup 市场详情页
- **THEN** 页面 SHALL 显式标注 "Resolution Source: AdminEventOracle (Owner + 72h Dispute Window)"
- **AND** SHALL 提供链接到 `AdminEventOracle` 合约地址的区块浏览器

#### Scenario: 多 deployment oracle 状态查询
- **WHEN** 用户从 Macro 或 On-chain Tab 打开属于 `automated-v1` 的市场详情页
- **THEN** 详情页 SHALL 使用 `automated-v1.oracleAddress` 查询 `getEventStatus`
- **AND** SHALL NOT 使用 `worldcup-v1.oracleAddress`
