# World Cup Category Runbook

## Capability 概述

World Cup 品类通过独立 `EventMarket` 承载离散 outcome 市场，通过 `AdminEventOracle` 提供赛事结果结算。Crypto 市场继续走 `PredictionMarket` + Pyth 价格路径；两类市场共享同一 USDC token，但合约地址、allowance 和前端品类视图相互隔离。

数据流：

1. 前端用 `worldcup-seed.ts` 展示赛程、队伍、阶段和 skeleton markets。
2. `EventMarket.createMarket` 创建 1X2、让分、冠军盘等 N-outcome 市场。
3. 用户向 `EventMarket` 授权 USDC 后下注。
4. owner 在赛后通过 `AdminEventOracle.proposeResult` 提交结果。
5. 72h dispute window 结束后，无挑战走 `finalizeResult`；有挑战则走 `revokeProposal`、`confirmProposal` 或 `finalizeOnTimeout`。
6. `EventMarket.resolve` 读取 oracle finalized result，用户通过 `claim` 领取 payout。

实时比分只用于展示，不参与链上结算。TheSportsDB 失败、限流或断网时，页面必须降级为赛程基础信息，下注与领奖路径不受影响。

## Owner SOP

以下命令模板均为人工执行。先确认目标网络、RPC、合约地址和 signer，不在 Codex 未授权会话中执行真实广播。

### 读取状态

```bash
cast call $ADMIN_EVENT_ORACLE "getEventStatus(bytes32)(uint8)" $EVENT_ID --rpc-url $RPC_URL
cast call $ADMIN_EVENT_ORACLE "getResult(bytes32)(uint8,bool)" $EVENT_ID --rpc-url $RPC_URL
cast call $ADMIN_EVENT_ORACLE "owner()(address)" --rpc-url $RPC_URL
```

### 提交结果

触发条件：比赛结束、比分来源与人工复核一致、对应市场已过 `resolveAfter`。

```bash
cast send $ADMIN_EVENT_ORACLE "proposeResult(bytes32,uint8)" $EVENT_ID $OUTCOME_INDEX \
  --rpc-url $RPC_URL \
  --private-key $OWNER_PRIVATE_KEY
```

提交后记录：

- tx hash
- block number
- `ResultProposed` event
- `proposedAt`
- 72h dispute window 截止时间

### 无挑战最终化

触发条件：`getEventStatus(eventId) == Proposed` 且 `proposedAt + 72h` 已过。

```bash
cast send $ADMIN_EVENT_ORACLE "finalizeResult(bytes32)" $EVENT_ID \
  --rpc-url $RPC_URL \
  --private-key $OPERATOR_PRIVATE_KEY
```

任何 EOA 均可触发；生产 runbook 建议使用专用自动化钱包或低权限运营钱包。

### owner 撤销提案

触发条件：事件处于 `Challenged`，owner 复核后确认原提案错误。

```bash
cast send $ADMIN_EVENT_ORACLE "revokeProposal(bytes32)" $EVENT_ID \
  --rpc-url $RPC_URL \
  --private-key $OWNER_PRIVATE_KEY
```

结果：

- 状态回到 `Pending`
- 挑战者收回 100 USDC stake
- 挑战者获得 100 USDC bonus，资金来自 `bonusBank`
- owner 需要重新 `proposeResult`

### owner 驳回挑战

触发条件：事件处于 `Challenged`，owner 复核后确认原提案正确。

```bash
cast send $ADMIN_EVENT_ORACLE "confirmProposal(bytes32)" $EVENT_ID \
  --rpc-url $RPC_URL \
  --private-key $OWNER_PRIVATE_KEY
```

结果：

- 状态变为 `Finalized`
- 挑战者 100 USDC stake 没收到 `feeRecipient`
- 后续执行 `EventMarket.resolve`

### owner 不响应超时最终化

触发条件：事件处于 `Challenged`，距离首次提案已超过 72h，owner 未 revoke / confirm。

```bash
cast send $ADMIN_EVENT_ORACLE "finalizeOnTimeout(bytes32)" $EVENT_ID \
  --rpc-url $RPC_URL \
  --private-key $OPERATOR_PRIVATE_KEY
```

结果：

- 状态变为 `Finalized`
- 挑战者 100 USDC stake 退还
- 无 bonus
- 原提案 outcome 生效

### resolve + claim

```bash
cast send $EVENT_MARKET "resolve(uint256)" $MARKET_ID \
  --rpc-url $RPC_URL \
  --private-key $OPERATOR_PRIVATE_KEY
```

用户 claim 由前端触发；人工排障时可用：

```bash
cast call $EVENT_MARKET "pendingPayout(uint256,address)(uint256)" $MARKET_ID $USER --rpc-url $RPC_URL
cast send $EVENT_MARKET "claim(uint256)" $MARKET_ID --rpc-url $RPC_URL --private-key $USER_PRIVATE_KEY
```

## Dispute 处理流程

1. 监听 `Challenged(eventId, challenger, challengedAt)`。
2. 暂停对外声明该事件已结算，直到 owner 处理或超时。
3. 复核来源：官方赛果、TheSportsDB 展示数据、人工记录、链上提案 outcome。
4. 选择路径：
   - 原提案错误：`revokeProposal`，然后重新 `proposeResult`。
   - 原提案正确：`confirmProposal`。
   - owner 超时：任何 EOA 可 `finalizeOnTimeout`。
5. 记录 tx hash、状态读数、挑战者余额变化、bonusBank / feeRecipient 余额变化。

### bonus bank 充值

`bonusBank` 必须保留足够 USDC，并提前 approve 给 `AdminEventOracle`。

```bash
cast send $USDC "transfer(address,uint256)" $BONUS_BANK $AMOUNT \
  --rpc-url $RPC_URL \
  --private-key $FUNDER_PRIVATE_KEY

cast send $USDC "approve(address,uint256)" $ADMIN_EVENT_ORACLE $ALLOWANCE \
  --rpc-url $RPC_URL \
  --private-key $BONUS_BANK_PRIVATE_KEY

cast call $USDC "balanceOf(address)(uint256)" $BONUS_BANK --rpc-url $RPC_URL
cast call $USDC "allowance(address,address)(uint256)" $BONUS_BANK $ADMIN_EVENT_ORACLE --rpc-url $RPC_URL
```

建议告警阈值：`bonusBank balance < 5 * BONUS` 或 allowance 低于同等金额时补充。

## 体育比分 API 切换

默认 API base：

```text
https://www.thesportsdb.com/api/v1/json/123
```

运维覆盖变量：

- 服务端或构建环境：`SPORTSDB_API_BASE`
- 前端公开环境：`NEXT_PUBLIC_SPORTSDB_API_BASE`
- 本地开发 query override：`?wcScoreApiBase=<base-url>`

切换步骤：

1. 在 Preview 环境配置新 base。
2. 用比赛详情页验证 URL 构造与 60s cache。
3. 运行降级测试：

```bash
cd web
pnpm exec vitest run test/event-source.degradation.test.tsx
```

4. 确认失败矩阵均降级为 `{ status: 'error', score: null }`。
5. 确认 `EventInfoPanel` 只隐藏比分，不影响 `EventBetModal` / claim。
6. 再推广到 Production。

## 灰度开关运维

开关：

```text
NEXT_PUBLIC_WORLDCUP_ENABLED=false
```

语义：

- 未设置或不等于 `false`：World Cup 默认可见。
- 等于字符串 `false`：隐藏 World Cup 品类 Tab，前端回到 Crypto-only 视图。

Preview 切换流程：

1. 设置 `NEXT_PUBLIC_WORLDCUP_ENABLED=false`。
2. 重新部署 Preview。
3. 执行：

```bash
cd web
NEXT_PUBLIC_WORLDCUP_ENABLED=false pnpm exec vitest run
NEXT_PUBLIC_WORLDCUP_ENABLED=false pnpm build
NEXT_PUBLIC_WORLDCUP_ENABLED=false pnpm typecheck
```

4. 手动检查首页、下注、领奖、Faucet、钱包连接。

Production 切换流程：

1. 先在 Vercel Production 修改环境变量。
2. 重新部署 production。
3. 验证首页默认 Crypto、无 World Cup Tab。
4. 如为应急关闭，同时暂停 `AdminEventOracle`，但不要影响 `PredictionMarket`。

## 自动化钱包私钥保管约定

沿用 `docs/superpowers/plans/2026-06-18-automated-categories-deployment.md` 的 2026-06-19 规则：

- 不把当前 owner / deployer 私钥直接写入 Vercel Production。
- 使用专用自动化钱包，只放少量 gas 与 USDC seed 预算。
- `AUTOMATION_PRIVATE_KEY` 只配置专用自动化钱包私钥。
- 本地备份文件使用未跟踪的 `contracts/.env.automation.local`，权限 `0600`，且被 `.gitignore` 的 `.env.*.local` 忽略。
- 需要自动化调用 `createMarket`、`proposeResult`、`finalizeResult` 时，先把 `EventMarket.owner()` 与 `AdminEventOracle.owner()` 迁移到专用自动化钱包。
- Codex 未获用户明确授权时，不读取、不打印、不广播使用任何私钥。

## 回滚 / 应急

优先级从低风险到高风险：

1. 关前端灰度：`NEXT_PUBLIC_WORLDCUP_ENABLED=false`，重新部署。
2. 暂停 oracle：`AdminEventOracle.pause()`，阻止新的 propose/challenge/finalize 状态变更；只读结果仍可查。
3. 暂停运营操作：停止 seed、新市场创建和人工 propose。
4. 保留已 finalized 市场的 claim 路径；不要撤销用户已可领取 payout。
5. 如合约地址或 owner 配置错误，重新部署 `AdminEventOracle` + `EventMarket`，更新 `web/lib/addresses.ts` 或环境变量，再重新 seed。
6. 重新开放顺序：链上读 owner/USDC/oracle 地址 -> bonusBank 余额与 allowance -> Preview 灰度验证 -> Production 灰度开启。

真实 testnet 广播、首笔下注、归档和 post-archive 73h claim smoke 分别记录到 10.3、11.3、10.7，不在本 runbook 自动执行。
