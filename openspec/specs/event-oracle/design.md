# Design: event-oracle

## 目的

`event-oracle` 记录 ArcPredict 赛事结果结算源的接口与 MVP 实现。它为 `EventMarket` 提供链上可读的最终结果，同时为未来替换 UMA Optimistic Oracle 保留接口边界。

## 架构形态

```
Owner EOA
    │ proposeResult / revokeProposal / confirmProposal / pause
    ▼
AdminEventOracle
    ├─ Proposal(eventId => outcomeIndex, proposedAt, challenger, status)
    ├─ challenge: 100 USDC stake
    ├─ 72h dispute window
    └─ getResult(eventId) -> EventMarket.resolve(id)
```

## 关键决策

### Admin + 72h 异议期

MVP 使用 `AdminEventOracle`，由 owner 提交赛事结果。提交后进入 72 小时异议期；无挑战时任何账户可 `finalizeResult`，有挑战时 owner 通过 `revokeProposal` 或 `confirmProposal` 裁定，owner 超时不响应时任何账户可 `finalizeOnTimeout`。

世界杯赛事结果客观、场次数量有限，Admin + 异议期足以覆盖 MVP，同时比直接接 UMA 更快落地。

### 100 USDC 挑战质押与 bonusBank

挑战方需要质押 100 USDC。owner 接受挑战时，挑战方收回质押并从 `bonusBank` 领取 100 USDC bonus；owner 驳回挑战时，质押转入 `feeRecipient`；owner 超时不响应时，只退质押，不发 bonus。

测试网部署中 `feeRecipient` 与 `bonusBank` 均映射到自动化钱包地址，这是测试网简化决策，不改变合约语义。

### Ownable2Step 权限模型

`AdminEventOracle` 继承 `Ownable2Step`，保持与现有 owner EOA 运维模式一致。owner 持有提交、裁定和暂停权限；只读查询对所有账户开放。

### 接口隔离

`EventMarket` 只依赖 `IEventOracle`。未来如接入 `UMAEventOracle`，可以部署新的 oracle 和绑定该 oracle 的 `EventMarket`，旧市场继续使用旧 oracle 直到自然结算。

## 状态机

| 当前状态 | 调用 | 下一状态 | 资金动作 |
| --- | --- | --- | --- |
| Pending | `proposeResult` | Proposed | 无 |
| Proposed | `challenge` | Challenged | 挑战方转入 100 USDC |
| Proposed | `finalizeResult`（72h 后） | Finalized | 无 |
| Challenged | `revokeProposal` | Pending | 退质押 + bonus |
| Challenged | `confirmProposal` | Finalized | 质押转入 feeRecipient |
| Challenged | `finalizeOnTimeout`（72h 后） | Finalized | 退质押，无 bonus |

## 合约常量

- `DISPUTE_WINDOW = 72 hours`
- `CHALLENGE_STAKE = 100 * 1e6`
- `BONUS = 100 * 1e6`
- `MAX_OUTCOMES` 由构造参数设置，世界杯部署为 `32`

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| owner EOA 作恶或误操作 | 72h 异议期、公开事件、挑战质押和可审计状态机 |
| 恶意挑战刷量 | 100 USDC 质押；owner 驳回时质押没收 |
| owner 离线 | `finalizeOnTimeout` 允许任何账户在异议期后推进最终化 |
| API 或比分源错误 | API 数据不进入结算路径，最终结果只来自 oracle |
| 后续去中心化需求 | `IEventOracle` 为 UMA 替换保留接口 |

## 测试网部署记录

2026-06-24 Arc Testnet 部署：
- `AdminEventOracle = 0xA4b27Ee975C31Ad60fF0Bda8ACB680Cb183BC004`
- `EventMarket = 0x2E9F15905739632ed7b156b4c7824d368a97bB15`
- owner / feeRecipient / bonusBank 均为自动化钱包 `0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E`
- 证据见 `docs/qa/2026-06-13-phase7b-testnet-deploy.md`
