# Capability: event-oracle

## Purpose

ArcPredict 的 `event-oracle` 能力定义赛事结果结算源。它通过 `IEventOracle` 抽象隔离市场合约与具体预言机实现，MVP 使用 `AdminEventOracle`：owner 提交结果，经过 72 小时异议期和 100 USDC 质押挑战机制后最终化，供 `EventMarket` 读取并执行 payout。

## Requirements

### Requirement: IEventOracle 接口

系统 SHALL 定义 `IEventOracle` Solidity 接口，作为赛事结算预言机的统一抽象。任何赛事预言机实现（MVP 的 `AdminEventOracle`、未来的 `UMAEventOracle` 等）MUST 实现该接口。接口至少 SHALL 包含：提交结果、挑战、owner 裁定、无挑战最终化、超时最终化、查询最终化结果、查询事件状态。

#### Scenario: 接口最小方法集
- **WHEN** 任何赛事预言机实现 `IEventOracle`
- **THEN** 实现 MUST 提供以下方法：
  - `proposeResult(bytes32 eventId, uint8 outcomeIndex)`
  - `challenge(bytes32 eventId)`
  - `revokeProposal(bytes32 eventId)`
  - `confirmProposal(bytes32 eventId)`
  - `finalizeResult(bytes32 eventId)`
  - `finalizeOnTimeout(bytes32 eventId)`
  - `getResult(bytes32 eventId)`
  - `getEventStatus(bytes32 eventId)`

#### Scenario: 市场合约只依赖接口
- **WHEN** `EventMarket` 查询结算结果
- **THEN** 合约 SHALL 仅通过 `IEventOracle` 接口调用，而非具体实现
- **AND** 切换 Oracle 实现 SHALL NOT 需要修改市场合约逻辑

#### Scenario: 未注册 eventId 默认状态为 Pending
- **WHEN** 任意调用者对从未 `proposeResult` 过的 `eventId` 调用 `getEventStatus`
- **THEN** 返回值 SHALL 为 `EventStatus.Pending`
- **AND** 实现 SHALL NOT 要求任何预注册或初始化步骤；`Pending` 作为枚举默认值通过 Solidity mapping 零值天然成立

### Requirement: AdminEventOracle MVP 实现

系统 SHALL 提供 `AdminEventOracle` 合约作为 `IEventOracle` 的 MVP 实现，采用 owner 提交 + 72h 异议期 + 100 USDC 质押挑战 + owner 简单裁定模型。该合约 SHALL 复用现有 `PredictionMarket` 的单 EOA owner 运维模式，沿用同一 `OWNER_PRIVATE_KEY` 配置。

#### Scenario: 结果提交
- **WHEN** owner EOA 调用 `proposeResult(eventId, outcomeIndex)`
- **THEN** 合约 SHALL 记录该提案与提交时间戳
- **AND** 事件状态 SHALL 变为 `Proposed`
- **AND** 异议期 72 小时开始计时

#### Scenario: 异议期内无挑战
- **WHEN** 72 小时异议期过去且无任何挑战
- **THEN** 任何 EOA SHALL 能调用 `finalizeResult(eventId)` 触发最终化
- **AND** 事件状态 SHALL 变为 `Finalized`
- **AND** `getResult(eventId)` SHALL 返回 `(outcomeIndex, true)`

#### Scenario: 异议期内被挑战
- **WHEN** 任何 EOA 在异议期内调用 `challenge(eventId)` 并通过 ERC20 `transferFrom` 质押 100 USDC
- **THEN** 事件状态 SHALL 变为 `Challenged`
- **AND** 每个 event 最多只能被挑战一次（首个挑战锁定槽位）
- **AND** `finalizeResult` 在 owner 处理前 SHALL 被锁定

#### Scenario: owner 接受挑战并撤销提案
- **WHEN** owner 调用 `revokeProposal(eventId)`（表示承认提案错误）
- **THEN** 提案 SHALL 被清除，事件状态 SHALL 回到 `Pending`
- **AND** 挑战方 SHALL 收回 100 USDC 质押金 + 100 USDC bonus
- **AND** owner 可以提交新的 `proposeResult`，72h 异议期重新计时

#### Scenario: owner 驳回挑战
- **WHEN** owner 调用 `confirmProposal(eventId)`（坚持原提案）
- **THEN** 事件状态 SHALL 变为 `Finalized`
- **AND** 挑战方质押的 100 USDC SHALL 转入协议 `feeRecipient`

#### Scenario: owner 未响应挑战
- **WHEN** 距离首次提案的 72h 异议期已结束，但事件仍处于 `Challenged` 状态
- **THEN** 任何 EOA SHALL 能调用 `finalizeOnTimeout(eventId)`，以原提案 `outcomeIndex` 作为最终结果
- **AND** 挑战方质押金 SHALL 退还（无 bonus，因为未经裁定）
- **AND** 事件状态 SHALL 变为 `Finalized`

### Requirement: Owner 权限管理

`AdminEventOracle` SHALL 继承 OpenZeppelin `Ownable2Step`，由部署时设定的 owner EOA 持有 `proposeResult` / `revokeProposal` / `confirmProposal` / `pause` / `unpause` 权限。owner 地址 SHALL 与现有 `PredictionMarket` 合约的 owner 保持一致。

#### Scenario: 非 owner 提交被拒
- **WHEN** 非 owner 账户调用 `proposeResult` / `revokeProposal` / `confirmProposal`
- **THEN** 调用 SHALL revert with `Unauthorized` 或 `OwnableUnauthorizedAccount`

#### Scenario: Owner 转移
- **WHEN** owner 需要轮换
- **THEN** 转移 SHALL 通过 `Ownable2Step.transferOwnership` + 新 owner `acceptOwnership` 标准流程进行
- **AND** 新 owner 接受 ownership 后 SHALL 继承所有权限

### Requirement: 暂停与紧急停止

`AdminEventOracle` SHALL 提供 owner 可调用的 `pause()` 与 `unpause()` 入口。在 paused 状态下，`proposeResult`、`challenge`、`finalizeResult`、`revokeProposal`、`confirmProposal`、`finalizeOnTimeout` SHALL 全部 revert，但只读方法（`getResult`、`getEventStatus`）SHALL 继续可用。

#### Scenario: 暂停后无法变更状态
- **WHEN** 合约处于 paused 状态
- **THEN** 任何状态变更调用 SHALL revert with `Paused`
- **AND** 已 finalized 的事件结果 SHALL 仍可被市场合约读取以执行 payout

#### Scenario: 紧急停止仅影响 Event 市场
- **WHEN** `AdminEventOracle` 被 paused
- **THEN** 使用 `PythPriceOracle` 的 Crypto 市场 SHALL 不受影响

### Requirement: 透明性与可审计

`AdminEventOracle` 的所有状态变更（提交、挑战、撤销、确认、超时最终化、暂停）SHALL 通过 Solidity event 广播。前端 SHALL 在市场详情页显示 "Resolution Source: AdminEventOracle" 标识，并提供链接到链上事件历史。

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

### Requirement: 接口预留 UMA 升级路径

`IEventOracle` 接口 SHALL 设计为可被 `UMAEventOracle` 实现无缝替换。`EventMarket` SHALL 仅依赖 `IEventOracle` 接口；未来切换 Oracle 时，可部署绑定新 Oracle 的 `EventMarket` 实例或在部署脚本中选择不同实现。

#### Scenario: 新 EventMarket 可绑定不同 Oracle
- **WHEN** 项目方未来部署 `UMAEventOracle` 并部署新的 `EventMarket`
- **THEN** 新创建的 EVENT 市场 SHALL 绑定到 `UMAEventOracle`
- **AND** 已使用 `AdminEventOracle` 的旧 `EventMarket` SHALL 继续正常运作直到自然 finalize

#### Scenario: 同一市场不可中途切换 Oracle
- **WHEN** 一个市场已经创建并绑定了某个 Oracle 实例
- **THEN** 该市场的 Oracle 绑定 SHALL 不可变更
- **AND** 切换 Oracle 只对新创建的市场生效
