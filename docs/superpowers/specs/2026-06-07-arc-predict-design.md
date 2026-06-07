# ArcPredict 设计文档 v1

> **日期**：2026-06-07
> **状态**：草案，待用户审阅
> **基础**：与用户 brainstorming 对齐 + 双 codex 并行评审 + Arc testnet 烫手验证
> **下一步**：用户审阅 → writing-plans 输出实现计划 → 交付 codex 实现

---

## 1. 背景与定位

### 1.1 项目目标

基于 **Circle Arc testnet** 构建一个**最小可用的去中心化预测市场网站**。

定位：**支持真实用户使用 testnet USDC 真实下注**。不是 demo，不是平台。

### 1.2 不是什么

- ❌ 不是 Polymarket 复刻（不做 AMM、不做仓位转让）
- ❌ 不是纯演示（必须在 Arc testnet 真实环境跑通，真实用户能用）
- ❌ 不是开放平台（不做"任何人可创建市场"）

### 1.3 关键事实（已烫手验证）

| 项 | 值 | 验证方式 |
|---|---|---|
| chainId | 5042002 (0x4cef52) | `eth_chainId` RPC 调用 |
| RPC | `https://rpc.testnet.arc.network` | 实测可用 |
| Explorer | `https://testnet.arcscan.app` | docs |
| USDC ERC-20 facade | `0x3600000000000000000000000000000000000000` | docs + RPC |
| USDC ERC-20 decimals | **6** | `cast call decimals()` 验证为 0x06 |
| USDC native (msg.value) decimals | **18** | docs 明确，"behave like ETH" |
| Faucet | `https://faucet.circle.com` | docs |

⚠️ Arc 官方对 DeFi 协议的明确建议："Use only the ERC-20 interface (6 decimals)"。本项目遵守此建议。

---

## 2. 关键决策摘要

| 维度 | 决策 | 选择理由 |
|---|---|---|
| 市场类型 | 价格类二元（"BTC/USD ≥ X @ T"） | 可自动结算，无信任需求 |
| 赔付机制 | parimutuel 平分池 | 合约最简，资金永远平衡 |
| 创建权限 | owner-only | 防垃圾市场，MVP 范围 |
| 资金路径 | ERC-20 `transferFrom` (USDC) | Arc 官方建议 + 标准 |
| 单位 | 6 decimals (ERC-20) | 与全球 USDC 对齐 |
| Oracle | Pyth Core (pull) | Arc testnet 已确认；Chainlink Data Feeds 在 Arc testnet 无公开证据 |
| 后端 | 无 | MVP 最小化 |
| 合约 | Solidity 0.8.24 + Foundry | 主流 + 测试快 |
| 前端 | Next.js 14 App Router + wagmi v2 + viem + RainbowKit + Tailwind | Vercel 一键部署 |
| 视觉 | 见 `mockups/preview.html` | Polymarket-ish 金融质感 + 暖橙品牌点缀 |

---

## 3. § 1 架构

### 3.1 系统分层

```
┌────────────────────────────────────────────────────────┐
│  浏览器（Next.js 14 SPA，部署在 Vercel）                 │
│  • RainbowKit + wagmi v2 + viem                        │
│  • 钱包：MetaMask / WalletConnect / Coinbase           │
│  • 读链：Multicall3 批量聚合 markets / stakes          │
│  • 写链：approve / bet / resolve / claim               │
└──────────────┬─────────────────────────────────────────┘
               │ JSON-RPC over HTTPS
               ▼
┌────────────────────────────────────────────────────────┐
│  Arc Testnet (chainId 5042002)                         │
│                                                        │
│  PredictionMarket.sol  ← 唯一项目合约                  │
│    state: markets / stakes / claimed / fee config      │
│    admin: createMarket / setFeeBps / setFeeRecipient   │
│    user:  bet(id, side, amount)                        │
│    user:  resolve(id, priceUpdate) — 任何人可调        │
│    user:  claim(id)                                    │
│                                                        │
│  外部依赖（具体地址见 §6.4 部署清单）：                 │
│   • USDC ERC-20 facade: 0x3600... ✓ 已验证             │
│   • Pyth contract: 待 cast 验证（Arc testnet 部署地址） │
│   • Multicall3: 0xcA11... (标准地址，待 cast 验证)      │
└────────────────────────────────────────────────────────┘
```

### 3.2 关键架构决策

1. **无后端**。所有状态从合约读，无 subgraph 也无事件索引。代价：用户仓位枚举受限——通过**硬上限 100 个 active markets** 控制。
2. **ERC-20 USDC 路径**。用户首次下注前 approve 一次（建议 `max`），后续 bet / claim 不需要 approve。**所有数学按 6 decimals**。
3. **Pyth 作为唯一 oracle**。pull 模式，resolve 时调用方需附带 `priceUpdate` payload 和 update fee（native ETH 等价值，msg.value 18 decimals 计）。
4. **公开 resolve**。`resolve()` 无 onlyOwner，任何人都可触发，避免管理员卡结算。

### 3.3 范围与边界

| 维度 | 边界 |
|---|---|
| 同时存在的 active markets | 硬上限 **100** |
| 单注最小金额 | **0.1 USDC** |
| 单注最大金额 | 不限（合约 uint128 上限远超实际） |
| 平台费率 | 默认 1%，上限 5%（仅对新创建市场生效） |
| Bet 历史保留 | 依赖 RPC log retention，**3 个月以上不保证** |
| 移动端 | 响应式 web 页面可用，**不做原生 App** |
| 国际化 | UI 文本中文为主（英文作为标识），**不做 locale 切换** |

---

## 4. § 2 合约设计

### 4.1 状态

```solidity
enum Outcome { Unresolved, Yes, No, Invalid }

struct Market {
    bytes32 pythPriceId;       // Pyth price feed ID（不是 EVM 地址）
    int64   threshold;         // 按 Pyth feed 的 expo 缩放（例如 BTC ≥ 70000 → 70000e8 with expo=-8）
    int32   thresholdExpo;     // threshold 的指数（用于与 Pyth price.expo 对齐）
    uint64  betDeadline;       // 截止下注时间戳
    uint64  resolveAfter;      // 最早可结算时间戳
    uint128 yesPool;           // 累计 YES 下注（USDC 6 decimals）
    uint128 noPool;            // 累计 NO 下注
    uint128 winnerPool;        // resolve 时锁定，claim 用
    uint128 protocolFee;       // resolve 时计算，立即转 feeRecipient
    uint16  feeBpsSnapshot;    // 创建时快照费率
    Outcome outcome;
    int64   settlePrice;       // resolve 时记录
    uint64  settleTime;        // resolve 时记录的 Pyth publishTime
    string  question;          // 展示用文本
}

mapping(uint256 => Market) public markets;
mapping(uint256 => mapping(address => uint128)) public yesStake;
mapping(uint256 => mapping(address => uint128)) public noStake;
mapping(uint256 => mapping(address => bool))    public claimed;

uint256 public marketCount;                 // 当前总市场数
uint256 public constant MAX_MARKETS = 100;  // 硬上限
uint128 public constant MIN_BET = 1e5;      // 0.1 USDC (6 decimals)
uint16  public constant MAX_FEE_BPS = 500;  // 5% 上限
uint64  public constant ORACLE_WINDOW = 5 minutes;

address public feeRecipient;
uint16  public feeBps = 100;                // 默认 1%
address public immutable USDC;              // 0x3600...
address public immutable PYTH;              // Pyth contract on Arc testnet
```

### 4.2 函数签名

```solidity
// ============ admin ============

function createMarket(
    bytes32 pythPriceId,
    int64   threshold,
    int32   thresholdExpo,
    uint64  betDeadline,
    uint64  resolveAfter,
    string  calldata question
) external onlyOwner returns (uint256 id);
// require: marketCount < MAX_MARKETS
// require: betDeadline > block.timestamp
// require: resolveAfter > betDeadline
// effect:  快照 feeBps 进 Market.feeBpsSnapshot
// effect:  emit MarketCreated

function setFeeBps(uint16 bps) external onlyOwner;
// require: bps <= MAX_FEE_BPS

function setFeeRecipient(address r) external onlyOwner;
// require: r != address(0)

// ============ user 写 ============

function bet(uint256 id, bool yes, uint128 amount) external;
// require: id < marketCount
// require: markets[id].outcome == Unresolved
// require: block.timestamp < betDeadline
// require: amount >= MIN_BET
// effect:  SafeERC20.safeTransferFrom(USDC, msg.sender, address(this), amount)
// effect:  yesPool/noPool += amount; yesStake/noStake[user] += amount
// effect:  emit Bet

function resolve(uint256 id, bytes[] calldata priceUpdate) external payable;
// require: markets[id].outcome == Unresolved
// require: block.timestamp >= resolveAfter
// flow:
//   1) 调 IPyth(PYTH).updatePriceFeeds{value: msg.value}(priceUpdate)
//      （msg.value 是 native ETH-equivalent，用 18 decimals；前端需先 getUpdateFee）
//   2) 读 IPyth(PYTH).getPriceUnsafe(pythPriceId)
//   3) require price.publishTime ∈ [resolveAfter, resolveAfter + ORACLE_WINDOW]
//      → 否则 outcome = Invalid
//   4) require price.price > 0 && price.expo 与 thresholdExpo 对齐
//      → 否则 outcome = Invalid
//   5) if yesPool + noPool == 0 → outcome = Invalid
//   6) 计算 outcome：price.price >= threshold → Yes else No
//   7) winningPool = (outcome == Yes) ? yesPool : noPool
//   8) if winningPool == 0 → outcome = Invalid（单边输）
//   9) losingPool = (outcome == Yes) ? noPool : yesPool
//  10) protocolFee = losingPool * feeBpsSnapshot / 10000
//  11) winnerPool  = winningPool + losingPool - protocolFee
//  12) 立即 SafeERC20.safeTransfer(USDC, feeRecipient, protocolFee)
//  13) 记录 settlePrice / settleTime
//  14) emit Resolved
// 注意：失败路径（步骤 3/4/8 触发 Invalid）也要 emit Resolved 让前端能更新状态

function claim(uint256 id) external;
// require: markets[id].outcome != Unresolved
// require: !claimed[id][msg.sender]
// effect:  claimed[id][msg.sender] = true   ← CEI: 先置标记
//
// 三种分支：
// a) Invalid → payout = yesStake[id][user] + noStake[id][user]
// b) Yes 赢   → payout = yesStake[id][user] * winnerPool / yesPool
// c) No 赢    → payout = noStake[id][user]  * winnerPool / noPool
// d) 用户未在赢方且 outcome != Invalid → revert NotAWinner
// e) 算出 payout == 0（如 Invalid 但用户从未下注） → revert NoPayoutAvailable
//
// effect:  SafeERC20.safeTransfer(USDC, msg.sender, payout)
// effect:  emit Claimed

// ============ view（供前端聚合） ============

function getMarket(uint256 id) external view returns (Market memory);
function getMarketsPaged(uint256 from, uint256 to) external view returns (Market[] memory);
function userStake(uint256 id, address u) external view returns (uint128 yes_, uint128 no_);
function pendingPayout(uint256 id, address u) external view returns (uint256);
// pendingPayout 必须与 claim 共用同一份算法（实现上提取 internal _calcPayout，
// claim 和 pendingPayout 都调它，避免漂移）
```

### 4.3 自定义错误

```solidity
error MarketNotFound();
error MarketLimitReached();
error InvalidTimeOrder();           // betDeadline >= resolveAfter
error TimesInPast();
error ZeroAddress();
error FeeTooHigh();

error BettingClosed();
error AlreadyResolved();
error NotResolved();
error NotResolvableYet();
error BelowMinBet();

error PythUpdateFailed();           // updatePriceFeeds revert 包装
error AmountOverflowsUint128();     // 安全 down-cast

error AlreadyClaimed();
error NotAWinner();
error NoPayoutAvailable();          // payout 算下来为 0（防 transfer(0) 浪费 gas）
```

### 4.4 事件

```solidity
event MarketCreated(
    uint256 indexed id,
    bytes32 indexed pythPriceId,
    int64   threshold,
    int32   thresholdExpo,
    uint64  betDeadline,
    uint64  resolveAfter,
    uint16  feeBpsSnapshot,
    string  question
);

event Bet(
    uint256 indexed id,
    address indexed user,
    bool    yes,
    uint128 amount,
    uint128 yesPoolAfter,
    uint128 noPoolAfter
);

event Resolved(
    uint256 indexed id,
    Outcome outcome,
    int64   settlePrice,
    uint64  settleTime,
    uint128 winnerPool,
    uint128 protocolFee
);

event Claimed(
    uint256 indexed id,
    address indexed user,
    uint256 payout
);
```

### 4.5 关键不变量

1. **资金守恒**：任意时刻
   `IERC20(USDC).balanceOf(this) >= Σ(yesPool + noPool) - Σ(已 claim 的 payout) - Σ(已转出 protocolFee)`
2. **不超分**：所有 winner 的 payout 之和 ≤ winnerPool（除法向下取整保护）
3. **Invalid 退款无损**：Invalid 状态下，每个用户 payout = yesStake + noStake，总额等于 yesPool + noPool
4. **重入安全**：claim 用严格 CEI（先置 `claimed[id][user] = true`，再 transfer）；其他写函数无外部调用入栈
5. **0.8.24 自带溢出**：所有算术 revert on overflow；uint128 down-cast 显式 `require(x <= type(uint128).max)`
6. **市场创建后不可改**：`feeBpsSnapshot` 等关键字段创建后只读

### 4.6 与原版本的差异（codex review 后修订）

- ✅ 新增 `winnerPool`、`protocolFee`、`feeBpsSnapshot` 字段（resolve 时一次性锁定，claim 用，杜绝漂移）
- ✅ `resolve` 改为 Pyth pull 模式，签名 `(uint256, bytes[]) payable`
- ✅ 用 Pyth `publishTime ∈ [resolveAfter, resolveAfter + 5min]` 校验，解决"延迟结算套利"问题
- ✅ 单边输方赢的不可能分支 → 显式 Invalid
- ✅ 0 注市场到期 → 显式 Invalid + emit Resolved（不再静默 return）
- ✅ 资金从 native `msg.value` 路径改为 ERC-20 `transferFrom`，单位 6 decimals
- ✅ 加 `getMarketsPaged` 分页 view
- ✅ `pendingPayout` 与 `claim` 共用 internal `_calcPayout`，强一致

---

## 5. § 3 前端设计

### 5.1 路由

```
/                       主页：active markets 列表 + my positions + resolved 区
/market/[id]            单市场详情页（深链可分享）
/connect                网络/钱包问题排查页（faucet、手动添加 Arc 网络指南）
```

### 5.2 数据流

**读路径（首屏）**：

```ts
// 一次 multicall 拿首屏所需全部
const [marketCount, markets, ...userStakes] = await multicall([
  { contract, fn: 'marketCount' },
  { contract, fn: 'getMarketsPaged', args: [0n, 100n] },
  // 然后对返回的每个 market id 查 userStake + pendingPayout
]);
```

**写路径**：

```ts
// 首次：approve（建议 max，后续免）
await usdc.write.approve([PREDICTION_ADDR, maxUint256]);

// 下注
await prediction.write.bet([id, isYes, parseUnits(amount, 6)]);

// 结算（任何人，前端可在 resolveAfter 后展示"自动 Resolve"按钮）
const priceUpdate = await pythHermes.getPriceFeedsUpdateData([priceId]);
const updateFee   = await pyth.read.getUpdateFee([priceUpdate]);
await prediction.write.resolve([id, priceUpdate], { value: updateFee });

// 领奖
await prediction.write.claim([id]);
```

### 5.3 钱包与 chain 配置

```ts
// lib/chain.ts
import { defineChain } from 'viem';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, // ← native 18
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' } },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11', // 部署前再用 cast 验证一次
      // blockCreated: <部署时填入 Arc 上该合约部署的 block 号，提高 multicall 性能>
    },
  },
  testnet: true,
});
```

- RainbowKit 配置自定义 chain
- `wallet_addEthereumChain` UX：用 RainbowKit 自带流程；失败时引导用户到 `/connect` 手动添加
- SSR：钱包 provider 用 client-only（Next.js App Router `'use client'`），避免 hydration mismatch

### 5.4 关键 UX 决策

| 项 | 决策 |
|---|---|
| 最小下注 | 0.1 USDC（降低 faucet 门槛） |
| USDC 余额检测 | 首页右上角显示，0 时跳 Faucet 卡片 |
| 赔率提示 | Bet Modal 显示 "Implied Win" + 警告 "赔率随新下注变化" |
| YES% bar | 数字旁加 tooltip："资金流向比例，非真实概率" |
| 链不对 | 全局红条 + 一键 switch |
| 交易失败 | viem 解码 revert reason → toast 中文化提示 |
| Approve 体验 | 首次交易合并 approve + bet（用户点 Bet 后自动顺序触发两笔） |

### 5.5 视觉

视觉细节按 `mockups/preview.html` 实现（Tailwind 重写 CSS）：

- Dark mode 默认 + Light mode 切换
- 暖橙 `#ff6b35` 仅作品牌点缀（不大面积）
- Geist 字体（Google Fonts CDN）+ `font-variant-numeric: tabular-nums`
- 池子流向条（YES/NO 资金占比）作为差异化设计
- 移动端响应式：market grid 在 < 640px 时单列

---

## 6. § 4 错误处理 / 安全 / 边缘案例

### 6.1 边缘案例处理表

| 场景 | 行为 |
|---|---|
| 0 注市场到期 | resolve 写 `outcome = Invalid` + emit Resolved |
| 单边市场 + 该边赢（winningPool > 0, losingPool == 0） | 正常 claim，每人拿回本金（无利润） |
| 单边市场 + 该边输（winningPool == 0, losingPool > 0） | `outcome = Invalid`，losingPool 全额退款 |
| oracle updatePriceFeeds revert | 整个 resolve 调用 revert（不消耗状态），可重试 |
| oracle 返回 price ≤ 0 | `outcome = Invalid` |
| oracle publishTime ∉ [resolveAfter, +5min] | `outcome = Invalid` |
| 重复 claim | revert `AlreadyClaimed` |
| 没下注用户 claim | revert `NotAWinner`（或在 Invalid + 0 stake 时静默 payout=0） |
| 重入攻击 | CEI（先置 claimed，再 transfer）+ 0.8.x 自带防护 |
| 已结算后再 resolve | revert `AlreadyResolved` |
| betDeadline 后下注 | revert `BettingClosed` |
| owner 中途调 setFeeBps | 只影响新创建市场（feeBpsSnapshot 已在 createMarket 锁定） |
| 整数除法余尘 | 接受 dust loss 留合约（不维护"最后 claimer"逻辑） |

### 6.2 前端错误处理

| 场景 | 行为 |
|---|---|
| 未连钱包 | 主 CTA 变 "Connect Wallet" |
| 链不对 | 顶部红条 + `useSwitchChain` 一键切换 |
| USDC 余额不足 | Bet Modal 禁用 Place Bet + 提示 Faucet 链接 |
| 用户拒绝交易 | toast "已取消"，不报错 |
| 交易上链失败 | viem 解码 revert reason，toast 中文化提示 |
| 节点超时 | wagmi 自动重试 3 次；仍失败 → toast "网络异常，请重试" |
| 钱包断开 | 立即清空内存中的地址与 query cache |

### 6.3 安全清单

- [ ] Solidity 0.8.24（溢出自检）
- [ ] OpenZeppelin Ownable2Step + SafeERC20
- [ ] 不使用 delegatecall / selfdestruct / 紧急暂停
- [ ] resolve 非 onlyOwner（任何人可触发）
- [ ] 所有外部 input 严格 require 校验
- [ ] uint128 down-cast 显式 `require` 范围
- [ ] Foundry invariant test 覆盖资金守恒

### 6.4 部署清单（不算"安全"措施，但必做）

- [ ] 部署前 cast 验证 Multicall3 在 Arc testnet 实际地址
- [ ] 部署前 cast 验证 Pyth contract 在 Arc testnet 地址
- [ ] 部署 script 自动落盘 ABI / 地址 / chain config 给前端
- [ ] 部署后立即 `verify` 到 Arcscan
- [ ] feeRecipient 设为 owner 地址（MVP）或独立 EOA
- [ ] 用 `script/CreateMarket.s.sol` 创建 3-5 个初始市场作为冷启动

### 6.5 显式接受的风险

1. **owner 单一信任点**——owner 控制创建市场和费率，**但无法影响已存在市场的结算和提款**。MVP 可接受
2. **单一 oracle 依赖**——Pyth 失效会让所有依赖它的市场进入 Invalid 退款（无资金损失，仅体验损失）
3. **无紧急暂停**——故意。避免 owner 滥用暂停卡用户钱。代价：出 bug 时无法干预
4. **dust loss**——余尘归合约（单市场 < $0.000001，可忽略）
5. **历史保留**——3 个月以上 Bet 事件可能因 RPC log retention 而无法恢复
6. **冷启动**——testnet USDC 是稀缺资源，初期可能用户少。靠 faucet 链接和低门槛 0.1 USDC min bet 缓解

### 6.6 显式不做（YAGNI）

- 不撤注 / 不转让仓位 / 不发 outcome token
- 不做 AMM / LP / 价格曲线
- 不做暂停 / 紧急逃生
- 不做后端 / 索引器 / 数据库
- 不做 admin Web UI（用 Foundry script 创建市场）
- 不做用户名 / 头像 / 排行榜 / 社交
- 不做邮件 / 推送 / 通知
- 不做 locale 切换（中文为主，英文标识）
- 不做 priceFeed 白名单（owner 自行注意）

---

## 7. § 5 测试策略 + 里程碑

### 7.1 合约测试（Foundry）

必须覆盖的测试场景：

```
# createMarket
test_CreateMarket_RevertsIfTimesInPast
test_CreateMarket_RevertsIfBetDeadlineGEResolveAfter
test_CreateMarket_RevertsIfMarketLimitReached
test_CreateMarket_EmitsEvent
test_CreateMarket_SnapshotsCurrentFeeBps

# bet
test_Bet_TransfersUSDCFromUser
test_Bet_IncrementsPools
test_Bet_RevertsIfBelowMinBet
test_Bet_RevertsAfterDeadline
test_Bet_RevertsIfAlreadyResolved
test_Bet_AccumulatesMultipleBetsFromSameUser

# resolve
test_Resolve_Yes_WhenPriceAboveThreshold
test_Resolve_No_WhenPriceBelowThreshold
test_Resolve_Invalid_OnPythRevert
test_Resolve_Invalid_OnNegativePrice
test_Resolve_Invalid_OnPriceOutsideWindow
test_Resolve_Invalid_OnZeroTotalPool
test_Resolve_Invalid_OnOneSidedLosingPool
test_Resolve_RevertsIfBeforeResolveAfter
test_Resolve_RevertsIfAlreadyResolved
test_Resolve_TransfersFeeImmediately

# claim
test_Claim_PayoutCorrect_YesWinner
test_Claim_PayoutCorrect_NoWinner
test_Claim_PayoutCorrect_OneSidedWinner（拿回本金，无利润）
test_Claim_FullRefund_InvalidOutcome
test_Claim_RevertsForLoser
test_Claim_RevertsIfNotResolved
test_Claim_RevertsIfAlreadyClaimed
test_Claim_PreventsReentrancy（用恶意 token mock）

# fuzz / invariant
invariant_FundsConservation
invariant_NoOverpayment
invariant_PoolMath
```

工具：`forge test` + invariant fuzzing（建议 ≥ 1000 runs）。

### 7.2 集成测试（Arc testnet 实联调）

部署到 Arc testnet 后用 cast 直接走完：
- `createMarket` × 1
- `bet` × 3（不同地址、不同侧）
- `resolve` 含 Pyth priceUpdate
- `claim` × 3
- 资金守恒数学全对得上

不通过前端，直接合约层验证。

### 7.3 前端测试

MVP 仅做**手动 QA**，不做 e2e 自动化（YAGNI）。

### 7.4 手动 QA 清单

- [ ] MetaMask 浏览器扩展连接 + 切换到 Arc testnet
- [ ] WalletConnect 手机扫码连接
- [ ] Coinbase Wallet 连接
- [ ] Faucet 领 USDC 后下注成功
- [ ] 余额不足时按钮正确禁用
- [ ] 链错误时切换提示生效
- [ ] approve 流程正确（首次签名 + 后续免）
- [ ] Bet Modal "Implied Win" 数字与合约计算一致
- [ ] 下注后 Bet event 正确，前端刷新仓位
- [ ] resolve 后 claim 金额与公式一致
- [ ] Invalid 情况下退款正确
- [ ] 移动端浏览器（Safari iOS + Chrome Android）布局可用
- [ ] Dark / Light 模式切换
- [ ] `/market/[id]` 深链可分享
- [ ] `/connect` 故障排查页可用

### 7.5 里程碑

| 里程碑 | 内容 | 估时 | 验收 |
|---|---|---|---|
| M1 | 合约编写 + Foundry 单测全过 | 3-4 天 | `forge test` 100% 通过；invariant fuzz 1000 runs 无异常 |
| M2 | 部署到 Arc testnet + verify + 创建 3 个初始市场 | 1 天 | Arcscan 可读源码；3 个市场可见 |
| M3 | 前端 MVP（连钱包、市场列表、Bet Modal、approve+bet） | 4-5 天 | 用户可完成 connect → approve → bet 全流程 |
| M4 | 完整 UX（claim、resolved 区、faucet 提示、响应式） | 2-3 天 | 手动 QA 清单全过 |
| M5 | 双 codex 并行 review 实现代码 + 修复 | 2 天 | 三方一致同意 |
| M6 | Vercel 部署 + 最终回归 | 0.5 天 | 生产 URL 可访问，QA 清单复跑 |

**总计：12.5-15.5 天**

### 7.6 仓库结构（codex 实现时遵循）

```
ArcPredict/
├── contracts/                       # Foundry 项目根
│   ├── foundry.toml
│   ├── src/
│   │   ├── PredictionMarket.sol
│   │   └── interfaces/
│   │       └── IPyth.sol            # 简化版 Pyth interface
│   ├── test/
│   │   ├── PredictionMarket.t.sol
│   │   ├── PredictionMarket.invariant.t.sol
│   │   └── mocks/
│   │       ├── MockUSDC.sol
│   │       └── MockPyth.sol
│   ├── script/
│   │   ├── Deploy.s.sol
│   │   └── CreateMarket.s.sol
│   └── lib/                         # forge install 依赖
│
├── web/                             # Next.js 14 项目根
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── providers.tsx            # RainbowKit / wagmi（client-only）
│   │   ├── page.tsx                 # 主页
│   │   ├── market/[id]/page.tsx
│   │   └── connect/page.tsx
│   ├── components/
│   │   ├── MarketCard.tsx
│   │   ├── BetModal.tsx
│   │   ├── PositionList.tsx
│   │   ├── ResolvedList.tsx
│   │   ├── NetworkBanner.tsx
│   │   └── WalletPill.tsx
│   ├── lib/
│   │   ├── chain.ts                 # arcTestnet defineChain
│   │   ├── contract.ts              # ABI + 地址
│   │   ├── pyth.ts                  # Pyth Hermes 客户端
│   │   └── format.ts                # USDC 6 decimals 格式化
│   └── public/
│
├── mockups/
│   └── preview.html                 # v0 视觉参考（含 Tweaks）
│
└── docs/superpowers/specs/
    └── 2026-06-07-arc-predict-design.md   # 本文档
```

---

## 8. 参考资料

- Arc 官方文档入口：https://docs.arc.io/
- Connect to Arc：https://docs.arc.io/arc/references/connect-to-arc
- Contract Addresses：https://docs.arc.io/arc/references/contract-addresses
- EVM Compatibility：https://docs.arc.io/arc/concepts/evm-compatibility
- Stablecoin Native Model：https://docs.arc.io/arc/concepts/stablecoin-native-model
- Oracles：https://docs.arc.io/arc/tools/oracles
- Sample Applications：https://docs.arc.io/arc/references/sample-applications
- Pyth Network EVM contracts：https://docs.pyth.network/price-feeds/core/contract-addresses/evm
- ChainList Arc Testnet：https://chainlist.org/chain/1244

---

## 附录 A：评审历史

### A.1 双 codex 并行评审（2026-06-07）

针对 §1–§4 初版做对抗性评审。两路独立 codex 给出：

- **Codex A**（合约/安全视角）：**反对**。10 项 blocker：oracle 时间套利、stale 判定围绕 now 而非 T、0 注静默 return、单边市场处理不全、fee 快照仅"隐含"、fee 结算时机不清、余尘策略不实现、USDC 单位未验证、Chainlink round 完整性、无后端与真实用户矛盾
- **Codex B**（架构/产品/事实核查视角）：**有条件同意**。7 项 blocker：USDC decimals 错（native 18 vs ERC-20 6）、Chainlink Data Feeds 在 Arc testnet 无证据、无后端范围未闭合、admin 创建路径未定义、faucet 冷启动、单页无详情伤分享、结算语义有歧义

### A.2 主体决策与修订

收敛后接受的所有修订均已合并进本文档 §3–§7。核心修订：

1. USDC 路径改 ERC-20 transferFrom（6 decimals）
2. Oracle 改 Pyth pull（含 publishTime 窗口校验）
3. winnerPool / protocolFee / feeBpsSnapshot 显式字段
4. 0 注 / 单边输 显式 Invalid + emit Resolved
5. 100 markets 硬上限 + 分页 view
6. Admin 用 Foundry script，不做 admin Web UI
7. 加 `/market/[id]` 路由
8. 最小下注 0.1 USDC

### A.3 故意未采纳的 codex 建议

| 建议 | 理由 |
|---|---|
| priceFeed 白名单 | YAGNI，owner 自检 |
| 维护"剩余 winning stake"为最后 claimer 兜余尘 | 复杂度高，dust loss 可接受 |
| 新增 `NoLiquidity` 枚举 | 复用 Invalid 即可，少一种状态 |
| 加紧急暂停 | 故意接受的风险，简洁换信任 |
