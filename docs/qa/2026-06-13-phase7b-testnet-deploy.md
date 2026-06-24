# Phase 7b — Arc Testnet 部署与首笔下注报告

## 环境

- 日期：2026-06-24（Asia/Shanghai）
- chainId：`5042002`
- RPC：`https://rpc.testnet.arc.network`
- 自动化钱包地址：`0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E`
- 部署脚本：`contracts/script/DeployWorldCupTestnet.s.sol`
- 广播命令：`forge script script/DeployWorldCupTestnet.s.sol --rpc-url $AUTOMATION_RPC_URL --broadcast --slow`
- broadcast 产物：`contracts/broadcast/DeployWorldCupTestnet.s.sol/5042002/run-latest.json`
- 部署 tx 数：`100`（2 笔合约部署 + 98 笔 `createMarket`）
- EventMarket 部署区块：`48345106`
- EventMarket 部署区块时间：`1782233375`（2026-06-23 16:49:35 UTC）

## 新合约

| 合约 | 地址 | 部署 tx | Explorer |
| --- | --- | --- | --- |
| AdminEventOracle | `0xA4b27Ee975C31Ad60fF0Bda8ACB680Cb183BC004` | `0x77f7a8e8e4454dfe2552b39dea7a28b767c2b445ec7aac3734379a54fc015339` | `https://testnet.arcscan.app/address/0xA4b27Ee975C31Ad60fF0Bda8ACB680Cb183BC004` |
| EventMarket | `0x2E9F15905739632ed7b156b4c7824d368a97bB15` | `0x398a7df2f124b195aeca61e62db3935157f2f05c3ec13a70c123ade7d57c390b` | `https://testnet.arcscan.app/address/0x2E9F15905739632ed7b156b4c7824d368a97bB15` |

Explorer 可访问性检查：
- `https://testnet.arcscan.app/address/...`：HTTP 200
- `https://testnet.arcscan.app/tx/...`：HTTP 200
- `https://explorer.testnet.arc.network/...`：TLS 连接失败，本次不采用

### Constructor / 链上读数

AdminEventOracle：
- `USDC()`：`0x3600000000000000000000000000000000000000`
- `owner()`：`0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E`
- `feeRecipient()`：自动化钱包地址 `0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E`（testnet 简化决策，记录于本任务包）
- `bonusBank()`：自动化钱包地址 `0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E`（testnet 简化决策，记录于本任务包）
- `DISPUTE_WINDOW()`：`259200` 秒（72h）
- `CHALLENGE_STAKE()`：`100000000` raw USDC（100 USDC）
- `BONUS()`：`100000000` raw USDC（100 USDC）
- `MAX_OUTCOMES()`：`32`

EventMarket：
- `USDC()`：`0x3600000000000000000000000000000000000000`
- `owner()`：`0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E`
- `feeRecipient()`：自动化钱包地址 `0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E`（testnet 简化决策，记录于本任务包）
- `ORACLE()`：`0xA4b27Ee975C31Ad60fF0Bda8ACB680Cb183BC004`

## Seed 结果

- `marketCount()`：`98`
- 小组赛市场：`96` 个（48 场 * 1X2 + goals-25）
- final-1 1X2 市场：`marketId = 96`
- winner 市场：`marketId = 97`
- final-1 `eventId`：`0x2b902d6a9c3a763f380d5c1af8475ea4efa1142488ebc730dc7c1c8851b061b1`
- final-1 问题：`ARG vs FRA 1X2`
- final-1 `outcomeCount`：`3`
- final-1 `betDeadline`：`1782233937`（2026-06-23 16:58:57 UTC）
- final-1 `kickoff/startTime`：`1782234237`（2026-06-23 17:03:57 UTC，2026-06-24 01:03:57 CST）
- final-1 `resolveAfter`：`1782243237`（2026-06-23 19:33:57 UTC）
- kickoff 压缩校验：相对 EventMarket 部署区块时间 `1782233375` 为 `+862s`，落在 `[deploy+12min, deploy+18min]`
- final-1 market creation tx：`0xbed88ffb683cf622d38433a3d5a9b7e9f1ddb225679d8fef973416062f0d011f`
- winner market creation tx：`0xd1c8d9fd89adfceb1dbba4b8bedc9b55291419e8b7c8f0159009b580edc7d983`

部署 seed 资金预算说明：
- `EventMarket.createMarket` 只创建空池并发出事件，不执行 USDC 转账。
- 本次部署 seed 阶段实际 USDC 消耗为 `0`。
- 首笔下注消耗 `500000` raw USDC（0.5 USDC），低于 110 USDC 停止阈值。

## 首笔下注

- 钱包：`0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E`
- 市场：final-1 `marketId = 96`
- outcomeIndex：`0`
- outcome 语义：`home / ARG`
- 金额：`500000` raw USDC（0.5 USDC）
- approve tx：`0xeb3874e15dc062d01976807d1d6b3ef654f17aba6f543e632f9a4588f2ba449c`
- bet tx：`0xa1453b221e50e019253304b68021061b14e7c247f729bca7275a3ffa7883aa0e`
- bet explorer：`https://testnet.arcscan.app/tx/0xa1453b221e50e019253304b68021061b14e7c247f729bca7275a3ffa7883aa0e`
- approve status：`0x1`
- bet status：`0x1`
- 下注前 `outcomePools`：`[0, 0, 0]`
- 下注后 `outcomePools`：`[500000, 0, 0]`
- `stakeByOutcome(96, wallet, 0)`：`500000`
- 下注后自动化钱包 USDC 余额：`14755338` raw USDC（约 14.755338 USDC）

## Owner 验证

| 合约 | `owner()` 读数 | 结果 |
| --- | --- | --- |
| AdminEventOracle | `0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E` | PASS |
| EventMarket | `0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E` | PASS |

## Section 0.7 §worldcup 自检

- specs 完整性：`ai-lens`、`market-category`、`market-sources` 已存在；本次补齐 `worldcup-category` 与 `event-oracle`。
- design 完整性：本次补齐 `openspec/specs/worldcup-category/design.md` 与 `openspec/specs/event-oracle/design.md`。
- delta 合并：`openspec/changes/add-worldcup-category/specs/{worldcup-category,event-oracle}/spec.md` 已转为正式 capability spec，不保留 `ADDED Requirements` delta 头。
- 归档 tasks：10.3、10.3.1、10.3.2、10.3.3、10.3.4、11.3 已完成；10.7 保持 post-archive smoke，不阻塞 archive。
- 孤立 change：归档后以 `openspec list` 验证无活跃 `add-worldcup-category`。

## 下一步：Phase 10.7 post-archive 72h smoke

- 在 final-1 `resolveAfter = 1782243237` 之后，由 owner 对 `eventId = 0x2b902d6a9c3a763f380d5c1af8475ea4efa1142488ebc730dc7c1c8851b061b1` 调用 `proposeResult(..., 0)`（ARG）。
- 等待 72h dispute window。
- 调用 `finalizeResult`。
- 对本次 `marketId = 96`、`outcomeIndex = 0`、`amount = 500000` 的持仓执行 `claim`。
- 将 propose / finalize / claim tx 与 payout 对账追加到本文的 Phase 7c smoke 章节。

## Phase 10.7 Step 1: propose

- propose tx hash: `0xb3111bdd4210dde973778e91957696b3b584cbddf74765d9da77080822e5a1c0`
- propose block number: `48364598`
- propose block timestamp (unix): `1782243314`
- propose block timestamp (UTC ISO): `2026-06-23T19:35:14Z`
- oracle status before: Pending (`0`)
- oracle status after: Proposed (`1`)
- proposed outcome: 0 (ARG / home)
- proposer wallet: `0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E`
- finalize earliest at (UTC ISO): `2026-06-26T19:35:14Z` (= proposeBlockTimestamp + 72h)
- scheduled finalize LaunchAgent run at: `2026-06-26T19:40:14Z` UTC / `2026-06-27T03:40:14+0800` CST
- next steps: 调 `finalizeResult(...)`，再调 `EventMarket.resolve(96)`，然后 `claim(96)` 领取那笔 0.5 USDC。
