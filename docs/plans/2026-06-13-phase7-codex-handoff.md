# Phase 7 端到端验证 — Codex 工单交付文档

> **创建日期**：2026-06-13
> **作者决策**：方案 3（拆 7a/7b/7c）+ 7c 降级为 post-archive 烟雾测试
> **设计者**：Claude Code（决策与设计）
> **执行者**：Codex（实现与广播）
> **关联**：`openspec/changes/add-worldcup-category/`、`docs/plans/2026-06-12-worldcup-category-design.md` 第 503 行 "Phase 7 — 端到端验证"

---

## 0. 上下文

### 0.1 当前状态（截至 2026-06-13）

- `add-worldcup-category` change 在 OpenSpec 中处于 in-progress。
- 合约层 1–2、前端层 3–8、部署脚本 9 已完成（tasks.md 标记 [x]）。
- 已完成 slice：补 final-1 ARG vs FRA 1X2 seed（市场数 97→98，顺序 96=final-1、97=winner），前端 keccak eventId 映射 `0x2b90...61b1 → final-1` 通过 reviewer。
- **未完成**：tasks.md 第 10 节 "灰度发布与验证"（= 本设计文档说的 Phase 7）。

### 0.2 冲突来源

默认 seed 在测试网部署后：
- final-1 kickoff = `block.timestamp + 1天 + 27天23h ≈ 29 天`
- final-1 resolveAfter = kickoff + 150 分钟
- AdminEventOracle 真实异议期 = 72 小时
- ⇒ 完整 finalize/claim 需要 ~29 + 3 = **32 天**，公共测试网不能 warp

### 0.3 决策（已锁定）

**方案 3 + 7c 降级**：

| 档 | 内容 | 完成时机 | 阻塞 archive？ |
|----|------|----------|----------------|
| **7a** | 本地 Anvil 用 `vm.warp` 跑真实 schedule + 真实 72h 异议期的完整 6 步 | 今天 | ✅ 阻塞 |
| **7b** | 测试网部署 + 压缩 final-1 startTime = **deploy + 15 分钟** + 前端首笔下注证据 | 今天 | ✅ 阻塞 |
| **7c** | 测试网 propose → 72h 后 finalize → claim | 73h 后补录 | ❌ **不阻塞**，post-archive smoke |

**决策理由**：
1. Anvil 已用真实 72h dispute window 证明合约层正确性，testnet 重跑 finalize 是验证 RPC，不是验证业务。
2. final-1 startTime = deploy + 15 分钟**不是 spec 偏离**——spec 没规定 startTime 必须等于 2022 真实赛程，只规定 startTime 语义。压缩是 seed 数据选择，不动合约参数。
3. 7c 保留为 task 但不阻塞 archive，避免 73h 等待空窗。

---

## 1. 工单清单（按 Codex 执行顺序）

| # | 工单 | 文件 | 依赖 | 需要人工确认？ |
|---|------|------|------|----------------|
| 1 | 改 tasks.md 第 10 节，拆 7a/7b/7c | `openspec/changes/add-worldcup-category/tasks.md` | 无 | ❌ |
| 2 | 实现 Anvil E2E 脚本 | `contracts/script/Phase7E2E.s.sol` | 1 | ❌ |
| 3 | 跑脚本，产 7a 文档 | `docs/qa/2026-06-13-phase7a-anvil-e2e.md` | 2 | ❌ |
| 4 | 实现测试网部署脚本（含压缩 final-1） | `contracts/script/DeployWorldCupTestnet.s.sol` | 3 通过 | ❌ |
| 5 | 广播测试网 + seed + fund | (链上操作) | 4 | ✅ **你手动确认** |
| 6 | 前端首笔下注 + 截屏 | (UI 操作) | 5 | ❌ |
| 7 | 产 7b 文档 | `docs/qa/2026-06-13-phase7b-testnet-deploy.md` | 6 | ❌ |
| 8 | 73h 后 7c 补录 | 追加到 7b 文档 | 7 + 73h | ✅ **你触发** |

---

## 2. 工单 1 — tasks.md 第 10 节重构

### 2.1 目标

把原 `10.2 灰度开启端到端`、`10.3 冠军盘`、`10.4 三条挑战路径` 重组为 7a/7b/7c 三档。原 10.1/10.5/10.6 保持不变。

### 2.2 修改内容

在 `openspec/changes/add-worldcup-category/tasks.md` 第 10 节，**保留** 10.1（灰度关闭回归）、10.5（移动端，已 [x]）、10.6（API 降级），**替换** 10.2/10.3/10.4 为：

```markdown
- [ ] 10.2 Phase 7a：本地 Anvil 完整 6 步闭环（真实 72h dispute window via vm.warp）
  - [ ] 10.2.1 编写 `contracts/script/Phase7E2E.s.sol`
  - [ ] 10.2.2 Anvil 跑通：deploy → seed 98 → 3 钱包 deposit → final-1 三向下注 → warp 到 kickoff+150min → admin propose ARG → warp +72h → finalize → 3 钱包 claim
  - [ ] 10.2.3 输出 `docs/qa/2026-06-13-phase7a-anvil-e2e.md`：tx hashes、gas、状态读、payout 对账
- [ ] 10.3 Phase 7b：测试网部署 + 首笔下注证据（compressed final-1 startTime = deploy + 15min）
  - [ ] 10.3.1 编写 `contracts/script/DeployWorldCupTestnet.s.sol`（仅 final-1 kickoff 压缩，其余 97 个保持真实赛程偏移）
  - [ ] 10.3.2 广播部署 + seed + USDC fund（人工确认 broadcast）
  - [ ] 10.3.3 前端连接，在 final-1 下一笔小额 ARG 单
  - [ ] 10.3.4 输出 `docs/qa/2026-06-13-phase7b-testnet-deploy.md`：合约地址、tx hash、区块浏览器链接、前端截屏
- [ ] 10.4 三条挑战路径验证（在 7a Anvil 环境内联补充，复用 6 步框架）
  - [ ] 10.4.1 owner 撤销路径
  - [ ] 10.4.2 owner 驳回路径
  - [ ] 10.4.3 owner 不响应（finalizeOnTimeout）路径
- [ ] 10.7 Phase 7c（post-archive smoke，不阻塞 archive）：测试网 finalize/claim
  - [ ] 10.7.1 propose outcome=ARG via AdminEventOracle 测试网
  - [ ] 10.7.2 等待 72h dispute window 过
  - [ ] 10.7.3 调 finalize
  - [ ] 10.7.4 claim 7b 那笔下注
  - [ ] 10.7.5 追加 "Phase 7c smoke" 章节到 7b 文档
```

### 2.3 DoD 关单规则

在 tasks.md 第 10 节顶部追加一行说明：

```markdown
> **DoD 关单规则**：10.1 + 10.2 + 10.3 + 10.4 + 10.5 + 10.6 全部 [x] → Phase 7 主线 DoD 达成 → change 可 archive。10.7 不阻塞 archive，由部署后 73h 单独补录。
```

### 2.4 验证

```bash
openspec validate add-worldcup-category --strict --no-interactive
```

---

## 3. 工单 2 — Phase7E2E.s.sol（Anvil 完整 6 步）

### 3.1 文件位置

`contracts/script/Phase7E2E.s.sol`

### 3.2 关键参数

- **schedule**：真实赛程（复用现有 `worldcup-seed.json`，首场 kickoff = `block.timestamp + 1 天`）
- **disputeWindow**：72 小时（AdminEventOracle 默认，不改）
- **resolveAfter**：150 分钟（EventMarket 默认）
- **测试钱包**：3 个（ALICE / BOB / CHARLIE），每个 fund 10000 mock USDC
- **下注金额**：每人 100 mock USDC，分别买 final-1 的 outcome 0 (ARG) / 1 (Draw) / 2 (FRA)
- **预期结果**：outcome 0 = ARG 胜

### 3.3 6 步骤详细规格

#### Step 1：部署
- 部署 MockERC20（symbol="mUSDC", decimals=6）
- 部署 `AdminEventOracle`，`owner = msg.sender`，`disputeWindow = 72 hours`，`challengeStake = 100e6`
- 部署 `EventMarket`，`owner = msg.sender`，`oracle = oracleAddr`，`collateralToken = mUSDC`

**断言**：
- `oracle.disputeWindow() == 72 hours`
- `market.ORACLE() == oracleAddr`（immutable public state var，无 getter 函数名）
- `market.USDC() == mUSDCAddr`（同上）

**console.log**：3 个合约地址

#### Step 2：Seed 98 markets
- 调用 `SeedWorldCupMarketsScript.run()` 或 inline 复用其逻辑（推荐 inline 复用 `_createGroupMarkets / _createFinal1x2Market / _createWinnerMarket`，避免脚本嵌套）
- 验证市场总数 = 96 (group 48×2) + 1 (final 1X2) + 1 (winner) = 98
- final-1 marketId 获取：**不存在 `getMarketByEventId`**。可选方案：
  - (a) 解析 `MarketCreated` 事件 logs 找 eventId 匹配项的 id
  - (b) 用 `getMarketsPaged(0, marketCount())` 扫描比对 eventId
  - (c) 按 seed 顺序固定（第 97 个市场，0-indexed = 96 / 1-indexed 取决于 marketCount 起始）
  - 推荐 (a) 或 (b)，避免硬编码顺序

**断言**：
- `market.marketCount() == 98`
- final-1 eventId = `keccak256(abi.encodePacked("worldcup:", "1x2", ":", "final-1"))` = **`0x2b90...61b1`**（与前端 keccak 映射一致）
- 通过上述方案找到的 final-1 `market.getMarket(id).outcomeCount == 3`
- final-1 `market.getMarket(id).resolveAfter` 接近 `block.timestamp + 1 day + 27 days 23 hours + 150 minutes`（按 seed 默认 `firstKickoffDelay=1 day` 推算，误差 < 1 小时）

**console.log**：final-1 eventId、startTime、resolveAfter

#### Step 3：3 钱包 fund + deposit
- ALICE、BOB、CHARLIE 用 `vm.addr(1)/(2)/(3)` 派生
- mUSDC mint 10000e6 给每个
- 每个 `vm.prank` → `mUSDC.approve(market, type(uint256).max)`

**断言**：
- 每个钱包 mUSDC balance == 10000e6

#### Step 4：final-1 三向下注
- 找到 final-1 的 marketId（通过 eventId 查询）
- ALICE `vm.prank` → `market.bet(marketId, 0, 100e6)`（买 ARG）
- BOB → `market.bet(marketId, 1, 100e6)`（买 Draw）
- CHARLIE → `market.bet(marketId, 2, 100e6)`（买 FRA）

**断言**：
- 三个钱包 mUSDC balance 各减少 100e6
- `market.stakeByOutcome(marketId, ALICE, 0) == 100e6`
- `market.stakeByOutcome(marketId, BOB, 1) == 100e6`
- `market.stakeByOutcome(marketId, CHARLIE, 2) == 100e6`
- 或用 `market.userStake(marketId, wallet)` 返回的数组验证

**console.log**：每笔下注金额、当前 market 三 outcome 累积 stake

#### Step 5：warp 到 resolve 时间 + admin propose
- `vm.warp(final-1.startTime + 150 minutes + 1)`
- `vm.prank(owner)` → `oracle.proposeResult(final-1.eventId, 0)`（outcome 0 = ARG）

**断言**：
- `oracle.getEventStatus(eventId) == Proposed`
- `oracle.getProposedResult(eventId) == 0`

**console.log**：proposal tx 块号、状态

#### Step 6：warp 72h → finalize → claim
- `vm.warp(block.timestamp + 72 hours + 1)`
- 任意人调 `oracle.finalizeOnTimeout(eventId)` 或调 `market.resolve(marketId)`（要看你的合约实际接口；按 EventMarketE2E.t.sol 现有用法走）
- ALICE / BOB / CHARLIE 各自 `vm.prank` → `market.claim(marketId)`

**断言**（按 EventMarket.sol L286-296 当前 fee 数学：`protocolFee = losingPool × feeBpsSnapshot / 10_000`，默认 `feeBps = 100` = 1%）：
- `oracle.getEventStatus(eventId) == Finalized`
- `oracle.getResult(eventId) == 0`
- 关键数值：totalPool = 300e6、winningPool = 100e6（仅 ALICE）、losingPool = 200e6、protocolFee = 200e6 × 100 / 10000 = **2e6**、ALICE payout = stake + (losingPool - fee) = 100e6 + 198e6 = **298e6**
- ALICE 最终 mUSDC balance = 10000e6 - 100e6 + 298e6 = **10198e6**（净盈亏 **+198e6**）
- BOB 最终 mUSDC balance == 9900e6（输了，0 payout）
- CHARLIE 最终 mUSDC balance == 9900e6（输了，0 payout）
- feeRecipient 收到 2e6 mUSDC
- 守恒检查：ALICE 净赚 198 + protocol fee 2 = 200 = BOB + CHARLIE 损失 ✅

**console.log**：每个钱包的最终 balance、净盈亏、ALICE payout 金额（应为 298e6）、protocolFee 金额（应为 2e6）

### 3.4 验证命令

```bash
cd contracts
forge script script/Phase7E2E.s.sol --rpc-url http://localhost:8545 -vvv
forge fmt --check script/Phase7E2E.s.sol
```

期望：脚本退出码 0，所有 console.log 输出可读。

**重要**：此工单是 **forge script 模拟执行**（依赖 `vm.warp` / `vm.prank` cheatcode），**不是 broadcast**，因此**不会产生真实链上 tx hash**。证据基础是：exit code 0 + 所有 assert 通过 + console.log 关键状态可读 + 守恒检查通过。`--broadcast` 在此工单不适用（warp/prank 不会传到 Anvil RPC）。真实 tx hash 出现在工单 5（DeployWorldCupTestnet 测试网 broadcast）。

### 3.5 复用现有代码

- 优先调用 `SeedWorldCupMarketsScript` 的 internal 方法（如可见性允许），不可见则复制最小必要代码
- 不要修改 `SeedWorldCupMarketsScript.sol`、`EventMarket.sol`、`AdminEventOracle.sol`

---

## 4. 工单 3 — Phase 7a 验证文档

### 4.1 文件位置

`docs/qa/2026-06-13-phase7a-anvil-e2e.md`

### 4.2 必填章节

```markdown
# Phase 7a — Anvil 端到端验证报告

## 环境
- 日期：2026-06-13
- Anvil 版本：<output of `anvil --version`>
- Foundry 版本：<output of `forge --version`>
- chainId：31337
- 执行模式：**forge script 模拟（dry-run）**，使用 `vm.warp` / `vm.prank` cheatcode。**非 broadcast**，因此 tx hash 列填 N/A，证据基础是 exit 0 + 所有 assert 通过 + console.log 关键状态可读 + 守恒检查通过。

## 部署地址（模拟，仅本次 forge 进程内有效）
| 合约 | 地址（forge 模拟） |
|------|------|
| MockERC20 (mUSDC) | 0x... |
| AdminEventOracle | 0x... |
| EventMarket | 0x... |

## 6 步执行轨迹

### Step 1 部署
- 结果：disputeWindow=72h ✅、ORACLE() 绑定 oracleAddr ✅、USDC() 绑定 mUSDCAddr ✅
- gas（forge -vvv 估算）：<amount> 或 N/A

### Step 2 Seed 98 markets
- tx 数：100（98 createMarket + 2 oracle register）
- final-1 eventId: 0x2b90...61b1
- final-1 startTime: <unix> (= block.timestamp + 1d + 27d23h)
- 断言：marketCount=98 ✅

### Step 3 fund + deposit
| 钱包 | mUSDC 初始 | 备注 |
|------|-----------|------|
| ALICE | 10000.000000 | 已 approve |
| BOB | 10000.000000 | 已 approve |
| CHARLIE | 10000.000000 | 已 approve |

### Step 4 final-1 三向下注
| 钱包 | outcome | 金额 (mUSDC) | stakeByOutcome 写入 | tx hash |
|------|---------|------|-------------|---------|
| ALICE | 0 (ARG) | 100 | 100e6 | N/A (forge simulate) |
| BOB | 1 (Draw) | 100 | 100e6 | N/A (forge simulate) |
| CHARLIE | 2 (FRA) | 100 | 100e6 | N/A (forge simulate) |

### Step 5 propose
- warp 到：<unix> (final-1.startTime + 150min)
- propose tx：0x...
- oracle 状态：Proposed
- proposed outcome：0 (ARG)

### Step 6 finalize + claim
- warp 到：<unix> (Step 5 + 72h + 1s)
- finalize tx：0x...
- oracle 状态：Finalized
- final result：0 (ARG)

| 钱包 | 最终 mUSDC balance | 净盈亏 | claim tx |
|------|-------------------|--------|----------|
| ALICE | <amount> | +<X> | 0x... |
| BOB | 9900.000000 | -100 | 0x... |
| CHARLIE | 9900.000000 | -100 | 0x... |

## Payout 对账（基于 EventMarket.sol 当前 fee 数学）
- 总下注：300 mUSDC（三人各 100）
- 获胜 outcome (ARG=0) winningPool：100 mUSDC（仅 ALICE）
- 失败 outcome (Draw+FRA) losingPool：200 mUSDC
- feeBpsSnapshot：100（= 1%）
- protocolFee = losingPool × 100 / 10000 = **2 mUSDC**
- ALICE payout = 自身 stake (100) + (losingPool - fee) (198) = **298 mUSDC**
- ALICE 净盈亏 = +198 mUSDC
- 实际 ALICE balance：<X> mUSDC（预期 10198 mUSDC）
- 实际 feeRecipient balance：<Y> mUSDC（预期 2 mUSDC）
- 守恒检查：ALICE 净 +198 + protocolFee 2 = 200 = BOB + CHARLIE 损失（各 100）✅

## 结论
✅ Phase 7a DoD 达成：合约层在真实 72h 异议期下闭环正确，fee 数学守恒。
```

### 4.3 验证门禁

- 文档手工 review 三点：6 步顺序、断言数值、payout 对账数学正确

---

## 5. 工单 4 — DeployWorldCupTestnet.s.sol

### 5.1 文件位置

`contracts/script/DeployWorldCupTestnet.s.sol`

### 5.2 与 `DeployWorldCup.s.sol` 的区别

| 项 | DeployWorldCup（现有） | DeployWorldCupTestnet（新） |
|----|----------------------|---------------------------|
| oracle 部署 | ✅ | ✅（同参数，72h） |
| market 部署 | ✅ | ✅ |
| seed 数据 | 全部 98，按真实赛程偏移 | 全部 98，**final-1 单独压缩至 deploy + 15 min** |
| broadcast | `vm.broadcast` | `vm.broadcast` |
| 输出 | console.log 地址 | console.log 地址 + final-1 eventId + final-1 startTime（人类可读时间戳） |

### 5.3 final-1 压缩实现

读 `worldcup-seed.json`，但在调 `_createFinal1x2Market` 等价逻辑之前，**手动覆盖** `seed.finalKickoffTime` 为：

```solidity
uint256 testnetFinalKickoff = block.timestamp + 15 minutes;
// 注意：_normalizedKickoff 会把它再次按 first kickoff offset 平移
// 所以正确做法是：跳过 _normalizedKickoff，直接传 testnetFinalKickoff 作为 kickoff 给 EventMarket.createMarket
```

**实现建议**：
- 不调用现有 `_normalizedKickoff` 处理 final
- 直接：`kickoff = uint64(block.timestamp + 15 minutes)`、`betDeadline = kickoff - BET_DEADLINE_OFFSET`、`resolveAfter = kickoff + 150 minutes`
- group + winner 仍走原 `_normalizedKickoff`（真实赛程偏移）

### 5.4 环境变量

复用 `DeployWorldCup.s.sol` 模式：
- `OWNER_PRIVATE_KEY`：签名钥
- `RPC_URL`：测试网 RPC
- `USDC_ADDRESS`：测试网 USDC（如 Sepolia 上的 mock USDC）

### 5.5 写回地址

部署完成后，Codex **不要**自动改 `web/lib/addresses.ts`——由你人工确认后手动写回，避免广播错误地址被前端意外使用。

### 5.6 验证

```bash
cd contracts
forge build script/DeployWorldCupTestnet.s.sol
forge fmt --check script/DeployWorldCupTestnet.s.sol
# 干跑（不广播）
forge script script/DeployWorldCupTestnet.s.sol --rpc-url <testnet-rpc>
```

---

## 6. 工单 5 — 测试网广播（人工确认）

### 6.1 流程（Codex 准备命令，你执行）

Codex 输出一份"执行清单"：

```bash
# 1. 确认 .env 里 OWNER_PRIVATE_KEY 是测试网专用钱包
# 2. 确认 RPC 指向预期测试网（Sepolia / Base Sepolia / ...）
# 3. 干跑确认 gas
forge script contracts/script/DeployWorldCupTestnet.s.sol --rpc-url $RPC_URL

# 4. 广播（用户确认后执行）
forge script contracts/script/DeployWorldCupTestnet.s.sol --rpc-url $RPC_URL --broadcast --verify

# 5. 给测试钱包 fund USDC（数额：每人 1000，至少 2 个钱包）
cast send $USDC_ADDRESS "transfer(address,uint256)" $WALLET_A 1000000000 --rpc-url $RPC_URL --private-key $FUND_KEY
cast send $USDC_ADDRESS "transfer(address,uint256)" $WALLET_B 1000000000 --rpc-url $RPC_URL --private-key $FUND_KEY
```

### 6.2 你的人工确认点

- ✅ 私钥是测试网专用
- ✅ RPC 是预期网络
- ✅ gas 估算合理
- ✅ broadcast 后所有 tx 上链

---

## 7. 工单 6 — 前端首笔下注

### 7.1 步骤

1. Codex 更新 `web/lib/addresses.ts`（你确认后）写入测试网新地址
2. `pnpm --dir web dev`
3. 钱包连接测试网
4. 进入 World Cup Tab → final-1 详情页
5. 验证：final-1 显示为 ARG vs FRA，倒计时 15 分钟内
6. 下注：100 mUSDC 买 ARG
7. 截屏：首页、final-1 详情页、下注 confirm、tx 成功

### 7.2 截屏目录

`docs/qa/screenshots/worldcup/2026-06-13-phase7b/`

---

## 8. 工单 7 — Phase 7b 验证文档

### 8.1 文件位置

`docs/qa/2026-06-13-phase7b-testnet-deploy.md`

### 8.2 必填章节

```markdown
# Phase 7b — 测试网部署 + 首笔下注证据

## 环境
- 测试网：<Sepolia / Base Sepolia / ...>
- chainId：<id>
- 部署时间：<unix> (<human-readable>)
- final-1 startTime：deploy + 15min = <unix> (<human-readable>)

## 部署地址表
| 合约 | 地址 | 区块浏览器 |
|------|------|-----------|
| USDC | 0x... | <link> |
| AdminEventOracle | 0x... | <link> |
| EventMarket | 0x... | <link> |

## Seed tx hash 表
| 操作 | tx hash | 块号 | gas |
|------|---------|------|-----|
| createMarket final-1 | 0x... | ... | ... |
| createMarket winner | 0x... | ... | ... |
| createMarket group-1 | 0x... | ... | ... |
| ...（共 98 条） | | | |

## 首笔下注证据
- 钱包：<address>
- final-1 marketId：<id>
- outcome：0 (ARG)
- 金额：100 mUSDC
- tx hash：0x...
- 区块浏览器：<link>

## 前端截屏
- 首页 World Cup Tab: ![](screenshots/worldcup/2026-06-13-phase7b/01-home.png)
- final-1 详情页: ![](screenshots/worldcup/2026-06-13-phase7b/02-detail.png)
- 下注确认: ![](screenshots/worldcup/2026-06-13-phase7b/03-confirm.png)
- 下注成功: ![](screenshots/worldcup/2026-06-13-phase7b/04-success.png)

## 结论
✅ Phase 7b DoD 达成：合约可部署、可被前端识别、可接受真实下注。

## Phase 7c smoke（73h 后追加）
（待补录）
```

---

## 9. 工单 8 — Phase 7c 补录（73h 后）

### 9.1 触发时机

7b 广播时间 + 15 分钟（final-1 kickoff） + 150 分钟（resolveAfter） + 72 小时（dispute window） + 1 分钟 buffer
≈ **74 小时 26 分钟后**

简化：**73 小时后**开始 propose，再等 72h finalize。即 7b 部署后约 **6 天**完成 7c。

> 更紧凑：propose 可以在 kickoff + 150min（部署后 ~2.75 小时）就触发，然后等 72h finalize。
> 即：部署后 ~2.75h 调 propose，再过 72h 调 finalize。总耗时 ~75 小时。
> Codex 用 `/schedule` 或 cron 排两个时间点。

### 9.2 步骤

1. T = 部署 + 2h45min：admin propose `eventId=0x2b90...61b1, outcome=0 (ARG)`
2. T = 部署 + 2h45min + 72h：调 `oracle.finalizeOnTimeout` 或 `market.resolve`
3. T 之后：7b 那个钱包 claim
4. 追加到 7b 文档底部 "Phase 7c smoke" 章节

### 9.3 补录内容

```markdown
## Phase 7c smoke（追加）

- propose tx：0x...（时间：<unix>）
- finalize tx：0x...（时间：<unix>）
- claim tx：0x...（时间：<unix>）
- 钱包 7b 起始 USDC：1000
- 钱包 7c 结束 USDC：<amount>
- 净盈亏：<delta>
- 预期盈亏：+200（100 本金回收 + BOB/CHARLIE 资金，因为只有 ALICE 一人下注？）
  - **若 7b 只下了一笔**：finalize 后 ALICE 取回全部 100 + 没有对手盘
  - **若 7b 三个钱包都下了**：按 AMM 数学算
- 数学对账：<pass/fail + 说明>

### 结论
✅ / ❌ Phase 7c smoke <通过/失败>
```

---

## 10. 风险与降级

| 风险 | 缓解 |
|------|------|
| Anvil 跑 6 步过程中断言失败 | Codex 必须输出失败的具体断言 + 当时状态，不许吞错继续 |
| 测试网 USDC 不够 fund | 用 testnet faucet 先 fund OWNER 钱包，再让 OWNER 转给测试钱包 |
| 测试网 broadcast 失败 | 不要重试同一个 nonce；查询 tx 状态后决定是 rebroadcast 还是新 nonce |
| 前端连接不到 final-1 | 先用 `cast call` 验证 `market.getMarketByEventId(0x2b90...61b1)` 返回有效，再排查前端 |
| 7c 时 admin 错过 propose 窗口 | Phase 7c 是 smoke，失败不影响 archive；记录失败原因到文档即可 |

---

## 11. 验证门禁汇总

| 阶段 | 验证命令 | 期望 |
|------|---------|------|
| 工单 1 后 | `openspec validate add-worldcup-category --strict --no-interactive` | ✅ |
| 工单 2 后 | `forge fmt --check contracts/script/Phase7E2E.s.sol`、`forge build` | ✅ |
| 工单 3 后 | `forge script contracts/script/Phase7E2E.s.sol --rpc-url http://localhost:8545 -vvv` | exit 0，无 revert |
| 工单 3 后 | 手工 review `docs/qa/2026-06-13-phase7a-anvil-e2e.md` | 6 步完整、数学对账正确 |
| 工单 4 后 | `forge build`、`forge fmt --check` | ✅ |
| 工单 4 后 | `forge script DeployWorldCupTestnet.s.sol --rpc-url <testnet>`（干跑） | exit 0 |
| 工单 5 后 | 区块浏览器查 oracle / market / USDC 合约可见 | ✅ |
| 工单 6 后 | 前端下注 tx 成功 | ✅ |
| 工单 7 后 | 手工 review 7b 文档 | 地址、tx、截屏齐全 |
| 工单 8 后 | 7b 文档底部 7c smoke 章节齐全 | ✅ |

---

## 12. 时间盒预算（参考）

- 工单 1 + 2 + 3 + 7a 文档：**3 小时**
- 工单 4 + 干跑：**1 小时**
- 工单 5 广播（人工确认 + 等待 tx 上链）：**30 分钟**
- 工单 6 前端下注 + 截屏：**30 分钟**
- 工单 7 文档：**30 分钟**
- 主线总计：**~5.5 小时**
- 工单 8（7c）：异步，自动触发，5 分钟人工操作

---

## 13. Codex 起手必读

1. 先读本文档全文
2. 再读 `openspec/changes/add-worldcup-category/tasks.md`、`design.md`、`proposal.md`
3. 再读 `contracts/script/SeedWorldCupMarkets.s.sol`（Phase7E2E 要复用其逻辑）
4. 再读 `contracts/test/EventMarketE2E.t.sol`（了解 6 步在测试里的写法）
5. 再读 `contracts/script/DeployWorldCup.s.sol`（DeployWorldCupTestnet 的基线）
6. 任何不确定，**先停下问 user**，不要自行选择。

---

## 14. 决策追溯

- 2026-06-13 user prompt：方案三选一（严格测试网 / 快速跑通 / 本地完整+测试网部分）
- 决策：方案 3（本地完整 + 测试网部分），final-1 startTime 压缩到 deploy + 15 分钟
- 后续优化：7c 降级为 post-archive smoke，不阻塞 archive
- 关键约束：不动 spec、不动合约参数、只调 seed 数据时间戳
- 用户人工确认门：测试网 broadcast（工单 5）+ 7c 触发（工单 8）

### 2026-06-13 勘误（Codex stop-and-ask 触发）

Codex 在工单 2 启动前对照实际合约发现 3 处文档与现实不符，已修正：

1. **接口名**（§3.3 Step 1）：`market.oracle()` → `market.ORACLE()`，`market.collateralToken()` → `market.USDC()`（均为 immutable public state var）
2. **eventId 派生**（§3.3 Step 2）：原写 `keccak256(abi.encodePacked("1x2", "final-1"))`，实际是 `keccak256(abi.encodePacked("worldcup:", "1x2", ":", "final-1"))` = `0x2b90...61b1`
3. **查询接口**（§3.3 Step 2 & 4）：不存在 `getMarketByEventId` / `getPosition`，改用 `MarketCreated` 事件 / `getMarketsPaged` 扫描 / `stakeByOutcome` mapping / `userStake` view
4. **payout 数学**（§3.3 Step 6 & §4）：原写 ALICE payout = 300，未考虑 `feeBps=100`（1%）。实际 protocolFee = 200 × 100 / 10000 = 2 mUSDC，ALICE payout = 298 mUSDC，净盈亏 +198

这些修正不改变 7a/7b/7c 三档拆分、不动合约、不动 spec。
