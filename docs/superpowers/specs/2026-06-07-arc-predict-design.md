# ArcPredict 设计文档 v3

> **日期**：2026-06-07
> **状态**：草案，待用户审阅（已完成 3 轮共 5 路 codex 对抗性评审 + Arc testnet 烫手验证）
> **修订记录**：
> - v1：初版（§3–§7）
> - v2：第二轮 15 项修订（Pyth API、双 decimals、运营脚本、仓库结构等，详见 A.5）
> - v3：第三轮 11 项修订（claim 语义、view 安全、forceInvalid 逃生口、event 字段、不变量措辞、threshold 换算、错误清理，详见 A.8）
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

1. **无后端**。所有状态从合约读，无 subgraph 也无事件索引。代价：用户仓位枚举受限——通过**总市场数上限 1000**（单调递增 marketCount）+ 前端分页控制 RPC 负载，owner 自律不滥建。
2. **ERC-20 USDC 路径**。用户首次下注前 approve 一次（建议 `max`），后续 bet / claim 不需要 approve。**所有数学按 6 decimals**。
3. **Pyth Core 作为唯一 oracle，固定时间结算**。pull 模式，resolve 时调用方附带 `priceUpdate` payload + update fee。合约用 **`parsePriceFeedUpdatesUnique(updateData, [priceId], resolveAfter, resolveAfter + ORACLE_WINDOW)`** 获取窗口内首条价格——**不读 Pyth 全局最新价格**，因此避免延迟结算时的"时间套利"和"全局价格已被推到窗口外"两类风险。
4. **公开 resolve**。`resolve()` 无 onlyOwner，任何人都可触发，避免管理员卡结算。
5. **运营脚本驱动**。owner 用 Foundry script 周期性扫描可结算市场并触发 resolve（不依赖任何人主动 resolve）。

### 3.3 范围与边界

| 维度 | 边界 |
|---|---|
| 总市场数（创建后只增） | 上限 **1000**（MVP 阶段绝对够用，owner 自律分配节奏） |
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
    bytes32 pythPriceId;            // Pyth price feed ID（不是 EVM 地址）
    int64   threshold;              // 按 Pyth feed 的 expo 缩放（例如 BTC ≥ 70000 → 70000e8 with expo=-8）
    int32   thresholdExpo;          // 期望的 price.expo（resolve 时严格 == 即可）
    uint64  betDeadline;            // 截止下注时间戳
    uint64  resolveAfter;           // 最早可结算时间戳；窗口 = [resolveAfter, resolveAfter + ORACLE_WINDOW]
    uint128 yesPool;                // 累计 YES 下注（USDC 6 decimals）
    uint128 noPool;                 // 累计 NO 下注
    uint128 winnerPool;             // resolve 时锁定，claim 用
    uint128 protocolFee;            // resolve 时计算，立即转 feeRecipient
    uint16  feeBpsSnapshot;         // 创建时快照费率
    address feeRecipientSnapshot;   // 创建时快照收款地址（保证 owner 中途改 feeRecipient 不影响已有市场）
    Outcome outcome;
    int64   settlePrice;            // resolve 时记录（Invalid 时为 0）
    uint64  settleTime;             // resolve 时记录的 Pyth publishTime（Invalid 时为 0）
    string  question;               // 展示用文本（建议合约层强约束 length <= 200）
}

mapping(uint256 => Market) public markets;
mapping(uint256 => mapping(address => uint128)) public yesStake;
mapping(uint256 => mapping(address => uint128)) public noStake;
mapping(uint256 => mapping(address => bool))    public claimed;

uint256 public marketCount;                    // 历史总创建数（单调递增）
uint256 public constant MAX_MARKETS = 1000;    // 历史创建总数硬上限（不是 active）
uint128 public constant MIN_BET = 1e5;         // 0.1 USDC (6 decimals)
uint16  public constant MAX_FEE_BPS = 500;     // 5% 上限
uint64  public constant ORACLE_WINDOW = 5 minutes;
uint256 public constant MAX_QUESTION_LEN = 200;  // UTF-8 字节数，中文每字符 3 字节 → 约 66 中文字
uint64  public constant FORCE_INVALID_DELAY = 7 days; // resolveAfter + 7d 后任何人可永久 Invalid 化（防 oracle 失效资金锁死）

address public feeRecipient;                   // 仅影响**新创建**的市场（旧市场用 snapshot）
uint16  public feeBps = 100;                   // 默认 1%（仅影响新创建的市场）
address public immutable USDC;                 // 0x3600...
address public immutable PYTH;                 // Pyth contract on Arc testnet
```

**Constructor + 继承**：

```solidity
// 基于 OpenZeppelin Contracts v5（Ownable2Step 继承 Ownable）
import { Ownable, Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { SafeERC20, IERC20 }     from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PredictionMarket is Ownable2Step {
    using SafeERC20 for IERC20;

    constructor(
        address usdc,
        address pyth,
        address initialOwner,
        address initialFeeRecipient
    ) Ownable(initialOwner) {
        if (usdc == address(0) || pyth == address(0)
            || initialOwner == address(0) || initialFeeRecipient == address(0)) revert ZeroAddress();
        USDC = usdc;
        PYTH = pyth;
        feeRecipient = initialFeeRecipient;
    }

    // ... 状态、函数 ...
}
```
若强制必须用 v4：去掉 `Ownable(initialOwner)`，构造内调 `_transferOwnership(initialOwner)`。
Foundry 安装：`forge install OpenZeppelin/openzeppelin-contracts` 默认拉 v5。

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
// require: marketCount < MAX_MARKETS                 → revert MarketLimitReached
// require: betDeadline > block.timestamp             → revert TimesInPast
// require: resolveAfter > betDeadline                → revert InvalidTimeOrder
// require: bytes(question).length <= MAX_QUESTION_LEN → revert QuestionTooLong
// require: pythPriceId != bytes32(0)                 → revert InvalidPriceId
// effect:  快照 feeBps 进 feeBpsSnapshot
// effect:  快照 feeRecipient 进 feeRecipientSnapshot
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

function resolve(uint256 id, bytes[] calldata updateData) external payable;
// require: markets[id].outcome == Unresolved         → revert AlreadyResolved
// require: block.timestamp >= resolveAfter           → revert NotResolvableYet
//
// === 关键：用 parsePriceFeedUpdatesUnique 而不是 updatePriceFeeds+getPriceUnsafe ===
// 后者读 Pyth 全局最新价格，可能被其他人推到窗口外，且允许结算者择时套利。
// 前者由 Pyth 严格保证返回的价格 publishTime ∈ [minPublishTime, maxPublishTime]，
// 否则在 Pyth 合约内 revert（不消耗本合约状态，可重试）。
//
// flow:
//   1) 准备 fee：updateFee = IPyth(PYTH).getUpdateFee(updateData);
//      require(msg.value >= updateFee, "fee");
//   2) bytes32[] memory ids = new bytes32[](1); ids[0] = m.pythPriceId;
//   3) PythStructs.PriceFeed[] memory feeds = IPyth(PYTH).parsePriceFeedUpdatesUnique{value: updateFee}(
//          updateData,
//          ids,
//          uint64(m.resolveAfter),
//          uint64(m.resolveAfter + ORACLE_WINDOW)
//      );
//      ← Pyth 内部 revert 时本函数 revert（updateData 错误/fee 不足 → InvalidOracleUpdate）
//        ← revert 是「可重试」语义：状态未变，任何人可换更好的 updateData 再调
//
//   4) PythStructs.Price memory p = feeds[0].price;
//   5) 永久 Invalid 终态分支（即便 Pyth 正常返回也走 Invalid）：
//      a) p.price <= 0                  → Invalid（永远不应发生，防御性）
//      b) p.expo != m.thresholdExpo     → Invalid（owner 创建时填错或 Pyth 改 expo）
//      c) m.yesPool + m.noPool == 0     → Invalid（0 注）
//
//   6) 如果不是 Invalid：
//      Outcome o = (p.price >= m.threshold) ? Outcome.Yes : Outcome.No;
//      winningPool = (o == Yes) ? m.yesPool : m.noPool;
//      losingPool  = (o == Yes) ? m.noPool : m.yesPool;
//      // 单边市场 + 该边输 → 改判 Invalid 退款（赢方无对手，无意义）
//      if (winningPool == 0) o = Outcome.Invalid;
//
//   7) 写状态：
//      m.outcome      = o;
//      m.settlePrice  = (o == Invalid) ? int64(0) : p.price;
//      m.settleTime   = (o == Invalid) ? uint64(0) : uint64(p.publishTime);
//      if (o != Invalid) {
//          m.protocolFee = uint128(uint256(losingPool) * m.feeBpsSnapshot / 10000);
//          m.winnerPool  = winningPool + losingPool - m.protocolFee;
//      }
//      // Invalid 时不留 protocolFee（用户全额退款）
//
//   8) 副作用：
//      if (m.protocolFee > 0) SafeERC20.safeTransfer(USDC, m.feeRecipientSnapshot, m.protocolFee);
//      if (msg.value > updateFee) {
//          (bool ok,) = msg.sender.call{value: msg.value - updateFee}("");
//          require(ok, "refund");
//      }
//      emit Resolved(id, m.outcome, m.settlePrice, m.settleTime, m.winnerPool, m.protocolFee);

// === revert vs Invalid 的清晰边界 ===
//
// 「revert」（状态不变，可重试）：
//   • updateData 格式错 / 缺 fee / Pyth 合约层 revert  → InvalidOracleUpdate（包装 Pyth 错误）
//   • block.timestamp < resolveAfter                  → NotResolvableYet
//   • outcome != Unresolved                           → AlreadyResolved
//
// 「Invalid」（永久终态，所有人退款）：
//   • Pyth 正常返回但 price <= 0
//   • Pyth 正常返回但 expo 与创建时记录不匹配
//   • 0 注市场到期
//   • 单边市场 + 该边输（赢方为空）

function claim(uint256 id) external;
// require: markets[id].outcome != Unresolved        → revert NotResolved
// require: !claimed[id][msg.sender]                 → revert AlreadyClaimed
//
// 错误优先级（顺序判断）：
//   1) totalStake = yesStake[id][user] + noStake[id][user]
//      if totalStake == 0 → revert NoPayoutAvailable    // 从未下注
//   2) if outcome == Yes && yesStake[id][user] == 0 → revert NotAWinner
//   3) if outcome == No  && noStake[id][user]  == 0 → revert NotAWinner
//   4) payout = _quotePayout(id, user)                  // 此时必 > 0
//
// effect:  claimed[id][msg.sender] = true              ← CEI: 先置标记
// effect:  SafeERC20.safeTransfer(USDC, msg.sender, payout)
// effect:  emit Claimed

// ============ Pyth 死锁逃生口 ============

function forceInvalid(uint256 id) external;
// 任何人可调；只有在 oracle 长期失效场景使用，正常路径绝不应触发
// require: markets[id].outcome == Unresolved          → revert AlreadyResolved
// require: block.timestamp >= resolveAfter + FORCE_INVALID_DELAY → revert NotForceInvalidatableYet
// effect:  markets[id].outcome = Invalid
// effect:  emit Resolved(id, Invalid, 0, 0, 0, 0)
// 说明：Pyth Hermes 默认保留 ~30 天历史更新，正常 7 天内 anyone 用历史数据 resolve 即可
//      forceInvalid 是兜底；触发后所有下注者通过 claim 拿回本金

// ============ view（供前端聚合） ============

function getMarket(uint256 id) external view returns (Market memory);
function getMarketsPaged(uint256 from, uint256 toExclusive) external view returns (Market[] memory);
// require: from <= toExclusive <= marketCount

function userStake(uint256 id, address u) external view returns (uint128 yes_, uint128 no_);
function pendingPayout(uint256 id, address u) external view returns (uint256);
// 对 Unresolved / 输方 / 0 stake 用户：返回 0（绝不 revert）
// 与 claim 的差异：claim 用同一份数学但加上 require 抛错；view 只返回数值
// 实现要点：
//   - 抽 internal pure / view 函数 `_quotePayout(...)` 仅做数学（永不 revert）
//   - claim 调 `_quotePayout` + 上述 require 错误优先级
//   - pendingPayout / getDashboard 也调 `_quotePayout`，不加错误检查
// 这样 claim 与 view 数学严格一致，但 view 永不 revert，前端可安全批量聚合

struct DashboardRow {
    uint256 id;
    Market  market;
    uint128 yesStake;
    uint128 noStake;
    bool    claimed_;
    uint256 pendingPayout;
}

function getDashboard(address user, uint256 from, uint256 toExclusive)
    external view returns (DashboardRow[] memory rows, uint256 totalCount);
// 同时返回 marketCount，避免前端再多一次 RPC
// require: from <= toExclusive <= marketCount

function getDashboardLatest(address user, uint256 limit)
    external view returns (DashboardRow[] memory rows, uint256 totalCount);
// 便利函数：返回最近 `limit` 个市场（高 id 在前）
// 因为 marketCount 单调递增，最新市场在 [marketCount - limit, marketCount)
// 首屏强烈推荐用这个，而不是 getDashboard(user, 0, 100) ← 那个取的是最老的 100 个
```

### 4.3 自定义错误

```solidity
// === createMarket ===
error MarketLimitReached();
error InvalidTimeOrder();           // resolveAfter <= betDeadline
error TimesInPast();
error ZeroAddress();
error FeeTooHigh();
error QuestionTooLong();            // bytes(question).length > MAX_QUESTION_LEN
error InvalidPriceId();             // pythPriceId == bytes32(0)

// === bet ===
error BettingClosed();
error BelowMinBet();
// 注：池子 uint128 累加溢出由 Solidity 0.8.x panic 处理（极不可能触发）

// === resolve ===
error AlreadyResolved();
error NotResolvableYet();
error InsufficientPythFee();        // msg.value < getUpdateFee()（本合约预先检查）
error InvalidOracleUpdate();        // Pyth 合约内部 revert 时，让 Pyth 原生 revert 透传
                                    // ← 仅在需要包装错误时使用；MVP 实现可省略这条，让 Pyth panic 直接透传

// === forceInvalid ===
error NotForceInvalidatableYet();   // block.timestamp < resolveAfter + FORCE_INVALID_DELAY

// === claim ===
error NotResolved();
error AlreadyClaimed();
error NotAWinner();                 // 用户在输方
error NoPayoutAvailable();          // 用户从未下注

// === 跨函数 ===
error InvalidMarketId();            // id >= marketCount
error RefundFailed();               // resolve 末尾退多付 update fee 失败
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
    address feeRecipientSnapshot,   // 创建时快照的 fee 收款地址（用于审计 owner 不影响旧市场）
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

1. **资金守恒（≥ 而非 ==，dust 归合约）**：任意时刻
   `IERC20(USDC).balanceOf(this) ≥ Σ(unresolved 市场池) + Σ(已 resolve 未 claim 的 winnerPool 剩余)`
   等号差额 = 累计除法 dust（极小，可忽略）
2. **不超分**：所有 winner 的 payout 之和 ≤ winnerPool（除法向下取整保护）
3. **Invalid 退款无损**：Invalid 状态下，每个用户 payout = yesStake + noStake，总额恰等于 yesPool + noPool
4. **claim 重入安全**：严格 CEI（先置 `claimed[id][user] = true`，再 `safeTransfer`）。外部调用对象 USDC 是可信合约（Arc 原生 USDC facade），不会触发恶意回调
5. **resolve 外部调用风险界**：resolve 调 Pyth + USDC（fee 转账）+ 可选 native refund 给 resolver。若 refund 失败 → 整笔 revert（设计如此：另一个 resolver 可重试，状态不变）。Pyth 与 USDC 视为可信合约
6. **0.8.24 自带溢出**：所有算术 revert on overflow
7. **市场创建后不可改**：`feeBpsSnapshot` / `feeRecipientSnapshot` / `pythPriceId` / `threshold` / `thresholdExpo` / `betDeadline` / `resolveAfter` 创建后只读
8. **死锁逃生口**：`forceInvalid` 保证任何市场在 `resolveAfter + 7 天` 后都能 finalize，资金永不锁死

### 4.6 与初版的差异（两轮 codex review 后修订）

**Round 1（USDC + Pyth + 边界）**：
- 新增 `winnerPool`、`protocolFee`、`feeBpsSnapshot` 字段（resolve 时一次性锁定）
- `resolve` 改为 Pyth pull 模式
- 单边输方赢、0 注到期 → 显式 Invalid + emit Resolved
- 资金从 native `msg.value` 改为 ERC-20 `transferFrom`，单位 6 decimals
- 加 `getMarketsPaged` 分页 view
- `pendingPayout` 与 `claim` 共用 internal `_calcPayout`

**Round 2（Pyth API + 一致性 + 闭环）**：
- ⭐ `resolve` 从 `updatePriceFeeds + getPriceUnsafe` 改为 **`parsePriceFeedUpdatesUnique`**——避免读 Pyth 全局最新价格被推到窗口外，从 Pyth 合约层保证返回价格在窗口内
- ⭐ 明确 **revert（可重试） vs Invalid（永久终态）** 的边界
- ⭐ 新增 `feeRecipientSnapshot` 字段——保证 owner 中途改 feeRecipient 不影响已存在市场
- ⭐ 显式补充 `constructor` 签名 + 4 个零地址检查
- 把"硬上限 100 active markets"改为"总数上限 1000"（marketCount 单调递增，原 100 上限会让项目永久无法新建市场）
- 新增 `MAX_QUESTION_LEN = 200` 防 owner 误传超长字符串
- 新增 `getDashboard(user, from, toExclusive)` 一次 RPC 拿首屏全部数据
- `getMarketsPaged` 明确 `toExclusive` 半开区间
- `resolve` 末尾退多付的 update fee（避免误转给 Pyth）
- 错误名拆分：`PythUpdateFailed` → `InvalidOracleUpdate` + `InsufficientPythFee`

---

## 5. § 3 前端设计

### 5.1 路由

```
/                       主页：active markets 列表 + my positions + resolved 区
/market/[id]            单市场详情页（深链可分享）
/connect                网络/钱包问题排查页（faucet、手动添加 Arc 网络指南）
```

### 5.2 数据流

**读路径（首屏，单次 RPC 调用）**：

```ts
// 一次 contract.read.getDashboardLatest 拿最新 100 个市场（高 id 在前）
const PAGE = 100n;
const [rows, totalCount] = await prediction.read.getDashboardLatest([userAddress, PAGE]);
// rows: DashboardRow[] = { id, market, yesStake, noStake, claimed_, pendingPayout }
// totalCount: marketCount，前端用来做分页继续读旧市场

// ⚠️ 不要写 getDashboard(user, 0, 100) ← 那是最老的 100 个
// 如果要按 id 范围读：getDashboard(user, Math.max(0, count - PAGE), count)
```

如果合约层暂未提供 `getDashboard`（实现期间临时回退），用两阶段 multicall：

```ts
// 阶段 1：拿市场
const markets = await prediction.read.getMarketsPaged([0n, count]);
// 阶段 2：批量读用户态
const calls = markets.map((_, i) => [
  { ...prediction, fn: 'userStake',     args: [BigInt(i), user] },
  { ...prediction, fn: 'pendingPayout', args: [BigInt(i), user] },
  { ...prediction, fn: 'claimed',       args: [BigInt(i), user] },
]).flat();
const userData = await publicClient.multicall({ contracts: calls });
```

**写路径**：

```ts
// === 首次：approve（独立交易，需用户确认） ===
await usdc.write.approve([PREDICTION_ADDR, maxUint256]);

// === 下注（独立交易，需用户第二次确认） ===
// UI 必须明示这是「Step 2/2: Place Bet」，并展示 Approve 已完成状态
await prediction.write.bet([id, isYes, parseUnits(amount, 6)]);

// === 结算（任何人可触发，但 MVP 期由 owner 运营脚本周期调用） ===
const updateData = await pythHermes.getPriceFeedsUpdateData([priceId]);
const updateFee  = await pyth.read.getUpdateFee([updateData]);
await prediction.write.resolve([id, updateData], { value: updateFee });
// 注意：updateFee 是 Pyth 用 native value 收取（Arc 上单位是 18 decimals 的 USDC raw wei）
// 前端读余额做 18 decimals 解释；下注金额做 6 decimals 解释；千万别混用

// === 领奖 ===
await prediction.write.claim([id]);
```

### 5.3 钱包与 chain 配置

**注意：Arc 的 USDC 有双精度**。viem `nativeCurrency.decimals` 会传给 `wallet_addEthereumChain` 用于**钱包余额显示**——Arc 官方对钱包添加链推荐 **6 decimals**（用户体验上是 ERC-20 USDC 视角），但合约层 `msg.value` 仍是 **18 decimals**。我们用**两个独立常量**严格分离：

```ts
// lib/chain.ts
import { defineChain } from 'viem';

/** 钱包/UI 展示用 USDC decimals（ERC-20 视角，匹配 Arc 钱包文档推荐） */
export const USDC_DECIMALS = 6;

/** 链上 native value（msg.value、tx.value、gas、Pyth update fee）的 raw wei decimals */
export const NATIVE_VALUE_DECIMALS = 18;

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: USDC_DECIMALS }, // ← 6
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' } },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11', // 标准地址，部署前再用 cast 验证
      // blockCreated: <部署时填入提高 multicall 性能>
    },
  },
  testnet: true,
});
```

**严格规则**（codex 实现时务必照搬）：

```ts
// ✅ USDC 余额（前端展示）：从 ERC-20 facade 读，按 USDC_DECIMALS 解释
const balance = await usdc.read.balanceOf([user]);    // 6 decimals
formatUnits(balance, USDC_DECIMALS);                  // 显示 "12.34"

// ✅ 下注金额：完全用 USDC_DECIMALS
parseUnits("10", USDC_DECIMALS);                      // 10_000_000n

// ✅ Pyth update fee：完全用 NATIVE_VALUE_DECIMALS
const fee = await pyth.read.getUpdateFee([updateData]);
// fee 是 raw wei (18 decimals)，直接当 value 传给 resolve 调用
await prediction.write.resolve([id, updateData], { value: fee });

// ❌ 严禁：formatEther / parseEther（会用 18 decimals，前端展示数字会爆炸）
// ❌ 严禁：把 ERC-20 余额和 native 余额相加显示给用户
```

- RainbowKit 配置自定义 chain
- `wallet_addEthereumChain` UX：用 RainbowKit 自带流程；失败时引导用户到 `/connect` 手动添加（页面贴出 chainId / RPC / symbol / explorer 让用户手动填）
- SSR：钱包 provider 用 client-only（Next.js App Router `'use client'`），避免 hydration mismatch
- 主页钱包 pill 仅显示 **ERC-20 USDC 余额**（一个数字），不并列展示 native 余额——避免用户混淆

### 5.4 关键 UX 决策

| 项 | 决策 |
|---|---|
| 最小下注 | 0.1 USDC（降低 faucet 门槛） |
| USDC 余额检测 | 首页右上角显示，0 时跳 Faucet 卡片 |
| 赔率提示 | Bet Modal 显示 "Implied Win" + 警告 "赔率随新下注变化" |
| YES% bar | 数字旁加 tooltip："资金流向比例，非真实概率" |
| 链不对 | 全局红条 + 一键 switch |
| 交易失败 | viem 解码 revert reason → toast 中文化提示 |
| Approve 体验 | **两步顺序交易**（不是一签）：用户在 Bet Modal 点 Confirm 后，UI 先展示 "Step 1/2: Approve USDC"，钱包确认后自动发起 "Step 2/2: Place Bet"。已 approve 过 max 的用户只看到 Step 2 |
| 结算窗口指示 | 市场卡片在 resolveAfter 到达前显示倒计时；进入 [resolveAfter, +5min] 窗口时显示橙色 "Resolving Window Open"；窗口关闭后未 resolve 显示灰色 "Awaiting Resolution"（owner 运营脚本会自动跟进，但页面允许任何人手动触发） |
| seed 流动性 | owner 用独立 seed 钱包给每个新市场双边各注 ~5 USDC，避免单边输方赢=Invalid 的死循环，让普通用户进来就有真实赔率 |

### 5.5 视觉

视觉细节按 `mockups/preview.html` 实现（Tailwind 重写 CSS）：

- Dark mode 默认 + Light mode 切换
- 暖橙 `#ff6b35` 仅作品牌点缀（不大面积）
- Geist 字体（Google Fonts CDN）+ `font-variant-numeric: tabular-nums`
- 池子流向条（YES/NO 资金占比）作为差异化设计
- 移动端响应式：market grid 在 < 640px 时单列

**与 mockup 的语义对齐**：
- mockup 显示的 "View on Arcscan" 链接 → 实现时改为指向 **合约页 / 用户地址过滤页**（无事件索引，无法精确链接到具体 bet/claim tx hash）
- "Settle Price" / "Won/Lost" 状态 → 从 `Market.settlePrice` + `Market.outcome` + `claimed[id][user]` + 用户在赢方的 stake 综合派生
- "Claim X USDC" 按钮 → 用 `pendingPayout(id, user)` 显示；点击触发 `claim(id)`

---

## 6. § 4 错误处理 / 安全 / 边缘案例

### 6.1 边缘案例处理表

| 场景 | 行为（revert / Invalid 边界已严格区分） |
|---|---|
| 0 注市场到期 | resolve 写 `outcome = Invalid` + emit Resolved |
| 单边市场 + 该边赢（winningPool > 0, losingPool == 0） | 正常 claim，每人拿回本金（无利润） |
| 单边市场 + 该边输（winningPool == 0, losingPool > 0） | `outcome = Invalid`，losingPool 全额退款 |
| **updateData 错 / fee 不足 / Pyth 合约层 revert** | resolve 整个 **revert**（状态不变，可换新 updateData 重试） |
| Pyth 正常返回但 price ≤ 0 | `outcome = Invalid`（防御性，正常不会发生） |
| Pyth 正常返回但 expo 不匹配 thresholdExpo | `outcome = Invalid`（owner 创建时参数错或 Pyth 改 expo） |
| 窗口外尝试 resolve（now < resolveAfter） | revert `NotResolvableYet`（不是 Invalid，可重试） |
| `resolveAfter + 7 天` 仍 Unresolved（Pyth/Hermes 长期失效） | 任何人调 `forceInvalid(id)` → 永久 Invalid，所有人退款 |
| **窗口超期但仍可拉到窗口内 Pyth update（hermes 历史回溯）** | 允许任何人拉历史 updateData 并 resolve（Pyth `parsePriceFeedUpdatesUnique` 接受历史更新） |
| 重复 claim | revert `AlreadyClaimed` |
| 已下注但输方 claim | revert `NotAWinner`（含本金亏损） |
| 从未下注用户 claim（任意 outcome） | revert `NoPayoutAvailable` |
| 重入攻击 | CEI（先置 claimed，再 transfer）+ 0.8.x 自带防护 + 信任 USDC/Pyth |
| 已结算后再 resolve | revert `AlreadyResolved` |
| betDeadline 后下注 | revert `BettingClosed` |
| owner 中途调 setFeeBps / setFeeRecipient | 只影响新创建市场（snapshot 已锁定） |
| 整数除法余尘 | 接受 dust loss 留合约（不维护"最后 claimer"逻辑） |
| owner 部署后丢失私钥 | 已存在市场仍可正常 resolve（任何人触发）+ claim；新市场无法创建——MVP 可接受 |

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

**预部署**：
- [ ] cast 验证 Multicall3 在 Arc testnet 部署（应在 `0xcA11...CA11`）
- [ ] cast 验证 Pyth contract 在 Arc testnet 部署，确定实际地址
- [ ] 从 Pyth `price-feeds.json` 拿到 BTC/USD、ETH/USD 的真实 `bytes32 priceId`（同一 feed 各链通用）
- [ ] 用 Pyth Hermes 端点拿一次真实 updateData，本地 forge test fork Arc testnet 跑通 `parsePriceFeedUpdatesUnique` 整条链路

**部署**：
- [ ] 用 `script/Deploy.s.sol` 部署 PredictionMarket，构造参数 = (USDC, PYTH, ownerEOA, feeRecipientEOA)
- [ ] feeRecipient 设为独立 EOA（不是 owner 同地址）便于审计资金流
- [ ] 部署 script 自动落盘 `web/lib/addresses.ts` + `web/lib/abis/PredictionMarket.json`

**部署后**：
- [ ] 立即 `verify` 到 Arcscan（让用户能审计代码）
- [ ] 用 `script/CreateMarket.s.sol` 创建 3-5 个初始市场
- [ ] 用独立 **seed 钱包**给每个新市场双边各注 ~5 USDC（防止单边输方赢=Invalid 死循环；让普通用户进来就能看到双边赔率）
- [ ] 配置运营脚本 cron（见 §7.6 ops 目录）：每 30 秒扫描 `marketCount`，对 `outcome == Unresolved && now >= resolveAfter` 的市场自动拉 Pyth updateData 并触发 resolve

### 6.5 显式接受的风险

1. **owner 单一信任点**——owner 控制创建市场和费率，**但无法影响已存在市场的结算和提款**（feeBps + feeRecipient 创建时快照、resolve 任何人可触发、CEI claim）。MVP 可接受
2. **单一 oracle 依赖**——Pyth 失效会让所有依赖它的市场进入 Invalid 退款（无资金损失，仅体验损失）
3. **无紧急暂停**——故意。避免 owner 滥用暂停卡用户钱。代价：出 bug 时无法干预
4. **dust loss**——余尘归合约（单市场 < $0.000001，可忽略）
5. **历史活动流水保留**——3 个月以上 Bet/Resolved 事件可能因 RPC log retention 而无法恢复。**仓位本身不丢**——yesStake/noStake mapping 是合约永久状态，用户随时可 claim
6. **冷启动**——testnet USDC 是稀缺资源，初期可能用户少。靠 faucet 链接 + 0.1 USDC min bet + owner seed 双边流动性缓解
7. **运营依赖**——MVP 期 resolve 由 owner cron 触发（前端任意人可触发但 testnet 用户没动力）。owner 中断运维 → 市场可能错过结算窗口 → Invalid 退款。可接受
8. **历史总数上限**——`MAX_MARKETS = 1000` 是硬上限。按一周 5-10 个市场节奏，2-4 年可达上限。届时需新部署合约
9. **Pyth update fee 由 resolver 出**——MVP 期 owner 承担；如未来开放 keeper 网络可加退款激励
10. **`MAX_QUESTION_LEN = 200` 字节**——按 UTF-8 字节算（中文每字符 3 字节，约 66 中文字符）。前端按 **`new TextEncoder().encode(s).length`** 校验，**不能按 `s.length`**（JS 字符数）
11. **不校验 Pyth `conf`**——MVP 信任 owner 选用稳定 feed（BTC/ETH 主流 feed conf < 0.1% 价格）；后续可加 `require(price > conf * RATIO)` 校验
12. **threshold/expo 单位转换**——createMarket 时 owner 必须按 Pyth feed expo 缩放阈值。例：BTC/USD feed expo = -8，则 "BTC ≥ 70000" 传 `(threshold=70000_00000000, thresholdExpo=-8)`。`script/CreateMarket.s.sol` 提供 helper 函数和 BTC/ETH 等示例

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
# constructor
test_Constructor_RevertsOnZeroAddress
test_Constructor_SetsImmutables

# createMarket
test_CreateMarket_RevertsIfTimesInPast
test_CreateMarket_RevertsIfBetDeadlineGEResolveAfter
test_CreateMarket_RevertsIfMarketLimitReached       # marketCount == MAX_MARKETS
test_CreateMarket_RevertsIfQuestionTooLong
test_CreateMarket_RevertsIfPriceIdZero
test_CreateMarket_EmitsEventWithSnapshots
test_CreateMarket_SnapshotsCurrentFeeBpsAndRecipient # owner 改 feeRecipient 后旧市场不受影响

# bet
test_Bet_TransfersUSDCFromUser
test_Bet_IncrementsPoolsAndStakes
test_Bet_RevertsIfBelowMinBet
test_Bet_RevertsAfterDeadline
test_Bet_RevertsIfAlreadyResolved
test_Bet_AccumulatesMultipleBetsFromSameUser

# resolve（Pyth parsePriceFeedUpdatesUnique 路径）
test_Resolve_Yes_WhenPriceAboveThreshold
test_Resolve_No_WhenPriceBelowThreshold
test_Resolve_YesAtExactThreshold                   # price == threshold 算 YES
test_Resolve_RevertsIfBeforeResolveAfter
test_Resolve_RevertsIfAlreadyResolved
test_Resolve_RevertsOnPythParseRevert              # MockPyth 模拟 parsePriceFeedUpdatesUnique revert
test_Resolve_RevertsOnInsufficientFee
test_Resolve_Invalid_OnNegativePrice
test_Resolve_Invalid_OnExpoMismatch
test_Resolve_Invalid_OnZeroTotalPool
test_Resolve_Invalid_OnOneSidedLosingPool
test_Resolve_TransfersFeeToSnapshottedRecipient
test_Resolve_RefundsExtraValueToCaller             # msg.value > updateFee 时退款
test_Resolve_EmitsResolvedEvenOnInvalid

# claim
test_Claim_PayoutCorrect_YesWinner
test_Claim_PayoutCorrect_NoWinner
test_Claim_PayoutCorrect_OneSidedWinner            # 拿回本金，无利润
test_Claim_FullRefund_InvalidOutcome
test_Claim_RevertsForLoser                          # NotAWinner
test_Claim_RevertsForNoStakeUser                    # NoPayoutAvailable
test_Claim_RevertsIfNotResolved
test_Claim_RevertsIfAlreadyClaimed
test_Claim_PreventsReentrancy                       # 用恶意 USDC mock

# fuzz / invariant
invariant_FundsConservation                         # balanceOf >= owed
invariant_NoOverpayment                             # Σ winner payout <= winnerPool
invariant_PoolMath                                  # yesPool + noPool = Σ stakes
invariant_OnlyOwnerCanCreate                        # 无创建越权
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
| M1 | 合约编写 + Foundry 单测 + invariant fuzz + MockPyth/MockUSDC | **4-5 天** | `forge test` 100% 通过；invariant fuzz ≥ 1000 runs 无异常 |
| M2 | Arc testnet 部署 + verify + Pyth 地址确认 + seed 钱包准备 + 3 个初始市场 + 双边 seed 流动性 | **1.5-2 天** | Arcscan 源码可读；3 市场可见且 YES/NO 均非空 |
| M3 | 前端核心闭环（连钱包、市场列表、Bet Modal **两步签名**、claim、resolved 区） | **5-6 天** | 用户可完成 connect → approve → bet → resolve → claim 全流程 |
| M4 | 完整 UX（faucet 卡片、网络兜底页 `/connect`、深链 `/market/[id]`、响应式、移动端 QA） | **2-3 天** | 手动 QA 清单全过 |
| M5 | 运营脚本（`ResolveDueMarkets.s.sol` + cron README） + 监控 | **1-1.5 天** | cron 自动结算到期市场无遗漏 |
| M6 | 双 codex 并行 review 实现代码 + 修复 | **2-3 天** | 三方一致同意 |
| M7 | Vercel 部署 + 最终回归 | **0.5 天** | 生产 URL 可访问，QA 清单复跑 |

**总计：16-21 天**

里程碑被低估的常见点：Pyth/Arc 联调（MockPyth 不等于真实 Pyth）、RainbowKit 自定义链 + 双 decimals 反复 debug、移动钱包深链 QA。

### 7.6 仓库结构（codex 实现时遵循）

```
ArcPredict/
├── contracts/                            # Foundry 项目根
│   ├── foundry.toml
│   ├── remappings.txt                    # OpenZeppelin / forge-std / Pyth SDK 映射
│   ├── .env.example                      # PRIVATE_KEY / RPC_URL / PYTH_ADDR / USDC_ADDR / FEE_RECIPIENT
│   ├── src/
│   │   ├── PredictionMarket.sol
│   │   └── interfaces/
│   │       └── IPyth.sol                 # Pyth Network EVM interface（含 PythStructs）
│   ├── test/
│   │   ├── PredictionMarket.t.sol
│   │   ├── PredictionMarket.invariant.t.sol
│   │   └── mocks/
│   │       ├── MockUSDC.sol              # 6 decimals ERC-20，含恶意重入变体
│   │       └── MockPyth.sol              # 可控制 parsePriceFeedUpdatesUnique 返回 / revert
│   ├── script/
│   │   ├── Deploy.s.sol                  # 部署 + 把地址写到 web/lib/addresses.ts
│   │   ├── CreateMarket.s.sol            # owner 创建市场，含 threshold/expo 转换 helper：
│   │   │                                 #   function scale(int64 humanPrice, int32 feedExpo) → int64
│   │   │                                 #   示例：scale(70000, -8) == 70000_00000000 ← BTC ≥ $70,000
│   │   ├── SeedLiquidity.s.sol           # owner 双边各注 5 USDC 种子流动性
│   │   └── ops/                          # 运营脚本（M5 里程碑）
│   │       ├── ListMarkets.s.sol         # 列出市场 + 倒计时 + 状态
│   │       ├── ListResolvable.s.sol      # 筛选可结算市场
│   │       ├── ResolveDueMarkets.s.sol   # 拉 Pyth Hermes updateData + 批量 resolve
│   │       └── README.md                 # cron + 监控指南（每 30s 跑一次）
│   └── lib/                              # forge install 依赖（gitignored）
│
├── web/                                  # Next.js 14 项目根
│   ├── package.json
│   ├── pnpm-lock.yaml                    # 或 package-lock.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   ├── .env.example                      # NEXT_PUBLIC_WALLETCONNECT_ID / NEXT_PUBLIC_RPC_URL
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── providers.tsx                 # RainbowKit / wagmi（client-only）
│   │   ├── globals.css                   # Tailwind base + 设计 tokens（CSS 变量）
│   │   ├── page.tsx                      # 主页
│   │   ├── market/[id]/page.tsx
│   │   └── connect/page.tsx
│   ├── components/
│   │   ├── MarketCard.tsx
│   │   ├── BetModal.tsx                  # 两步签名 UX
│   │   ├── PositionList.tsx
│   │   ├── ResolvedList.tsx
│   │   ├── NetworkBanner.tsx
│   │   ├── WalletPill.tsx
│   │   ├── FaucetCard.tsx
│   │   └── ResolveCountdown.tsx
│   ├── lib/
│   │   ├── chain.ts                      # arcTestnet defineChain + USDC_DECIMALS=6 / NATIVE_VALUE_DECIMALS=18
│   │   ├── addresses.ts                  # 部署 script 自动生成
│   │   ├── abis/
│   │   │   ├── PredictionMarket.json
│   │   │   ├── ERC20.json
│   │   │   └── IPyth.json
│   │   ├── pyth.ts                       # Pyth Hermes 客户端封装
│   │   ├── format.ts                     # 6 decimals 格式化助手
│   │   └── derivePosition.ts             # 把 DashboardRow 派生成 UI 状态（Won/Lost/Claimable/Claimed）
│   └── public/
│
├── mockups/
│   └── preview.html                      # v0 视觉参考（含 Tweaks）
│
└── docs/superpowers/specs/
    └── 2026-06-07-arc-predict-design.md  # 本文档
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
- Pyth `parsePriceFeedUpdatesUnique`：https://api-reference.pyth.network/price-feeds/evm/parsePriceFeedUpdatesUnique
- Pyth Hermes 端点：https://hermes.pyth.network/docs/

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

---

### A.4 第二轮双 codex 评审（2026-06-07）

针对整合修订后的 spec 全文做对抗性审查，两路独立 codex：

- **Codex A**（合约审计 + 实施性）：**反对**。8 项 blocker，其中最严重的是 `updatePriceFeeds + getPriceUnsafe` 不能保证读到窗口内价格，应改用 `parsePriceFeedUpdatesUnique`
- **Codex B**（实施 + 产品 + 运营闭环）：**有条件同意**。8 项 blocker，其中最严重的是 chain 配置 `decimals: 18` 与 Arc 钱包文档推荐的 `6` 不符、approve+bet 表述误导、运营闭环缺失

### A.5 第二轮收敛后修订（已合并进文档）

| # | 修订项 | 落点 |
|---|---|---|
| ① | Pyth 改用 `parsePriceFeedUpdatesUnique` 严格窗口取值 | §4.2 resolve / §6.1 / §7.1 |
| ② | revert vs Invalid 边界明确化（可重试 vs 永久终态） | §4.2 / §6.1 |
| ③ | ChainList 1244 链接误指向（非 Arc Testnet），删除 | §8 |
| ④ | `MAX_MARKETS = 100` 实为总数，提到 1000 上限 + 文档措辞修正 | §3.2 / §3.3 / §4.1 |
| ⑤ | 补 `constructor` 签名 + 零地址校验 | §4.1 |
| ⑥ | 新增 `feeRecipientSnapshot` 字段（防 owner 中途改影响旧市场） | §4.1 / §4.2 / §6.1 |
| ⑦ | claim 错误语义固定：NotAWinner vs NoPayoutAvailable | §4.2 / §6.1 |
| ⑧ | chain `decimals: 6`，加 `NATIVE_VALUE_DECIMALS = 18` 严格分离 | §5.3 |
| ⑨ | "approve+bet 合并签名" 改为明确的两步签名 UX | §5.4 |
| ⑩ | 加 `getDashboard(user, from, toExclusive)` 一次 RPC 读首屏 | §4.2 / §5.2 |
| ⑪ | 补运营脚本目录 `contracts/script/ops/*` + cron 流程 | §6.4 / §7.5 / §7.6 |
| ⑫ | 加 seed 钱包双边流动性策略（每市场 ~5 USDC × 2） | §5.4 / §6.4 |
| ⑬ | 仓库结构补 globals.css / tsconfig / postcss / .env.example / lib/abis/ / addresses.ts | §7.6 |
| ⑭ | mockup UI 语义对齐（View on Arcscan → 用户地址过滤页） | §5.5 |
| ⑮ | 估时从 12.5-15.5 天调整到 16-21 天 | §7.5 |

### A.6 第二轮故意未采纳的建议

| 建议 | 理由 |
|---|---|
| 给 question 改 IPFS hash | MVP 200 字符够用，链上字符串成本可控 |
| 加 keeper 网络付 Pyth update fee | MVP 期 owner 单点运营足够 |
| 拆 `getDashboard` 进多个 view | 单接口闭包性更好，gas 限制内能容纳 |
| 给 feeBps 拆 setFeeBps + setFeeRecipient | 已经是分开的 |

---

### A.7 第三轮 codex 确认评审（2026-06-07）

针对 v2 spec 做"确认性"审查。Codex 结论：**反对**。指出 6 项未彻底解决、4 项 v2 引入的新问题、5 项隐藏隐患。

### A.8 第三轮收敛修订（已合并 → v3）

| # | 修订项 | 落点 |
|---|---|---|
| ① | 拆 `_quotePayout`（view 安全 / 不 revert）+ claim 错误优先级（NoPayoutAvailable > NotAWinner） | §4.2 |
| ② | `getDashboard` 同时返回 `totalCount`；新增 `getDashboardLatest(user, limit)` 取最新而非最老 | §4.2 / §5.2 |
| ③ | **新增 `forceInvalid(id)`**：`resolveAfter + 7 天` 后任何人可永久 Invalid 化（防 Pyth Hermes 长期失败资金锁死） | §4.1 / §4.2 / §6.1 |
| ④ | `MarketCreated` 事件加 `feeRecipientSnapshot` 字段 | §4.4 |
| ⑤ | 不变量措辞修正：`balanceOf ≥ Σ owed`；删"无外部调用入栈"错述；明确 resolve 外部调用风险界 | §4.5 |
| ⑥ | constructor 段补 `is Ownable2Step` 继承 + SafeERC20 import | §4.1 |
| ⑦ | CreateMarket.s.sol 加 threshold/expo 转换 helper 示例 | §7.6 |
| ⑧ | 错误清理：删 `MarketNotFound` `AmountOverflowsUint128`；加 `InvalidMarketId` `RefundFailed` `NotForceInvalidatableYet` | §4.3 |
| ⑨ | `MAX_QUESTION_LEN` 明确为 UTF-8 字节，前端按 `TextEncoder` 校验 | §4.1 / §6.5 |
| ⑩ | 历史保留风险措辞收紧："仓位永远可 claim，仅活动流水可能丢" | §6.5 |
| ⑪ | 显式声明 Pyth `conf` 不校验，MVP 接受 | §6.5 |

### A.9 第三轮故意未采纳的建议

| 建议 | 理由 |
|---|---|
| 校验 Pyth `conf` 置信区间 | MVP 选稳定 feed（BTC/ETH 主流）conf 极小，YAGNI |
| 给 dust sweep | 已显式接受，且 owner sweep 引入新攻击面 |
