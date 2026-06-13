# Phase 7a — Anvil 端到端验证报告

## 环境

- 日期：2026-06-13
- Anvil 版本：`anvil Version: 1.5.1-stable`，Commit `b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2`，Build Timestamp `2025-12-22T11:41:09.812070000Z (1766403669)`，Build Profile `maxperf`
- Foundry/Forge 版本：`forge Version: 1.5.1-stable`，Commit `b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2`，Build Timestamp `2025-12-22T11:41:09.812070000Z (1766403669)`，Build Profile `maxperf`
- chainId：`31337`
- 执行命令：`forge script script/Phase7E2E.s.sol --rpc-url http://localhost:8545 -vvv`
- 运行结果：exit `0`，`Script ran successfully.`
- 执行模式：`forge script` dry-run，使用 `vm.warp` 与 `vm.prank` cheatcode，未 broadcast，因此本文 tx hash 与 gas 统一记为 `N/A（forge script dry-run，未 broadcast）`
- 抵押资产说明：脚本部署本地 6 decimals `MockUSDC`，本文按 Phase 7 模板称为 `mUSDC` mock collateral。

## 部署地址（模拟，仅本次 forge 进程内有效）

| 合约 | 地址（forge 模拟） |
|------|--------------------|
| MockERC20 (mUSDC) | `0x5aAdFB43eF8dAF45DD80F4676345b7676f1D70e3` |
| AdminEventOracle | `0xf13D09eD3cbdD1C930d4de74808de1f33B6b3D4f` |
| EventMarket | `0x5c4a3C2CD1ffE6aAfDF62b64bb3E620C696c832E` |

## 6 步执行轨迹

### Step 1 部署

- 结果：`disputeWindow=72h`、`ORACLE()` 绑定 `oracleAddr`、`USDC()` 绑定 `mUSDCAddr`，相关断言均通过
- tx hash：`N/A（forge script dry-run，未 broadcast）`
- gas：`N/A（forge script dry-run，未 broadcast）`

### Step 2 Seed 98 markets

- tx 数：`N/A（forge script dry-run，未 broadcast）`
- seed 记录：`98` 次 `createMarket` 调用，`0` 次 oracle register
- final-1 marketId：`96`
- final-1 eventId：`0x2b902d6a9c3a763f380d5c1af8475ea4efa1142488ebc730dc7c1c8851b061b1`
- final-1 startTime：`1783844617`（`block.timestamp + 1d + 27d23h`）
- final-1 resolveAfter：`1783853617`
- 断言：`marketCount=98`、`final-1 outcomeCount=3`，相关断言均通过

### Step 3 fund + deposit

| 钱包 | mUSDC 初始 | 备注 |
|------|-----------|------|
| ALICE | `10000.000000` | 地址 `0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf`，approve 已完成 |
| BOB | `10000.000000` | 地址 `0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF`，approve 已完成 |
| CHARLIE | `10000.000000` | 地址 `0x6813Eb9362372EEF6200f3b1dbC3f819671cBA69`，approve 已完成 |

### Step 4 final-1 三向下注

| 钱包 | outcome | 金额 (mUSDC) | stakeByOutcome 写入 | tx hash |
|------|---------|--------------|---------------------|---------|
| ALICE | `0 (ARG)` | `100` | `100.000000` | `N/A（forge script dry-run，未 broadcast）` |
| BOB | `1 (Draw)` | `100` | `100.000000` | `N/A（forge script dry-run，未 broadcast）` |
| CHARLIE | `2 (FRA)` | `100` | `100.000000` | `N/A（forge script dry-run，未 broadcast）` |

- outcomePools：`outcome0=100000000`、`outcome1=100000000`、`outcome2=100000000`
- 断言：`stakeByOutcome` 与 `userStake` 读数一致，三人下注后余额均为 `9900.000000`

### Step 5 propose

- propose 时间：`1783853618`
- propose tx：`N/A（forge script dry-run，未 broadcast）`
- oracle 状态：`Proposed`（enum `1`）
- proposed outcome：`0 (ARG)`

### Step 6 finalize + claim

- finalize 时间：`1784112819`
- finalize tx：`N/A（forge script dry-run，未 broadcast）`
- oracle 状态：`Finalized`（enum `3`）
- final result：`0 (ARG)`

| 钱包 | 最终 mUSDC balance | 净盈亏 | claim tx |
|------|-------------------|--------|----------|
| ALICE | `10198.000000` | `+198.000000` | `N/A（forge script dry-run，未 broadcast）` |
| BOB | `9900.000000` | `-100.000000` | `N/A（loser claim 按当前 EventMarket.NotAWinner 预期 revert，未产生 payout）` |
| CHARLIE | `9900.000000` | `-100.000000` | `N/A（loser claim 按当前 EventMarket.NotAWinner 预期 revert，未产生 payout）` |

- `feeRecipient balance = 2.000000`
- `total pool = 300.000000`
- `winning pool = 100.000000`
- `losing pool = 200.000000`
- `ALICE payout = 298.000000`
- `protocol fee = 2.000000`
- `market remaining balance = 0.000000`
- `conservation lhs/rhs = 200.000000`

## Payout 对账（基于当前 EventMarket fee 数学）

- 总下注：`300.000000 mUSDC`
- 获胜池：`100.000000 mUSDC`
- 失败池：`200.000000 mUSDC`
- 协议费：`2.000000 mUSDC`
- ALICE outcome 0 shares 占 outcome 0 总 shares 比例：`100%`
- 预期 ALICE payout：`298.000000 mUSDC`
- 实际 ALICE payout：`298.000000 mUSDC`
- 差值：`0.000000 mUSDC`
- ALICE final balance：`10198.000000 mUSDC`
- BOB final balance：`9900.000000 mUSDC`
- CHARLIE final balance：`9900.000000 mUSDC`
- market remaining balance：`0.000000 mUSDC`
- 守恒对账：`ALICE 净赚 198.000000 + protocol fee 2.000000 = 200.000000`，与 `BOB 亏损 100.000000 + CHARLIE 亏损 100.000000 = 200.000000` 一致

## 现实偏差与实现说明

- 当前 `EventMarket` 没有 `getMarketByEventId` 与 `getPosition`；脚本通过 `getMarketsPaged` 扫描 final-1，并通过 `stakeByOutcome` 与 `userStake` 完成持仓断言。
- 当前 `forge script` 为 dry-run，没有真实 tx hash；因此文中 tx hash 与 gas 统一写为 `N/A（forge script dry-run，未 broadcast）`。
- 当前合约没有 oracle register；因此 seed 记录为 `98` 次 `createMarket` 调用、`0` 次 oracle register。

## 结论

- 6 步顺序、关键断言数值与 payout 对账数学已按本次 dry-run 结果落盘。
- 本工单只更新 Phase 7a 文档，未触碰脚本、测试网流程或 7b 文档范围。
- ✅ Phase 7a DoD 达成：合约层在真实 72h 异议期下闭环正确，AMM 数学与协议费守恒。
