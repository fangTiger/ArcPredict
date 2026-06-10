# ArcPredict MVP Implementation Plan v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.
> **v2 修订**：整合双 codex round 1 评审的 11 项 blocker + 3 项应改（命名漂移、重入测试设计、状态机竞争、cron ESM 配置、Deploy mkdir、scale 溢出保护、invariant 不吞错、Phase 14 historical update 兜底）

**Goal:** 在 Arc testnet 上交付一个支持真实用户下注的去中心化预测市场最小闭环（合约 + 前端 + 运营脚本 + Vercel 部署）。

**Architecture:** Solidity 合约（PredictionMarket，parimutuel 平分池，Pyth pull oracle，ERC-20 USDC 路径）+ Next.js 14 SPA（wagmi v2 + viem + RainbowKit + Tailwind，无后端，Multicall3 批量读链）+ Foundry 部署/运营脚本（cron 自动结算）。

**Tech Stack:** Solidity 0.8.24 / Foundry / OpenZeppelin v5 (Ownable2Step + SafeERC20) / Pyth Network / Next.js 14 App Router / TypeScript / wagmi v2 / viem / RainbowKit / Tailwind / Vercel

**Spec:** `docs/superpowers/specs/2026-06-07-arc-predict-design.md`（同目录上一级；含完整合约接口、错误清单、不变量、UX、运营、风险声明）

**全程约束**：
- 全程中文注释 + 中文 commit message
- 每个 task 结束都 commit（DRY/YAGNI/TDD/frequent commits）
- 任何步骤不通过先看 §故障排查节，再求助用户，禁止跳过
- 用户**已授权 codex-5.4**，找不到再用 codex-5.5

---

## File Structure

```
ArcPredict/
├── contracts/                                # Phase 0-9
│   ├── foundry.toml
│   ├── remappings.txt
│   ├── .env.example
│   ├── src/
│   │   ├── PredictionMarket.sol              # 唯一项目合约
│   │   └── interfaces/IPyth.sol              # Pyth EVM interface（含 PythStructs）
│   ├── test/
│   │   ├── PredictionMarket.t.sol            # 单元测试
│   │   ├── PredictionMarket.invariant.t.sol  # invariant fuzz
│   │   └── mocks/
│   │       ├── MockUSDC.sol                  # 6 decimals ERC-20，含恶意重入变体
│   │       └── MockPyth.sol                  # 可控 parsePriceFeedUpdatesUnique
│   └── script/
│       ├── Deploy.s.sol                      # 部署 + 写 web/lib/addresses.ts + abis/
│       ├── CreateMarket.s.sol                # 创建市场 + scale helper
│       ├── SeedLiquidity.s.sol               # 双边各 5 USDC 种子
│       └── ops/
│           ├── ListMarkets.s.sol
│           ├── ListResolvable.s.sol
│           ├── ResolveDueMarkets.s.sol
│           └── README.md                     # cron 配置
│
├── web/                                      # Phase 10-15
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── .env.example
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── providers.tsx                     # client-only
│   │   ├── globals.css
│   │   ├── page.tsx
│   │   ├── market/[id]/page.tsx
│   │   └── connect/page.tsx
│   ├── components/
│   │   ├── WalletPill.tsx
│   │   ├── NetworkBanner.tsx
│   │   ├── FaucetCard.tsx
│   │   ├── ResolveCountdown.tsx
│   │   ├── MarketCard.tsx
│   │   ├── BetModal.tsx                      # 两步签名
│   │   ├── PositionList.tsx
│   │   └── ResolvedList.tsx
│   └── lib/
│       ├── chain.ts
│       ├── addresses.ts                      # Deploy.s.sol 自动写
│       ├── abis/                             # Deploy.s.sol 自动写
│       │   ├── PredictionMarket.json
│       │   ├── ERC20.json
│       │   └── IPyth.json
│       ├── pyth.ts
│       ├── format.ts
│       └── derivePosition.ts
│
└── （已存在）mockups/preview.html
```

---

# Phase 0：项目脚手架

### Task 0.1: Foundry 项目初始化

**Files:**
- Create: `contracts/foundry.toml`
- Create: `contracts/remappings.txt`
- Create: `contracts/.env.example`
- Create: `contracts/.gitignore`

- [x] **Step 1: 初始化 Foundry 项目**

```bash
cd contracts
forge init --no-commit --no-git .
rm -rf src/Counter.sol test/Counter.t.sol script/Counter.s.sol
```

- [x] **Step 2: 安装依赖**

```bash
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge install pyth-network/pyth-sdk-solidity --no-commit
forge install foundry-rs/forge-std --no-commit
```

- [x] **Step 3: 写 `contracts/foundry.toml`**

```toml
[profile.default]
src         = "src"
out         = "out"
libs        = ["lib"]
solc        = "0.8.24"
optimizer   = true
optimizer_runs = 200
remappings_path = "remappings.txt"
fs_permissions = [{ access = "write", path = "../web/lib" }]
verbosity   = 2

[fuzz]
runs        = 256

[invariant]
runs        = 256
depth       = 32
fail_on_revert = false
```

- [x] **Step 4: 写 `contracts/remappings.txt`**

```
@openzeppelin/=lib/openzeppelin-contracts/
@pythnetwork/=lib/pyth-sdk-solidity/
forge-std/=lib/forge-std/src/
```

- [x] **Step 5: 写 `contracts/.env.example`**

```bash
# 部署私钥（owner 与 fee recipient 用不同地址）
OWNER_PRIVATE_KEY=
FEE_RECIPIENT=

# Arc Testnet
RPC_URL=https://rpc.testnet.arc.network
CHAIN_ID=5042002

# Arc Testnet 合约地址（部署前用 cast 确认）
USDC_ADDRESS=0x3600000000000000000000000000000000000000
PYTH_ADDRESS=                              # 待 cast 验证
MULTICALL3_ADDRESS=0xcA11bde05977b3631167028862bE2a173976CA11

# Pyth Hermes
PYTH_HERMES_ENDPOINT=https://hermes.pyth.network

# Pyth price IDs (https://www.pyth.network/developers/price-feed-ids)
PYTH_PRICE_ID_BTC_USD=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
PYTH_PRICE_ID_ETH_USD=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
```

- [x] **Step 6: 写 `contracts/.gitignore`**

```
cache/
out/
broadcast/
lib/
.env
```

- [x] **Step 7: 确认编译可通过**

```bash
cd contracts && forge build
```
Expected: `Compiler run successful!`（一开始 src 为空也会通过）

- [x] **Step 8: Commit**

```bash
git add contracts/foundry.toml contracts/remappings.txt contracts/.env.example contracts/.gitignore
git commit -m "chore(contracts): 初始化 Foundry 项目骨架与依赖"
```

---

### Task 0.2: Next.js 项目初始化

**Files:**
- Create: `web/package.json`、`web/next.config.js`、`web/tailwind.config.ts`、`web/postcss.config.js`、`web/tsconfig.json`、`web/.env.example`

- [x] **Step 1: 用 pnpm 初始化**

```bash
cd web
pnpm init
pnpm add next@14 react@18 react-dom@18 typescript @types/node @types/react @types/react-dom
pnpm add wagmi@^2 viem@^2 @rainbow-me/rainbowkit@^2 @tanstack/react-query
pnpm add @pythnetwork/hermes-client
pnpm add -D tailwindcss postcss autoprefixer eslint eslint-config-next
pnpm exec tailwindcss init -p
```

- [x] **Step 2: 写 `web/package.json` scripts 段**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  }
}
```

- [x] **Step 3: 写 `web/next.config.js`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};
module.exports = nextConfig;
```

- [x] **Step 4: 写 `web/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#ff6b35',
        yes: '#22c55e',
        no: '#ef4444',
        warning: '#f59e0b',
        base: '#0b0c0e',
        surface: '#14161a',
        elevated: '#1c1f24',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
```

- [x] **Step 5: 写 `web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [x] **Step 6: 写 `web/.env.example`**

```bash
# 公开变量（前端可读）
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_CHAIN_ID=5042002

# 合约地址（部署 script 自动写入 lib/addresses.ts，此 .env 仅留个备份）
NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS=
NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_PYTH_ADDRESS=

# Pyth
NEXT_PUBLIC_PYTH_HERMES_ENDPOINT=https://hermes.pyth.network
```

- [x] **Step 7: 确认 dev 起得来**

```bash
cd web && pnpm dev
```
Expected: 浏览器打开 http://localhost:3000 显示 Next.js 默认页

- [x] **Step 8: Commit**

```bash
git add web/
git commit -m "chore(web): 初始化 Next.js 14 + wagmi + RainbowKit + Tailwind 骨架"
```

---

### Task 0.3: 验证 Arc Testnet 外部依赖地址

**Files:**
- Create: `contracts/script/VerifyAddresses.s.sol`（一次性脚本）

- [x] **Step 1: 写验证脚本 `VerifyAddresses.s.sol`**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";

interface IERC20Min { function decimals() external view returns (uint8); function symbol() external view returns (string memory); }
interface IPythMin  { function getValidTimePeriod() external view returns (uint256); }

contract VerifyAddresses is Script {
    function run() external view {
        address usdc       = vm.envAddress("USDC_ADDRESS");
        address pyth       = vm.envAddress("PYTH_ADDRESS");
        address multicall3 = vm.envAddress("MULTICALL3_ADDRESS");

        console2.log("=== USDC ===");
        console2.log("decimals:", IERC20Min(usdc).decimals());           // 必须 == 6
        console2.log("symbol  :", IERC20Min(usdc).symbol());             // 必须 USDC

        console2.log("=== Pyth ===");
        console2.log("validPeriod:", IPythMin(pyth).getValidTimePeriod());

        console2.log("=== Multicall3 ===");
        uint256 size; assembly { size := extcodesize(multicall3) }
        require(size > 0, "Multicall3 not deployed");
        console2.log("Multicall3 code size:", size);
    }
}
```

- [x] **Step 2: 找出 Arc testnet 上 Pyth 实际地址**

参考 https://docs.pyth.network/price-feeds/core/contract-addresses/evm，找到 "Arc Network Testnet" 行。把它写进 `contracts/.env`（不是 .env.example）。

- [x] **Step 3: 跑脚本**

```bash
cd contracts
source .env
forge script script/VerifyAddresses.s.sol --rpc-url $RPC_URL
```
Expected: USDC decimals 输出 6，symbol 输出 USDC，Pyth validPeriod 输出非零，Multicall3 code size 非零。

如果任何一个失败：**停下来报告用户**，不要继续部署。

- [x] **Step 4: Commit**

```bash
git add contracts/script/VerifyAddresses.s.sol
git commit -m "chore(contracts): 加 Arc testnet 外部依赖地址验证脚本"
```

---

# Phase 1：合约骨架 + Mock

### Task 1.1: IPyth interface

**Files:**
- Create: `contracts/src/interfaces/IPyth.sol`

- [x] **Step 1: 写 interface（按 Pyth SDK 子集，避免引入完整 sdk）**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

library PythStructs {
    struct Price {
        int64  price;
        uint64 conf;
        int32  expo;
        uint256 publishTime;
    }
    struct PriceFeed {
        bytes32 id;
        Price   price;
        Price   emaPrice;
    }
}

interface IPyth {
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256);

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    ) external payable returns (PythStructs.PriceFeed[] memory priceFeeds);
}
```

- [x] **Step 2: 编译**

```bash
cd contracts && forge build
```
Expected: 编译通过。

- [x] **Step 3: Commit**

```bash
git add contracts/src/interfaces/IPyth.sol
git commit -m "feat(contracts): 加 Pyth interface（含 PythStructs）"
```

---

### Task 1.2: MockPyth

**Files:**
- Create: `contracts/test/mocks/MockPyth.sol`

- [x] **Step 1: 写 MockPyth**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IPyth, PythStructs } from "../../src/interfaces/IPyth.sol";

/// @dev 可控 Mock：通过 setter 设定下一次 parse 返回什么或 revert。
contract MockPyth is IPyth {
    uint256 public fee = 1 wei;

    bool    public shouldRevert;
    int64   public nextPrice;
    int32   public nextExpo;
    uint64  public nextPublishTime;
    uint64  public nextConf;

    function setFee(uint256 f) external { fee = f; }
    function setShouldRevert(bool v) external { shouldRevert = v; }
    function setNextPrice(int64 p, int32 e, uint64 pubTime, uint64 conf) external {
        nextPrice = p; nextExpo = e; nextPublishTime = pubTime; nextConf = conf;
    }

    function getUpdateFee(bytes[] calldata) external view returns (uint256) { return fee; }

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    ) external payable returns (PythStructs.PriceFeed[] memory feeds) {
        require(msg.value >= fee, "fee");
        if (shouldRevert) revert("MockPyth: forced revert");
        require(
            nextPublishTime >= minPublishTime && nextPublishTime <= maxPublishTime,
            "MockPyth: publishTime out of window"
        );
        feeds = new PythStructs.PriceFeed[](priceIds.length);
        for (uint i = 0; i < priceIds.length; i++) {
            feeds[i] = PythStructs.PriceFeed({
                id: priceIds[i],
                price: PythStructs.Price({
                    price: nextPrice, conf: nextConf, expo: nextExpo, publishTime: nextPublishTime
                }),
                emaPrice: PythStructs.Price({
                    price: nextPrice, conf: nextConf, expo: nextExpo, publishTime: nextPublishTime
                })
            });
        }
    }
}
```

- [x] **Step 2: 编译**

```bash
cd contracts && forge build
```

- [x] **Step 3: Commit**

```bash
git add contracts/test/mocks/MockPyth.sol
git commit -m "test(contracts): 加 MockPyth（可控价格/expo/publishTime/revert）"
```

---

### Task 1.3: MockUSDC

**Files:**
- Create: `contracts/test/mocks/MockUSDC.sol`

- [x] **Step 1: 写 MockUSDC（标准 ERC-20，加 mint，可触发重入）**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev 简化 ERC-20，6 decimals，免审计仅测试用。
contract MockUSDC is IERC20 {
    string public constant name = "USDC";
    string public constant symbol = "USDC";
    uint8  public constant decimals = 6;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public reentrancyCallback;             // 设了就在 transfer 之后 call 回去（测试重入）
    bytes   public reentrancyData;

    function setReentrancyCallback(address t, bytes calldata d) external {
        reentrancyCallback = t; reentrancyData = d;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "MockUSDC: allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "MockUSDC: balance");
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);

        if (reentrancyCallback != address(0) && to == reentrancyCallback) {
            address t = reentrancyCallback;
            bytes memory d = reentrancyData;
            reentrancyCallback = address(0);          // 防 dos
            (bool ok,) = t.call(d);
            require(ok, "MockUSDC: reentrancy call failed");
        }
    }
}
```

- [x] **Step 2: 编译**

```bash
cd contracts && forge build
```

- [x] **Step 3: Commit**

```bash
git add contracts/test/mocks/MockUSDC.sol
git commit -m "test(contracts): 加 MockUSDC（ERC-20 6 decimals + 重入测试入口）"
```

---

### Task 1.4: PredictionMarket 合约骨架

**Files:**
- Create: `contracts/src/PredictionMarket.sol`

- [x] **Step 1: 写状态 + 构造 + 错误 + 事件（不写函数体）**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Ownable }            from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step }       from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { SafeERC20, IERC20 }  from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IPyth, PythStructs } from "./interfaces/IPyth.sol";

/// @title ArcPredict 预测市场合约
/// @notice 基于 Arc testnet 的 parimutuel 平分池二元价格市场
contract PredictionMarket is Ownable2Step {
    using SafeERC20 for IERC20;

    // ============ 常量 ============
    uint256 public constant MAX_MARKETS         = 1000;
    uint128 public constant MIN_BET             = 1e5;            // 0.1 USDC
    uint16  public constant MAX_FEE_BPS         = 500;            // 5%
    uint64  public constant ORACLE_WINDOW       = 5 minutes;
    uint64  public constant FORCE_INVALID_DELAY = 7 days;
    uint256 public constant MAX_QUESTION_LEN    = 200;            // UTF-8 字节

    enum Outcome { Unresolved, Yes, No, Invalid }

    struct Market {
        bytes32 pythPriceId;
        int64   threshold;
        int32   thresholdExpo;
        uint64  betDeadline;
        uint64  resolveAfter;
        uint128 yesPool;
        uint128 noPool;
        uint128 winnerPool;
        uint128 protocolFee;
        uint16  feeBpsSnapshot;
        address feeRecipientSnapshot;
        Outcome outcome;
        int64   settlePrice;
        uint64  settleTime;
        string  question;
    }

    // ============ 存储 ============
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => uint128)) public yesStake;
    mapping(uint256 => mapping(address => uint128)) public noStake;
    mapping(uint256 => mapping(address => bool))    public claimed;
    uint256 public marketCount;

    address public feeRecipient;
    uint16  public feeBps = 100;                                  // 1%
    address public immutable USDC;
    address public immutable PYTH;

    // ============ 事件 ============
    event MarketCreated(
        uint256 indexed id, bytes32 indexed pythPriceId,
        int64 threshold, int32 thresholdExpo,
        uint64 betDeadline, uint64 resolveAfter,
        uint16 feeBpsSnapshot, address feeRecipientSnapshot,
        string question
    );
    event Bet(
        uint256 indexed id, address indexed user, bool yes,
        uint128 amount, uint128 yesPoolAfter, uint128 noPoolAfter
    );
    event Resolved(
        uint256 indexed id, Outcome outcome,
        int64 settlePrice, uint64 settleTime,
        uint128 winnerPool, uint128 protocolFee
    );
    event Claimed(uint256 indexed id, address indexed user, uint256 payout);

    // ============ 错误 ============
    error MarketLimitReached();
    error InvalidTimeOrder();
    error TimesInPast();
    error ZeroAddress();
    error FeeTooHigh();
    error QuestionTooLong();
    error InvalidPriceId();
    error BettingClosed();
    error BelowMinBet();
    error AlreadyResolved();
    error NotResolvableYet();
    error InsufficientPythFee();
    error InvalidOracleUpdate();
    error NotForceInvalidatableYet();
    error NotResolved();
    error AlreadyClaimed();
    error NotAWinner();
    error NoPayoutAvailable();
    error InvalidMarketId();
    error RefundFailed();

    // ============ 构造 ============
    constructor(
        address usdc, address pyth, address initialOwner, address initialFeeRecipient
    ) Ownable(initialOwner) {
        if (usdc == address(0) || pyth == address(0) ||
            initialOwner == address(0) || initialFeeRecipient == address(0)) revert ZeroAddress();
        USDC = usdc;
        PYTH = pyth;
        feeRecipient = initialFeeRecipient;
    }
}
```

- [x] **Step 2: 编译**

```bash
cd contracts && forge build
```
Expected: 编译通过（函数体后续 task 加）。

- [x] **Step 3: Commit**

```bash
git add contracts/src/PredictionMarket.sol
git commit -m "feat(contracts): PredictionMarket 骨架（state/events/errors/constructor）"
```

---

### Task 1.5: Foundry test 基础设施

**Files:**
- Create: `contracts/test/PredictionMarket.t.sol`（基础 setUp）

- [x] **Step 1: 写 setUp 模板**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test, console2 } from "forge-std/Test.sol";
import { PredictionMarket } from "../src/PredictionMarket.sol";
import { MockUSDC }         from "./mocks/MockUSDC.sol";
import { MockPyth }         from "./mocks/MockPyth.sol";
import { IPyth, PythStructs } from "../src/interfaces/IPyth.sol";

contract PredictionMarketTestBase is Test {
    PredictionMarket public market;
    MockUSDC         public usdc;
    MockPyth         public pyth;

    address public owner          = address(0xA001);
    address public feeRecipient   = address(0xA002);
    address public alice          = address(0xA101);
    address public bob            = address(0xA102);
    address public carol          = address(0xA103);

    bytes32 public constant PRICE_ID_BTC = bytes32(uint256(1));
    int32   public constant EXPO_8       = -8;

    function setUp() public virtual {
        usdc = new MockUSDC();
        pyth = new MockPyth();

        vm.prank(owner);
        market = new PredictionMarket(address(usdc), address(pyth), owner, feeRecipient);

        // 给三个测试用户各 mint 1000 USDC，approve max
        address[3] memory users = [alice, bob, carol];
        for (uint i = 0; i < 3; i++) {
            usdc.mint(users[i], 1_000_000_000);                  // 1000 USDC
            vm.prank(users[i]);
            usdc.approve(address(market), type(uint256).max);
            vm.deal(users[i], 10 ether);                         // gas 用 native
        }
    }

    // 注：_makeMarket 在 Task 2.1 实现 createMarket 后追加（见该 task Step 6）
}

contract PredictionMarketSmokeTest is PredictionMarketTestBase {
    function test_Deployment_SetsImmutables() public view {
        assertEq(market.USDC(),         address(usdc));
        assertEq(market.PYTH(),         address(pyth));
        assertEq(market.owner(),        owner);
        assertEq(market.feeRecipient(), feeRecipient);
        assertEq(market.feeBps(),       100);
        assertEq(market.marketCount(),  0);
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(PredictionMarket.ZeroAddress.selector);
        new PredictionMarket(address(0), address(pyth), owner, feeRecipient);
    }
}
```

注意：`_makeMarket` 现在调的 `createMarket` 函数还没实现，下个 task 加。这里先让 smoke test 通过。

- [x] **Step 2: 跑 smoke test**

```bash
cd contracts && forge test --match-contract PredictionMarketSmokeTest -v
```
Expected: 2 个测试 PASS（_makeMarket 不会被调因为没有测试调它）。

- [x] **Step 3: Commit**

```bash
git add contracts/test/PredictionMarket.t.sol
git commit -m "test(contracts): 加 TestBase + smoke test 验证部署"
```

---

# Phase 2：createMarket

### Task 2.1: createMarket happy path（TDD）

**Files:**
- Modify: `contracts/test/PredictionMarket.t.sol`（追加测试合约）
- Modify: `contracts/src/PredictionMarket.sol`（追加 createMarket）

- [x] **Step 1: 写失败测试**

在 `PredictionMarket.t.sol` 末尾追加：

```solidity
contract CreateMarketTest is PredictionMarketTestBase {
    function test_CreateMarket_HappyPath() public {
        vm.prank(owner);
        uint256 id = market.createMarket(
            PRICE_ID_BTC, 70000_00000000, EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1 minutes),
            "BTC >= 70k"
        );
        assertEq(id, 0);
        assertEq(market.marketCount(), 1);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(m.pythPriceId, PRICE_ID_BTC);
        assertEq(m.threshold,   70000_00000000);
        assertEq(m.thresholdExpo, EXPO_8);
        assertEq(m.feeBpsSnapshot, 100);
        assertEq(m.feeRecipientSnapshot, feeRecipient);
        assertEq(uint8(m.outcome), uint8(PredictionMarket.Outcome.Unresolved));
    }

    function test_CreateMarket_NonOwnerReverts() public {
        vm.prank(alice);
        vm.expectRevert();                                      // Ownable 错误（v5 自定义）
        market.createMarket(
            PRICE_ID_BTC, 70000_00000000, EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1 minutes),
            "x"
        );
    }
}
```

- [x] **Step 2: 跑测试确认失败**

```bash
cd contracts && forge test --match-contract CreateMarketTest -v
```
Expected: FAIL with "createMarket undefined" / `getMarket undefined`。

- [x] **Step 3: 实现 createMarket + getMarket**

在 `PredictionMarket.sol` 末尾（contract 内）加：

```solidity
    // ============ admin ============

    function createMarket(
        bytes32 pythPriceId,
        int64   threshold,
        int32   thresholdExpo,
        uint64  betDeadline,
        uint64  resolveAfter,
        string  calldata question
    ) external onlyOwner returns (uint256 id) {
        if (marketCount >= MAX_MARKETS) revert MarketLimitReached();
        if (betDeadline <= block.timestamp) revert TimesInPast();
        if (resolveAfter <= betDeadline) revert InvalidTimeOrder();
        if (bytes(question).length > MAX_QUESTION_LEN) revert QuestionTooLong();
        if (pythPriceId == bytes32(0)) revert InvalidPriceId();

        id = marketCount++;
        Market storage m = markets[id];
        m.pythPriceId          = pythPriceId;
        m.threshold            = threshold;
        m.thresholdExpo        = thresholdExpo;
        m.betDeadline          = betDeadline;
        m.resolveAfter         = resolveAfter;
        m.feeBpsSnapshot       = feeBps;
        m.feeRecipientSnapshot = feeRecipient;
        m.question             = question;

        emit MarketCreated(
            id, pythPriceId, threshold, thresholdExpo,
            betDeadline, resolveAfter, m.feeBpsSnapshot, m.feeRecipientSnapshot, question
        );
    }

    // ============ view ============

    function getMarket(uint256 id) external view returns (Market memory) {
        if (id >= marketCount) revert InvalidMarketId();
        return markets[id];
    }
```

- [x] **Step 4: 跑测试确认通过**

```bash
cd contracts && forge test --match-contract CreateMarketTest -v
```
Expected: 2 PASS。

- [x] **Step 5: 把 `_makeMarket` 追加到 `PredictionMarketTestBase`**

在 `PredictionMarketTestBase` 合约末尾追加：

```solidity
    function _makeMarket(int64 threshold, uint64 inHours) internal returns (uint256 id) {
        vm.prank(owner);
        id = market.createMarket(
            PRICE_ID_BTC, threshold, EXPO_8,
            uint64(block.timestamp + inHours * 1 hours),
            uint64(block.timestamp + inHours * 1 hours + 1 minutes),
            "Test market"
        );
    }
```

- [x] **Step 6: Commit**

```bash
git add contracts/src/PredictionMarket.sol contracts/test/PredictionMarket.t.sol
git commit -m "feat(contracts): 实现 createMarket + getMarket（TDD）"
```

---

### Task 2.2: createMarket 反向测试

- [x] **Step 1: 在 `CreateMarketTest` 合约末尾追加更多测试**

```solidity
    function test_CreateMarket_RevertsIfTimesInPast() public {
        vm.warp(100);
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.TimesInPast.selector);
        market.createMarket(PRICE_ID_BTC, 1, EXPO_8, 99, 200, "x");
    }

    function test_CreateMarket_RevertsIfInvalidTimeOrder() public {
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.InvalidTimeOrder.selector);
        market.createMarket(PRICE_ID_BTC, 1, EXPO_8,
            uint64(block.timestamp + 100),
            uint64(block.timestamp + 50), "x");
    }

    function test_CreateMarket_RevertsIfQuestionTooLong() public {
        bytes memory long = new bytes(201);
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.QuestionTooLong.selector);
        market.createMarket(PRICE_ID_BTC, 1, EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1),
            string(long));
    }

    function test_CreateMarket_RevertsIfPriceIdZero() public {
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.InvalidPriceId.selector);
        market.createMarket(bytes32(0), 1, EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1),
            "x");
    }

    function test_CreateMarket_RevertsIfMarketLimitReached() public {
        // 用 store 直接把 marketCount 写到上限
        vm.store(address(market), bytes32(uint256(4)),    // marketCount slot：依实际编译产物校对
                 bytes32(uint256(market.MAX_MARKETS())));
        vm.prank(owner);
        vm.expectRevert(PredictionMarket.MarketLimitReached.selector);
        market.createMarket(PRICE_ID_BTC, 1, EXPO_8,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 1 days + 1), "x");
    }

    function test_CreateMarket_SnapshotsFeeAcrossOwnerChange() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(owner); market.setFeeBps(300);            // 改全局
        vm.prank(owner); market.setFeeRecipient(alice);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(m.feeBpsSnapshot, 100, "old market keeps 100bps");
        assertEq(m.feeRecipientSnapshot, feeRecipient, "old market keeps old recipient");
    }
```

注意：`MarketLimitReached` 测试需要的 slot 编号要 `forge inspect` 后填，本 task 简化做法是后面 invariant 阶段再验，这里允许测试 skip（用 `vm.skip(true)` 或注释）。

- [x] **Step 2: 实现 setFeeBps / setFeeRecipient**

在 `PredictionMarket.sol` 加：

```solidity
    function setFeeBps(uint16 bps) external onlyOwner {
        if (bps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = bps;
    }

    function setFeeRecipient(address r) external onlyOwner {
        if (r == address(0)) revert ZeroAddress();
        feeRecipient = r;
    }
```

- [x] **Step 3: 跑测试**

```bash
cd contracts && forge test --match-contract CreateMarketTest -v
```
Expected: 全 PASS（除 MarketLimitReached 视处理而定）。

- [x] **Step 4: Commit**

```bash
git add contracts/src/PredictionMarket.sol contracts/test/PredictionMarket.t.sol
git commit -m "test(contracts): createMarket 反向 + snapshot + setFeeBps/Recipient"
```

---

# Phase 3：bet

### Task 3.1: bet 实现 + 测试

- [x] **Step 1: 失败测试**

```solidity
contract BetTest is PredictionMarketTestBase {
    function test_Bet_HappyPath_Yes() public {
        uint256 id = _makeMarket(70000_00000000, 24);

        vm.prank(alice);
        market.bet(id, true, 10_000_000);                  // 10 USDC YES

        (uint128 yes, uint128 no) = market.userStake(id, alice);
        assertEq(yes, 10_000_000);
        assertEq(no,  0);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(m.yesPool, 10_000_000);
        assertEq(m.noPool,  0);

        assertEq(usdc.balanceOf(alice), 1_000_000_000 - 10_000_000);
        assertEq(usdc.balanceOf(address(market)), 10_000_000);
    }

    function test_Bet_AccumulatesSameUser() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true, 3_000_000);
        vm.prank(alice); market.bet(id, true, 7_000_000);

        (uint128 yes,) = market.userStake(id, alice);
        assertEq(yes, 10_000_000);
    }

    function test_Bet_RevertsIfInvalidMarketId() public {
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.InvalidMarketId.selector);
        market.bet(99, true, 10_000_000);
    }

    function test_Bet_RevertsIfBelowMinBet() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.BelowMinBet.selector);
        market.bet(id, true, 1);
    }

    function test_Bet_RevertsAfterDeadline() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.warp(block.timestamp + 24 hours + 1);
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.BettingClosed.selector);
        market.bet(id, true, 1_000_000);
    }
}
```

- [x] **Step 2: 跑测试确认失败**

```bash
cd contracts && forge test --match-contract BetTest -v
```

- [x] **Step 3: 实现 bet + userStake**

```solidity
    function bet(uint256 id, bool yes, uint128 amount) external {
        if (id >= marketCount) revert InvalidMarketId();
        Market storage m = markets[id];
        if (m.outcome != Outcome.Unresolved) revert AlreadyResolved();
        if (block.timestamp >= m.betDeadline) revert BettingClosed();
        if (amount < MIN_BET) revert BelowMinBet();

        IERC20(USDC).safeTransferFrom(msg.sender, address(this), amount);

        if (yes) {
            m.yesPool += amount;
            yesStake[id][msg.sender] += amount;
        } else {
            m.noPool += amount;
            noStake[id][msg.sender] += amount;
        }
        emit Bet(id, msg.sender, yes, amount, m.yesPool, m.noPool);
    }

    function userStake(uint256 id, address u) external view returns (uint128 yes_, uint128 no_) {
        yes_ = yesStake[id][u];
        no_  = noStake[id][u];
    }
```

- [x] **Step 4: 跑测试**

```bash
cd contracts && forge test --match-contract BetTest -v
```
Expected: 全 PASS。

- [x] **Step 5: Commit**

```bash
git add contracts/src/PredictionMarket.sol contracts/test/PredictionMarket.t.sol
git commit -m "feat(contracts): 实现 bet + userStake（TDD）"
```

---

# Phase 4：resolve

### Task 4.1: resolve 正向路径

- [x] **Step 1: 失败测试**

```solidity
contract ResolveTest is PredictionMarketTestBase {
    function _setupAndBet() internal returns (uint256 id) {
        id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true, 100_000_000);    // 100 USDC YES
        vm.prank(bob);   market.bet(id, false, 50_000_000);    //  50 USDC NO
    }

    function _resolve(uint256 id, int64 price, uint64 ts) internal {
        pyth.setNextPrice(price, EXPO_8, ts, 0);
        bytes[] memory updateData = new bytes[](1);
        vm.warp(ts + 1);                                        // 进入窗口
        vm.deal(address(this), 1 ether);
        market.resolve{ value: 1 wei }(id, updateData);
    }

    function test_Resolve_Yes_WhenPriceAboveThreshold() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mBefore = market.getMarket(id);
        _resolve(id, 75000_00000000, mBefore.resolveAfter);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(uint8(m.outcome), uint8(PredictionMarket.Outcome.Yes));
        assertEq(m.settlePrice, 75000_00000000);
        // protocolFee = 50 USDC * 1% = 500_000
        assertEq(m.protocolFee, 500_000);
        // winnerPool = 100 + 50 - 0.5 = 149.5 USDC
        assertEq(m.winnerPool, 149_500_000);
        assertEq(usdc.balanceOf(feeRecipient), 500_000);
    }

    function test_Resolve_No_WhenPriceBelowThreshold() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mBefore = market.getMarket(id);
        _resolve(id, 60000_00000000, mBefore.resolveAfter);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(uint8(m.outcome), uint8(PredictionMarket.Outcome.No));
        // protocolFee = 100 USDC * 1% = 1_000_000
        assertEq(m.protocolFee, 1_000_000);
        // winnerPool = 50 + 100 - 1 = 149 USDC
        assertEq(m.winnerPool, 149_000_000);
    }

    function test_Resolve_YesAtExactThreshold() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mBefore = market.getMarket(id);
        _resolve(id, 70000_00000000, mBefore.resolveAfter);    // price == threshold → YES

        assertEq(uint8(market.getMarket(id).outcome), uint8(PredictionMarket.Outcome.Yes));
    }
}
```

- [x] **Step 2: 跑测试确认失败**

```bash
cd contracts && forge test --match-contract ResolveTest -v
```

- [x] **Step 3: 实现 resolve（核心逻辑）**

```solidity
    function resolve(uint256 id, bytes[] calldata updateData) external payable {
        if (id >= marketCount) revert InvalidMarketId();
        Market storage m = markets[id];
        if (m.outcome != Outcome.Unresolved) revert AlreadyResolved();
        if (block.timestamp < m.resolveAfter) revert NotResolvableYet();

        uint256 fee = IPyth(PYTH).getUpdateFee(updateData);
        if (msg.value < fee) revert InsufficientPythFee();

        bytes32[] memory ids = new bytes32[](1);
        ids[0] = m.pythPriceId;
        PythStructs.PriceFeed[] memory feeds = IPyth(PYTH).parsePriceFeedUpdatesUnique{value: fee}(
            updateData, ids, m.resolveAfter, m.resolveAfter + ORACLE_WINDOW
        );

        PythStructs.Price memory p = feeds[0].price;

        bool isInvalid = false;
        if (p.price <= 0) isInvalid = true;
        else if (p.expo != m.thresholdExpo) isInvalid = true;
        else if (m.yesPool + m.noPool == 0) isInvalid = true;

        Outcome o;
        uint128 winningPool;
        uint128 losingPool;
        if (!isInvalid) {
            o = (p.price >= m.threshold) ? Outcome.Yes : Outcome.No;
            winningPool = (o == Outcome.Yes) ? m.yesPool : m.noPool;
            losingPool  = (o == Outcome.Yes) ? m.noPool  : m.yesPool;
            if (winningPool == 0) { isInvalid = true; o = Outcome.Invalid; }
        }
        if (isInvalid) o = Outcome.Invalid;

        m.outcome = o;
        if (o != Outcome.Invalid) {
            m.settlePrice = p.price;
            m.settleTime  = uint64(p.publishTime);
            m.protocolFee = uint128(uint256(losingPool) * m.feeBpsSnapshot / 10000);
            m.winnerPool  = winningPool + losingPool - m.protocolFee;
            if (m.protocolFee > 0) {
                IERC20(USDC).safeTransfer(m.feeRecipientSnapshot, m.protocolFee);
            }
        }

        emit Resolved(id, m.outcome, m.settlePrice, m.settleTime, m.winnerPool, m.protocolFee);

        if (msg.value > fee) {
            (bool ok,) = msg.sender.call{value: msg.value - fee}("");
            if (!ok) revert RefundFailed();
        }
    }
```

- [x] **Step 4: 跑测试**

```bash
cd contracts && forge test --match-contract ResolveTest -v
```
Expected: 3 PASS。

- [x] **Step 5: Commit**

```bash
git add contracts/src/PredictionMarket.sol contracts/test/PredictionMarket.t.sol
git commit -m "feat(contracts): 实现 resolve 正向路径（YES/NO/exact-threshold）"
```

---

### Task 4.2: resolve Invalid 路径

- [x] **Step 1: 加测试**

```solidity
    function test_Resolve_Invalid_OnZeroTotalPool() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        PredictionMarket.Market memory mb = market.getMarket(id);
        _resolve(id, 75000_00000000, mb.resolveAfter);

        assertEq(uint8(market.getMarket(id).outcome), uint8(PredictionMarket.Outcome.Invalid));
        assertEq(market.getMarket(id).protocolFee, 0);
        assertEq(market.getMarket(id).winnerPool,  0);
    }

    function test_Resolve_Invalid_OnNegativePrice() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mb = market.getMarket(id);
        _resolve(id, -1, mb.resolveAfter);
        assertEq(uint8(market.getMarket(id).outcome), uint8(PredictionMarket.Outcome.Invalid));
    }

    function test_Resolve_Invalid_OnExpoMismatch() public {
        uint256 id = _setupAndBet();
        pyth.setNextPrice(75000_00000000, -6, uint64(market.getMarket(id).resolveAfter), 0);
        bytes[] memory data = new bytes[](1);
        vm.warp(market.getMarket(id).resolveAfter + 1);
        vm.deal(address(this), 1 ether);
        market.resolve{value: 1 wei}(id, data);
        assertEq(uint8(market.getMarket(id).outcome), uint8(PredictionMarket.Outcome.Invalid));
    }

    function test_Resolve_Invalid_OnOneSidedLosingPool() public {
        // 只有 NO 池有钱，结果是 YES → winningPool == 0 → Invalid
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, false, 10_000_000);
        PredictionMarket.Market memory mb = market.getMarket(id);
        _resolve(id, 75000_00000000, mb.resolveAfter);
        assertEq(uint8(market.getMarket(id).outcome), uint8(PredictionMarket.Outcome.Invalid));
    }
```

- [x] **Step 2: 跑测试**

```bash
cd contracts && forge test --match-contract ResolveTest -v
```
Expected: 已实现的逻辑应让上述测试 PASS。

- [x] **Step 3: Commit**

```bash
git add contracts/test/PredictionMarket.t.sol
git commit -m "test(contracts): resolve Invalid 路径全覆盖"
```

---

### Task 4.3: resolve revert 路径

- [x] **Step 1: 加测试**

```solidity
    function test_Resolve_RevertsIfBeforeResolveAfter() public {
        uint256 id = _setupAndBet();
        bytes[] memory data = new bytes[](1);
        vm.deal(address(this), 1 ether);
        vm.expectRevert(PredictionMarket.NotResolvableYet.selector);
        market.resolve{value: 1 wei}(id, data);
    }

    function test_Resolve_RevertsIfAlreadyResolved() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mb = market.getMarket(id);
        _resolve(id, 75000_00000000, mb.resolveAfter);

        bytes[] memory data = new bytes[](1);
        vm.expectRevert(PredictionMarket.AlreadyResolved.selector);
        market.resolve{value: 1 wei}(id, data);
    }

    function test_Resolve_RevertsOnInsufficientFee() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mb = market.getMarket(id);
        pyth.setFee(1 ether);
        pyth.setNextPrice(75000_00000000, EXPO_8, mb.resolveAfter, 0);

        bytes[] memory data = new bytes[](1);
        vm.warp(mb.resolveAfter + 1);
        vm.expectRevert(PredictionMarket.InsufficientPythFee.selector);
        market.resolve{value: 0}(id, data);
    }

    function test_Resolve_RevertsOnPythRevert() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mb = market.getMarket(id);
        pyth.setShouldRevert(true);
        pyth.setNextPrice(75000_00000000, EXPO_8, mb.resolveAfter, 0);

        bytes[] memory data = new bytes[](1);
        vm.warp(mb.resolveAfter + 1);
        vm.deal(address(this), 1 ether);
        vm.expectRevert();                                       // Pyth revert string
        market.resolve{value: 1 wei}(id, data);
    }

    function test_Resolve_RefundsExtraFee() public {
        uint256 id = _setupAndBet();
        PredictionMarket.Market memory mb = market.getMarket(id);
        pyth.setFee(1 wei);
        pyth.setNextPrice(75000_00000000, EXPO_8, mb.resolveAfter, 0);

        bytes[] memory data = new bytes[](1);
        vm.warp(mb.resolveAfter + 1);
        vm.deal(address(this), 1 ether);
        uint256 beforeBal = address(this).balance;
        market.resolve{value: 1 ether}(id, data);
        // 应该收到 1 ether - 1 wei 退款
        assertApproxEqAbs(address(this).balance, beforeBal - 1 wei, 0);
    }

    receive() external payable {}
```

- [x] **Step 2: 跑测试**

```bash
cd contracts && forge test --match-contract ResolveTest -v
```

- [x] **Step 3: Commit**

```bash
git add contracts/test/PredictionMarket.t.sol
git commit -m "test(contracts): resolve revert 路径 + extra fee refund"
```

---

# Phase 5：claim + _quotePayout

### Task 5.1: 实现 _quotePayout + pendingPayout

- [x] **Step 1: 失败测试**

```solidity
contract PendingPayoutTest is PredictionMarketTestBase {
    function test_PendingPayout_ZeroForUnresolved() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true, 10_000_000);
        assertEq(market.pendingPayout(id, alice), 0);
    }

    function test_PendingPayout_ZeroForLoser() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true, 10_000_000);
        vm.prank(bob);   market.bet(id, false, 10_000_000);
        // 强制结算 NO 赢
        PredictionMarket.Market memory mb = market.getMarket(id);
        pyth.setNextPrice(60000_00000000, EXPO_8, mb.resolveAfter, 0);
        vm.warp(mb.resolveAfter + 1);
        bytes[] memory data = new bytes[](1);
        vm.deal(address(this), 1 ether);
        market.resolve{value: 1 wei}(id, data);

        // alice 押 YES 输 → pendingPayout == 0（view 不 revert）
        assertEq(market.pendingPayout(id, alice), 0);
        // bob 押 NO 赢
        assertGt(market.pendingPayout(id, bob), 0);
    }

    function test_PendingPayout_ZeroForNoStakeUser() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true, 10_000_000);
        // carol 从未下注，view 应返回 0 不 revert
        assertEq(market.pendingPayout(id, carol), 0);
    }
}
```

- [x] **Step 2: 跑确认失败**

```bash
cd contracts && forge test --match-contract PendingPayoutTest -v
```

- [x] **Step 3: 实现**

在 `PredictionMarket.sol` 加：

```solidity
    function _quotePayout(uint256 id, address user) internal view returns (uint256) {
        Market storage m = markets[id];
        if (m.outcome == Outcome.Unresolved) return 0;

        uint128 ys = yesStake[id][user];
        uint128 ns = noStake[id][user];

        if (m.outcome == Outcome.Invalid) {
            return uint256(ys) + uint256(ns);
        }
        if (m.outcome == Outcome.Yes) {
            if (ys == 0) return 0;
            return uint256(ys) * m.winnerPool / m.yesPool;
        }
        // Outcome.No
        if (ns == 0) return 0;
        return uint256(ns) * m.winnerPool / m.noPool;
    }

    function pendingPayout(uint256 id, address u) external view returns (uint256) {
        if (id >= marketCount) revert InvalidMarketId();
        if (claimed[id][u]) return 0;
        return _quotePayout(id, u);
    }
```

- [x] **Step 4: 跑测试**

```bash
cd contracts && forge test --match-contract PendingPayoutTest -v
```
Expected: 全 PASS。

- [x] **Step 5: Commit**

```bash
git add contracts/src/PredictionMarket.sol contracts/test/PredictionMarket.t.sol
git commit -m "feat(contracts): _quotePayout + pendingPayout（view 永不 revert）"
```

---

### Task 5.2: 实现 claim 完整路径

- [x] **Step 1: 失败测试**

```solidity
contract ClaimTest is PredictionMarketTestBase {
    function _resolveYes(uint256 id) internal {
        PredictionMarket.Market memory mb = market.getMarket(id);
        pyth.setNextPrice(75000_00000000, EXPO_8, mb.resolveAfter, 0);
        vm.warp(mb.resolveAfter + 1);
        bytes[] memory data = new bytes[](1);
        vm.deal(address(this), 1 ether);
        market.resolve{value: 1 wei}(id, data);
    }

    function test_Claim_PayoutCorrect_YesWinner() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true,  100_000_000);
        vm.prank(bob);   market.bet(id, false,  50_000_000);
        _resolveYes(id);

        // YES 赢；winnerPool = 100+50-(50*1%)=149.5；alice 独占 → 149.5 USDC
        uint256 before_ = usdc.balanceOf(alice);
        vm.prank(alice); market.claim(id);
        assertEq(usdc.balanceOf(alice) - before_, 149_500_000);
        assertTrue(market.claimed(id, alice));
    }

    function test_Claim_FullRefund_OnInvalid() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true, 10_000_000);
        vm.prank(bob);   market.bet(id, false, 5_000_000);

        // 强制 Invalid：单边 NO 池为 0，结果 YES 赢但 NO 池 0 → 改判 Invalid
        // 这里让 NO 押注但 YES 没人押（反向 setup）
        uint256 id2 = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id2, false, 10_000_000);
        _resolveYes(id2);                                       // YES 赢但 YES 池 0 → Invalid

        uint256 before_ = usdc.balanceOf(alice);
        vm.prank(alice); market.claim(id2);
        assertEq(usdc.balanceOf(alice) - before_, 10_000_000);  // 全额退款
    }

    function test_Claim_RevertsForLoser() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true,  10_000_000);
        vm.prank(bob);   market.bet(id, false, 10_000_000);
        _resolveYes(id);

        vm.prank(bob);
        vm.expectRevert(PredictionMarket.NotAWinner.selector);
        market.claim(id);
    }

    function test_Claim_RevertsForNoStakeUser() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true, 10_000_000);
        _resolveYes(id);

        vm.prank(carol);
        vm.expectRevert(PredictionMarket.NoPayoutAvailable.selector);
        market.claim(id);
    }

    function test_Claim_RevertsIfNotResolved() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true, 10_000_000);
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.NotResolved.selector);
        market.claim(id);
    }

    function test_Claim_RevertsIfAlreadyClaimed() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true,  10_000_000);
        vm.prank(bob);   market.bet(id, false, 10_000_000);
        _resolveYes(id);
        vm.prank(alice); market.claim(id);
        vm.prank(alice);
        vm.expectRevert(PredictionMarket.AlreadyClaimed.selector);
        market.claim(id);
    }
}
```

- [x] **Step 2: 跑确认失败**

```bash
cd contracts && forge test --match-contract ClaimTest -v
```

- [x] **Step 3: 实现 claim**

```solidity
    function claim(uint256 id) external {
        if (id >= marketCount) revert InvalidMarketId();
        Market storage m = markets[id];
        if (m.outcome == Outcome.Unresolved) revert NotResolved();
        if (claimed[id][msg.sender]) revert AlreadyClaimed();

        uint128 ys = yesStake[id][msg.sender];
        uint128 ns = noStake[id][msg.sender];

        // 错误优先级
        if (ys == 0 && ns == 0) revert NoPayoutAvailable();
        if (m.outcome == Outcome.Yes && ys == 0) revert NotAWinner();
        if (m.outcome == Outcome.No  && ns == 0) revert NotAWinner();

        uint256 payout = _quotePayout(id, msg.sender);
        if (payout == 0) revert NoPayoutAvailable();             // 防御性

        claimed[id][msg.sender] = true;                          // CEI
        IERC20(USDC).safeTransfer(msg.sender, payout);
        emit Claimed(id, msg.sender, payout);
    }
```

- [x] **Step 4: 跑测试**

```bash
cd contracts && forge test --match-contract ClaimTest -v
```
Expected: 全 PASS。

- [x] **Step 5: Commit**

```bash
git add contracts/src/PredictionMarket.sol contracts/test/PredictionMarket.t.sol
git commit -m "feat(contracts): 实现 claim（错误优先级 + CEI）"
```

---

### Task 5.3: claim 重入测试

- [x] **Step 1: 写重入测试**

```solidity
    function test_Claim_PreventsReentrancy() public {
        // 部署恶意合约作为下注者（合约地址作为 USDC transfer 接收者时触发回调）
        ReentrantAttacker attacker = new ReentrantAttacker(market, usdc);
        usdc.mint(address(attacker), 100_000_000);
        attacker.approveMax();

        uint256 id = _makeMarket(70000_00000000, 24);
        attacker.placeBet(id, true, 100_000_000);                 // attacker 押 YES
        vm.prank(bob); market.bet(id, false, 50_000_000);
        _resolveYes(id);

        // attacker.claim 内部会被 USDC transfer 回调触发二次 claim，期望第二次因 AlreadyClaimed revert
        // 整笔交易因 MockUSDC 的 require(ok) 整体 revert，证明 CEI 阻断了重入获利
        vm.expectRevert();
        attacker.attackClaim(id);

        // 确认 attacker 实际拿不到任何额外 USDC（被 revert 滚回）
        assertEq(usdc.balanceOf(address(attacker)), 0);
    }
}

/// @dev 重入攻击辅助合约，必须放在测试文件末尾
contract ReentrantAttacker {
    PredictionMarket public market;
    MockUSDC public usdc;
    uint256 public attackId;
    bool public reentered;

    constructor(PredictionMarket m, MockUSDC u) { market = m; usdc = u; }

    function approveMax() external { usdc.approve(address(market), type(uint256).max); }

    function placeBet(uint256 id, bool yes, uint128 amount) external {
        market.bet(id, yes, amount);
    }

    function attackClaim(uint256 id) external {
        attackId = id;
        // 设回调：USDC transfer 到本合约时调 market.claim(id) 二次入场
        usdc.setReentrancyCallback(address(this), abi.encodeWithSignature("reenter()"));
        market.claim(id);
    }

    function reenter() external {
        reentered = true;
        market.claim(attackId);                                  // 第二次 claim，应 revert AlreadyClaimed
    }
}
```

- [x] **Step 2: 跑测试**

```bash
cd contracts && forge test --match-contract ClaimTest -v
```
Expected: 全 PASS。重入被 CEI 阻断。

- [x] **Step 3: Commit**

```bash
git add contracts/test/PredictionMarket.t.sol
git commit -m "test(contracts): claim 重入攻击被 CEI 阻断"
```

---

# Phase 6：forceInvalid + 复合 views

### Task 6.1: forceInvalid

- [x] **Step 1: 失败测试**

```solidity
contract ForceInvalidTest is PredictionMarketTestBase {
    function test_ForceInvalid_AfterDelay() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true,  10_000_000);
        vm.prank(bob);   market.bet(id, false, 10_000_000);

        PredictionMarket.Market memory m = market.getMarket(id);
        vm.warp(m.resolveAfter + 7 days + 1);

        vm.prank(carol);                                         // 任何人可触发
        market.forceInvalid(id);

        assertEq(uint8(market.getMarket(id).outcome), uint8(PredictionMarket.Outcome.Invalid));

        // 双方都能拿回本金
        uint256 a0 = usdc.balanceOf(alice);
        vm.prank(alice); market.claim(id);
        assertEq(usdc.balanceOf(alice) - a0, 10_000_000);
    }

    function test_ForceInvalid_RevertsBeforeDelay() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        PredictionMarket.Market memory m = market.getMarket(id);
        vm.warp(m.resolveAfter + 7 days - 1);
        vm.prank(carol);
        vm.expectRevert(PredictionMarket.NotForceInvalidatableYet.selector);
        market.forceInvalid(id);
    }

    function test_ForceInvalid_RevertsIfAlreadyResolved() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true, 10_000_000);
        vm.prank(bob);   market.bet(id, false, 10_000_000);

        PredictionMarket.Market memory m = market.getMarket(id);
        pyth.setNextPrice(75000_00000000, EXPO_8, m.resolveAfter, 0);
        vm.warp(m.resolveAfter + 1);
        bytes[] memory data = new bytes[](1);
        vm.deal(address(this), 1 ether);
        market.resolve{value: 1 wei}(id, data);

        vm.warp(m.resolveAfter + 7 days + 1);
        vm.prank(carol);
        vm.expectRevert(PredictionMarket.AlreadyResolved.selector);
        market.forceInvalid(id);
    }
}
```

- [x] **Step 2: 跑确认失败**

- [x] **Step 3: 实现**

```solidity
    function forceInvalid(uint256 id) external {
        if (id >= marketCount) revert InvalidMarketId();
        Market storage m = markets[id];
        if (m.outcome != Outcome.Unresolved) revert AlreadyResolved();
        if (block.timestamp < m.resolveAfter + FORCE_INVALID_DELAY) revert NotForceInvalidatableYet();

        m.outcome = Outcome.Invalid;
        emit Resolved(id, Outcome.Invalid, 0, 0, 0, 0);
    }
```

- [x] **Step 4: 跑测试**

```bash
cd contracts && forge test --match-contract ForceInvalidTest -v
```
Expected: 全 PASS。

- [x] **Step 5: Commit**

```bash
git add contracts/src/PredictionMarket.sol contracts/test/PredictionMarket.t.sol
git commit -m "feat(contracts): 实现 forceInvalid 7d 死锁逃生口"
```

---

### Task 6.2: 复合 views（getMarketsPaged / getDashboard / getDashboardLatest）

- [x] **Step 1: 加测试**

```solidity
contract ViewTest is PredictionMarketTestBase {
    function test_GetMarketsPaged_HalfOpenRange() public {
        for (uint i = 0; i < 5; i++) _makeMarket(int64(uint64(i+1)) * 1e8, uint64(i+1));
        PredictionMarket.Market[] memory ms = market.getMarketsPaged(1, 4);
        assertEq(ms.length, 3);
    }

    function test_GetDashboardLatest_ReturnsNewestFirst() public {
        for (uint i = 0; i < 5; i++) _makeMarket(int64(uint64(i+1)) * 1e8, uint64(i+1));
        (PredictionMarket.DashboardRow[] memory rows, uint256 total) =
            market.getDashboardLatest(alice, 3);
        assertEq(total, 5);
        assertEq(rows.length, 3);
        assertEq(rows[0].id, 4);                                 // 最新
        assertEq(rows[1].id, 3);
        assertEq(rows[2].id, 2);
    }

    function test_GetDashboard_IncludesUserStakeAndPayout() public {
        uint256 id = _makeMarket(70000_00000000, 24);
        vm.prank(alice); market.bet(id, true, 10_000_000);

        (PredictionMarket.DashboardRow[] memory rows, uint256 total) =
            market.getDashboard(alice, 0, 1);
        assertEq(total, 1);
        assertEq(rows[0].yesStake, 10_000_000);
        assertEq(rows[0].noStake, 0);
        assertEq(rows[0].pendingPayout, 0);                      // Unresolved → 0
        assertFalse(rows[0].claimedFlag);
    }
}
```

- [x] **Step 2: 实现 view 函数 + 结构**

在 `PredictionMarket.sol` 加：

```solidity
    struct DashboardRow {
        uint256 id;
        Market  market;                                          // 与 spec / 前端 type 命名严格一致
        uint128 yesStake;
        uint128 noStake;
        bool    claimedFlag;                                     // claimed 是状态 mapping 名，避免冲突
        uint256 pendingPayout;
    }

    function getMarketsPaged(uint256 from, uint256 toExclusive)
        external view returns (Market[] memory out)
    {
        if (toExclusive > marketCount || from > toExclusive) revert InvalidMarketId();
        out = new Market[](toExclusive - from);
        for (uint i = 0; i < out.length; i++) out[i] = markets[from + i];
    }

    function getDashboard(address user, uint256 from, uint256 toExclusive)
        external view returns (DashboardRow[] memory rows, uint256 totalCount)
    {
        if (toExclusive > marketCount || from > toExclusive) revert InvalidMarketId();
        totalCount = marketCount;
        rows = new DashboardRow[](toExclusive - from);
        for (uint i = 0; i < rows.length; i++) {
            uint256 id = from + i;
            rows[i] = DashboardRow({
                id: id,
                market: markets[id],
                yesStake: yesStake[id][user],
                noStake:  noStake[id][user],
                claimedFlag: claimed[id][user],
                pendingPayout: claimed[id][user] ? 0 : _quotePayout(id, user)
            });
        }
    }

    function getDashboardLatest(address user, uint256 limit)
        external view returns (DashboardRow[] memory rows, uint256 totalCount)
    {
        totalCount = marketCount;
        if (totalCount == 0) { rows = new DashboardRow[](0); return (rows, totalCount); }
        uint256 n = limit > totalCount ? totalCount : limit;
        rows = new DashboardRow[](n);
        for (uint i = 0; i < n; i++) {
            uint256 id = totalCount - 1 - i;                     // 倒序，最新在前
            rows[i] = DashboardRow({
                id: id,
                market: markets[id],
                yesStake: yesStake[id][user],
                noStake:  noStake[id][user],
                claimedFlag: claimed[id][user],
                pendingPayout: claimed[id][user] ? 0 : _quotePayout(id, user)
            });
        }
    }
```

- [x] **Step 3: 跑测试**

```bash
cd contracts && forge test --match-contract ViewTest -v
```
Expected: 全 PASS。

- [x] **Step 4: Commit**

```bash
git add contracts/src/PredictionMarket.sol contracts/test/PredictionMarket.t.sol
git commit -m "feat(contracts): 实现 getMarketsPaged / getDashboard / getDashboardLatest"
```

---

# Phase 7：Invariant 测试

### Task 7.1: 资金守恒不变量

**Files:**
- Create: `contracts/test/PredictionMarket.invariant.t.sol`

- [x] **Step 1: 写 invariant handler + test**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { PredictionMarket } from "../src/PredictionMarket.sol";
import { MockUSDC } from "./mocks/MockUSDC.sol";
import { MockPyth } from "./mocks/MockPyth.sol";

contract InvariantHandler is Test {
    PredictionMarket public market;
    MockUSDC public usdc;
    MockPyth public pyth;
    address[3] public actors = [address(0xB1), address(0xB2), address(0xB3)];

    uint256 public totalStaked;
    uint256 public totalPaid;
    uint256 public totalFees;

    constructor(PredictionMarket m, MockUSDC u, MockPyth p) {
        market = m; usdc = u; pyth = p;
        for (uint i; i < 3; i++) {
            usdc.mint(actors[i], 1_000_000_000_000);             // 1M USDC
            vm.prank(actors[i]); usdc.approve(address(market), type(uint256).max);
            vm.deal(actors[i], 100 ether);
        }
    }

    function _actor(uint256 seed) internal view returns (address) { return actors[seed % 3]; }

    // === 关键修订：handler 不再 try/catch 吞错 ===
    // 原则：先用 pre-condition 过滤掉本就该失败的调用（前面 if return），
    // 调用本身**必须成功**，否则就是合约真有问题 → invariant 该被 fuzzer 命中。

    function fuzz_bet(uint256 amount, uint8 side, uint256 actorSeed, uint256 marketIdSeed) external {
        if (market.marketCount() == 0) return;
        uint256 id = marketIdSeed % market.marketCount();
        amount = bound(amount, market.MIN_BET(), 100_000_000_000);
        address a = _actor(actorSeed);
        if (usdc.balanceOf(a) < amount) return;
        PredictionMarket.Market memory m = market.getMarket(id);
        if (m.outcome != PredictionMarket.Outcome.Unresolved) return;
        if (block.timestamp >= m.betDeadline) return;
        vm.prank(a);
        market.bet(id, side % 2 == 0, uint128(amount));          // 必须成功
        totalStaked += amount;
    }

    function fuzz_claim(uint256 actorSeed, uint256 marketIdSeed) external {
        if (market.marketCount() == 0) return;
        uint256 id = marketIdSeed % market.marketCount();
        address a = _actor(actorSeed);
        PredictionMarket.Market memory m = market.getMarket(id);
        if (m.outcome == PredictionMarket.Outcome.Unresolved) return;
        if (market.claimed(id, a)) return;
        (uint128 ys, uint128 ns) = market.userStake(id, a);
        if (ys == 0 && ns == 0) return;
        if (m.outcome == PredictionMarket.Outcome.Yes && ys == 0) return;
        if (m.outcome == PredictionMarket.Outcome.No  && ns == 0) return;
        uint256 before_ = usdc.balanceOf(a);
        vm.prank(a);
        market.claim(id);                                        // 必须成功
        totalPaid += usdc.balanceOf(a) - before_;
    }

    function timewarp_andResolve(uint8 marketIdSeed, int64 price) external {
        if (market.marketCount() == 0) return;
        uint256 id = marketIdSeed % market.marketCount();
        PredictionMarket.Market memory m = market.getMarket(id);
        if (m.outcome != PredictionMarket.Outcome.Unresolved) return;
        vm.warp(m.resolveAfter + 1);
        pyth.setNextPrice(price, m.thresholdExpo, m.resolveAfter, 0);
        bytes[] memory data = new bytes[](1);
        vm.deal(address(this), 1 ether);
        market.resolve{value: 1 wei}(id, data);                  // 必须成功
    }
}

contract PredictionMarketInvariantTest is Test {
    PredictionMarket public market;
    MockUSDC public usdc;
    MockPyth public pyth;
    InvariantHandler public handler;

    address public owner        = address(0xA001);
    address public feeRecipient = address(0xA002);
    bytes32 public constant PRICE_ID = bytes32(uint256(1));

    function setUp() public {
        usdc = new MockUSDC();
        pyth = new MockPyth();
        vm.prank(owner);
        market = new PredictionMarket(address(usdc), address(pyth), owner, feeRecipient);

        // 预创建 5 个市场
        for (uint i = 0; i < 5; i++) {
            vm.prank(owner);
            market.createMarket(PRICE_ID, int64(uint64(i+1)) * 1e8, -8,
                uint64(block.timestamp + (i+1) * 1 hours),
                uint64(block.timestamp + (i+1) * 1 hours + 1 minutes),
                "market");
        }

        handler = new InvariantHandler(market, usdc, pyth);
        targetContract(address(handler));
    }

    /// 资金守恒 strong：用 owed 真做约束
    /// 公式：contractBal == Σ owed_per_market - paid_already_to_users
    ///       ⇒ contractBal + totalPaid >= Σ owed（dust 可让 Σ owed 略小，所以用 >=）
    function invariant_FundsConservation_Strong() public view {
        uint256 contractBal = usdc.balanceOf(address(market));
        uint256 owed = 0;
        uint256 n = market.marketCount();
        for (uint256 id = 0; id < n; id++) {
            PredictionMarket.Market memory m = market.getMarket(id);
            if (m.outcome == PredictionMarket.Outcome.Unresolved) {
                owed += uint256(m.yesPool) + uint256(m.noPool);
            } else if (m.outcome == PredictionMarket.Outcome.Invalid) {
                owed += uint256(m.yesPool) + uint256(m.noPool);
            } else {
                owed += uint256(m.winnerPool);
            }
        }
        // contractBal + 已 claim = owed - dust 留库
        // → contractBal + paid >= owed - dustTolerance；MVP 取 dustTolerance = n（每市场 ≤ 1 wei）
        assertGe(contractBal + handler.totalPaid(), owed > n ? owed - n : 0);
        assertLe(contractBal + handler.totalPaid(), owed + 1);                // 不允许凭空多出钱
    }

    /// 单调性：fee 转出的 totalFees 必须 ≤ 所有市场创建时 losingPool snapshot * feeBpsSnapshot 上限
    function invariant_NoOverpayment() public view {
        // winnerPool 是 resolve 时锁定的，所有 claim 之和不应超过它
        uint256 n = market.marketCount();
        for (uint256 id = 0; id < n; id++) {
            PredictionMarket.Market memory m = market.getMarket(id);
            if (m.outcome == PredictionMarket.Outcome.Yes || m.outcome == PredictionMarket.Outcome.No) {
                // _quotePayout 是按比例分母 winningPool，不可能某用户单次超 winnerPool
                // 这里只能粗略断言：winnerPool ≤ yesPool + noPool
                assertLe(uint256(m.winnerPool), uint256(m.yesPool) + uint256(m.noPool));
            }
        }
    }
}
```

- [x] **Step 2: 跑 invariant**

```bash
cd contracts && forge test --match-contract PredictionMarketInvariantTest -v
```
Expected: PASS（runs=256, depth=32）。

- [x] **Step 3: 提高 runs 跑 1000 次确认**

```bash
cd contracts && FOUNDRY_INVARIANT_RUNS=1000 forge test --match-contract PredictionMarketInvariantTest
```

- [x] **Step 4: Commit**

```bash
git add contracts/test/PredictionMarket.invariant.t.sol
git commit -m "test(contracts): invariant 资金守恒（1000 runs 验证通过）"
```

---

# Phase 8：部署 + 运营脚本

### Task 8.1: Deploy.s.sol

**Files:**
- Create: `contracts/script/Deploy.s.sol`

- [x] **Step 1: 写部署脚本**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { PredictionMarket } from "../src/PredictionMarket.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk      = vm.envUint("OWNER_PRIVATE_KEY");
        address usdc    = vm.envAddress("USDC_ADDRESS");
        address pyth    = vm.envAddress("PYTH_ADDRESS");
        address feeRec  = vm.envAddress("FEE_RECIPIENT");
        address owner_  = vm.addr(pk);

        vm.startBroadcast(pk);
        PredictionMarket market = new PredictionMarket(usdc, pyth, owner_, feeRec);
        vm.stopBroadcast();

        console2.log("PredictionMarket deployed:", address(market));

        // 写 addresses.ts 给前端
        string memory ts = string.concat(
            "// Auto-generated by Deploy.s.sol\n",
            "export const PREDICTION_MARKET_ADDRESS = '", vm.toString(address(market)), "' as const;\n",
            "export const USDC_ADDRESS = '", vm.toString(usdc), "' as const;\n",
            "export const PYTH_ADDRESS = '", vm.toString(pyth), "' as const;\n"
        );
        vm.writeFile("../web/lib/addresses.ts", ts);

        // 关键：vm.writeFile 不会创建父目录，先确保 abis/ 存在
        vm.createDir("../web/lib/abis", true);

        // 写 ABI 三件套
        string memory marketAbi = vm.readFile("out/PredictionMarket.sol/PredictionMarket.json");
        vm.writeFile("../web/lib/abis/PredictionMarket.json", marketAbi);

        // ERC20 / IPyth ABI 由 codex 在 Task 12.1 手写最小 JSON 后 commit 到仓库；
        // 此处不覆盖，避免 Deploy 把它们清掉。
    }
}
```

- [x] **Step 2: 模拟跑（不真部署）**

```bash
cd contracts
source .env
forge script script/Deploy.s.sol --rpc-url $RPC_URL
```
Expected: 编译通过；显示 simulated deploy 输出。

- [x] **Step 3: Commit**

```bash
git add contracts/script/Deploy.s.sol
git commit -m "feat(contracts): 加 Deploy.s.sol（部署 + 自动写 web/lib/addresses+abi）"
```

---

### Task 8.2: CreateMarket.s.sol（含 scale helper）

**Files:**
- Create: `contracts/script/CreateMarket.s.sol`

- [x] **Step 1: 写脚本**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { PredictionMarket } from "../src/PredictionMarket.sol";

/// @dev 用法：env 指定 PREDICTION_MARKET、PYTH_PRICE_ID、HUMAN_THRESHOLD、FEED_EXPO、
///       HOURS_TO_BET_DEADLINE、HOURS_TO_RESOLVE_AFTER、QUESTION
contract CreateMarket is Script {
    /// @notice 把人类阈值（如 70000）按 Pyth feed expo 缩放
    /// @dev    scale(70000, -8) == 70000_00000000
    function scale(int64 human, int32 feedExpo) internal pure returns (int64) {
        // expo 范围严格收敛，避免 -feedExpo 在 int32.min 时一元负溢出 / 10**N 爆 int64
        require(feedExpo <= 0 && feedExpo >= -18, "feedExpo must be in [-18, 0]");
        require(human > 0, "human must be > 0");
        int256 mul = int256(10) ** uint256(uint32(-feedExpo));
        int256 scaled = int256(human) * mul;
        require(scaled <= type(int64).max, "scaled overflow int64");
        return int64(scaled);
    }

    function run() external {
        uint256 pk = vm.envUint("OWNER_PRIVATE_KEY");
        address mkt = vm.envAddress("PREDICTION_MARKET");
        bytes32 priceId = vm.envBytes32("PYTH_PRICE_ID");
        int64 human = int64(vm.envInt("HUMAN_THRESHOLD"));
        int32 expo  = int32(int256(vm.envInt("FEED_EXPO")));
        uint64 dlHrs = uint64(vm.envUint("HOURS_TO_BET_DEADLINE"));
        uint64 raHrs = uint64(vm.envUint("HOURS_TO_RESOLVE_AFTER"));
        string memory q = vm.envString("QUESTION");

        vm.startBroadcast(pk);
        uint256 id = PredictionMarket(mkt).createMarket(
            priceId, scale(human, expo), expo,
            uint64(block.timestamp + dlHrs * 1 hours),
            uint64(block.timestamp + raHrs * 1 hours),
            q
        );
        vm.stopBroadcast();
        console2.log("Created market id:", id);
    }
}
```

- [x] **Step 2: 编译**

```bash
cd contracts && forge build
```

- [x] **Step 3: Commit**

```bash
git add contracts/script/CreateMarket.s.sol
git commit -m "feat(contracts): CreateMarket.s.sol 含 scale(human, expo) helper"
```

---

### Task 8.3: SeedLiquidity.s.sol

**Files:**
- Create: `contracts/script/SeedLiquidity.s.sol`

- [x] **Step 1: 写脚本**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { PredictionMarket } from "../src/PredictionMarket.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SeedLiquidity is Script {
    function run() external {
        uint256 pk     = vm.envUint("OWNER_PRIVATE_KEY");        // seed 钱包，建议独立
        address mkt    = vm.envAddress("PREDICTION_MARKET");
        address usdc   = vm.envAddress("USDC_ADDRESS");
        uint256 id     = vm.envUint("MARKET_ID");
        uint128 amount = uint128(vm.envUint("SEED_AMOUNT"));     // 默认 5e6 (5 USDC)

        vm.startBroadcast(pk);
        IERC20(usdc).approve(mkt, type(uint256).max);
        PredictionMarket(mkt).bet(id, true,  amount);            // YES
        PredictionMarket(mkt).bet(id, false, amount);            // NO
        vm.stopBroadcast();
        console2.log("Seeded market", id, "with 2x", amount);
    }
}
```

- [x] **Step 2: 编译 + Commit**

```bash
cd contracts && forge build
git add contracts/script/SeedLiquidity.s.sol
git commit -m "feat(contracts): SeedLiquidity.s.sol 双边 5 USDC 种子"
```

---

# Phase 9：部署到 Arc Testnet

### Task 9.1: 部署前最终检查

- [x] **Step 1: 准备 `.env`**（不进 git）

填入真实私钥、Pyth 地址、fee recipient（独立 EOA）。

- [x] **Step 2: 跑 VerifyAddresses**

```bash
cd contracts
source .env
forge script script/VerifyAddresses.s.sol --rpc-url $RPC_URL
```
Expected: 全部通过。

- [x] **Step 3: 全测过一遍**

```bash
forge test
```
Expected: 全 PASS（包含 invariant）。

- [x] **Step 4: Commit `.env.example`（不是 `.env`）的最新值**

如有更新；否则跳过。

---

### Task 9.2: 部署 + verify + 创建 + seed

- [x] **Step 1: 部署**

```bash
cd contracts
source .env
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url https://testnet.arcscan.app/api
```

记录输出的 `PredictionMarket deployed: 0x...` 地址，存进 `.env`：`PREDICTION_MARKET=0x...`。

- [x] **Step 2: 验证 `web/lib/addresses.ts` 和 `web/lib/abis/PredictionMarket.json` 已被写**

- [x] **Step 3: Arcscan 上确认 verified**

打开 `https://testnet.arcscan.app/address/<合约地址>`，源码应可读。

- [x] **Step 4: 创建 3 个初始市场**

```bash
# 市场 1：BTC ≥ 70000 in 24h
PREDICTION_MARKET=$PREDICTION_MARKET \
PYTH_PRICE_ID=$PYTH_PRICE_ID_BTC_USD \
HUMAN_THRESHOLD=70000 FEED_EXPO=-8 \
HOURS_TO_BET_DEADLINE=24 HOURS_TO_RESOLVE_AFTER=25 \
QUESTION="BTC/USD >= 70000 in 24h" \
forge script script/CreateMarket.s.sol --rpc-url $RPC_URL --broadcast

# 市场 2：ETH ≥ 4000 in 48h（同样）
# 市场 3：BTC ≥ 75000 in 7d
```

- [x] **Step 5: 给每个市场 seed 双边各 5 USDC**

```bash
# 先 mint / faucet 给 seed 钱包足够 USDC，然后：
MARKET_ID=0 SEED_AMOUNT=5000000 forge script script/SeedLiquidity.s.sol --rpc-url $RPC_URL --broadcast
MARKET_ID=1 SEED_AMOUNT=5000000 forge script script/SeedLiquidity.s.sol --rpc-url $RPC_URL --broadcast
MARKET_ID=2 SEED_AMOUNT=5000000 forge script script/SeedLiquidity.s.sol --rpc-url $RPC_URL --broadcast
```

- [x] **Step 6: Commit 部署产物**

```bash
git add web/lib/addresses.ts web/lib/abis/PredictionMarket.json
git commit -m "deploy: PredictionMarket 部署到 Arc testnet + 3 个初始市场 seed"
```

---

# Phase 10：前端 lib

### Task 10.1: chain.ts + format.ts

**Files:**
- Create: `web/lib/chain.ts`、`web/lib/format.ts`

- [x] **Step 1: 写 chain.ts**

```ts
import { defineChain } from 'viem';

export const USDC_DECIMALS = 6;
export const NATIVE_VALUE_DECIMALS = 18;

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: USDC_DECIMALS },
  rpcUrls: { default: { http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'Arcscan', url: 'https://testnet.arcscan.app' } },
  contracts: {
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' as const },
  },
  testnet: true,
});
```

- [x] **Step 2: 写 format.ts**

```ts
import { formatUnits, parseUnits } from 'viem';
import { USDC_DECIMALS } from './chain';

export const fmtUsdc = (raw: bigint, max = 2) =>
  Number(formatUnits(raw, USDC_DECIMALS)).toLocaleString('en-US', { maximumFractionDigits: max });

export const parseUsdc = (s: string) => parseUnits(s, USDC_DECIMALS);

export const truncateAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const fmtCountdown = (target: bigint, now: bigint) => {
  const diff = Number(target - now);
  if (diff <= 0) return 'Closed';
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};
```

- [x] **Step 3: Commit**

```bash
git add web/lib/chain.ts web/lib/format.ts
git commit -m "feat(web): chain.ts + format.ts（USDC 6 decimals + 倒计时）"
```

---

### Task 10.2: pyth.ts（Hermes 客户端）

**Files:**
- Create: `web/lib/pyth.ts`

- [x] **Step 1: 写 pyth.ts**

```ts
import { HermesClient } from '@pythnetwork/hermes-client';

const HERMES = process.env.NEXT_PUBLIC_PYTH_HERMES_ENDPOINT || 'https://hermes.pyth.network';

const client = new HermesClient(HERMES);

/// 拉某 priceId 在某 timestamp 附近的 update data（hex 数组）
export async function getPriceUpdateAtTime(priceId: `0x${string}`, publishTime: number): Promise<`0x${string}`[]> {
  const res = await client.getPriceUpdatesAtTimestamp(publishTime, [priceId], {
    encoding: 'hex',
    parsed: false,
  });
  return res.binary.data.map((s) => (`0x${s}`) as `0x${string}`);
}

/// 拉某 priceId 当前最新 update data
export async function getLatestPriceUpdate(priceId: `0x${string}`): Promise<`0x${string}`[]> {
  const res = await client.getLatestPriceUpdates([priceId], { encoding: 'hex', parsed: false });
  return res.binary.data.map((s) => (`0x${s}`) as `0x${string}`);
}
```

- [x] **Step 2: typecheck**

```bash
cd web && pnpm typecheck
```

- [x] **Step 3: Commit**

```bash
git add web/lib/pyth.ts
git commit -m "feat(web): pyth.ts Hermes 客户端封装"
```

---

### Task 10.3: derivePosition.ts

**Files:**
- Create: `web/lib/derivePosition.ts`

- [x] **Step 1: 写文件**

```ts
export type Outcome = 'Unresolved' | 'Yes' | 'No' | 'Invalid';

export type Market = {
  pythPriceId: `0x${string}`;
  threshold: bigint;
  thresholdExpo: number;
  betDeadline: bigint;
  resolveAfter: bigint;
  yesPool: bigint;
  noPool: bigint;
  winnerPool: bigint;
  protocolFee: bigint;
  feeBpsSnapshot: number;
  feeRecipientSnapshot: `0x${string}`;
  outcome: number;                                              // enum index
  settlePrice: bigint;
  settleTime: bigint;
  question: string;
};

export type DashboardRow = {
  id: bigint;
  market: Market;
  yesStake: bigint;
  noStake: bigint;
  claimedFlag: boolean;                                       // 与合约 struct 字段名严格一致
  pendingPayout: bigint;
};

export const OUTCOMES: Outcome[] = ['Unresolved', 'Yes', 'No', 'Invalid'];

export type Status = 'active' | 'resolving' | 'awaiting' | 'resolved' | 'force-invalidatable';

export function deriveStatus(row: DashboardRow, now: bigint): Status {
  const m = row.market;
  if (m.outcome !== 0) return 'resolved';
  if (now < m.resolveAfter) return 'active';
  if (now < m.resolveAfter + 300n) return 'resolving';
  if (now < m.resolveAfter + 7n * 24n * 3600n) return 'awaiting';
  return 'force-invalidatable';
}

export type UserPosition = 'none' | 'yes' | 'no' | 'both';
export const userPositionOf = (row: DashboardRow): UserPosition => {
  if (row.yesStake > 0n && row.noStake > 0n) return 'both';
  if (row.yesStake > 0n) return 'yes';
  if (row.noStake > 0n) return 'no';
  return 'none';
};

export const userIsWinner = (row: DashboardRow): boolean => {
  const o = OUTCOMES[row.market.outcome];
  if (o === 'Invalid') return row.yesStake > 0n || row.noStake > 0n;
  if (o === 'Yes') return row.yesStake > 0n;
  if (o === 'No')  return row.noStake > 0n;
  return false;
};

export const yesPercent = (m: Market): number => {
  const total = m.yesPool + m.noPool;
  if (total === 0n) return 50;
  return Number((m.yesPool * 10000n) / total) / 100;
};
```

- [x] **Step 2: Commit**

```bash
git add web/lib/derivePosition.ts
git commit -m "feat(web): derivePosition.ts UI 状态派生"
```

---

# Phase 11：providers + globals

### Task 11.1: providers.tsx + layout

**Files:**
- Create: `web/app/providers.tsx`
- Create: `web/app/layout.tsx`
- Create: `web/app/globals.css`

- [x] **Step 1: providers.tsx（client-only）**

```tsx
'use client';

import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { arcTestnet } from '@/lib/chain';
import '@rainbow-me/rainbowkit/styles.css';

const config = getDefaultConfig({
  appName: 'ArcPredict',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'placeholder',
  chains: [arcTestnet],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: '#ff6b35' })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

- [x] **Step 2: layout.tsx**

```tsx
import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'ArcPredict',
  description: 'Bet on what the market actually thinks. Built on Arc.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-base text-zinc-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [x] **Step 3: globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: 'Geist', system-ui, sans-serif;
  font-variant-numeric: tabular-nums;
  text-wrap: pretty;
}

.font-mono { font-family: 'Geist Mono', monospace; letter-spacing: 0; }
```

- [x] **Step 4: 跑 dev 看是否能跑**

```bash
cd web && pnpm dev
```

- [x] **Step 5: Commit**

```bash
git add web/app/providers.tsx web/app/layout.tsx web/app/globals.css
git commit -m "feat(web): RainbowKit Providers + layout + globals"
```

---

# Phase 12：组件

### Task 12.1: WalletPill + NetworkBanner + FaucetCard

**Files:**
- Create: `web/components/WalletPill.tsx`
- Create: `web/components/NetworkBanner.tsx`
- Create: `web/components/FaucetCard.tsx`

- [x] **Step 1: WalletPill.tsx**

```tsx
'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { USDC_ADDRESS } from '@/lib/addresses';
import { fmtUsdc } from '@/lib/format';
import ERC20Abi from '@/lib/abis/ERC20.json';

export function WalletPill() {
  const { address } = useAccount();
  const { data: bal } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  return (
    <div className="flex items-center gap-3">
      {address && (
        <span className="text-sm text-zinc-400 font-mono">
          {fmtUsdc((bal as bigint) ?? 0n)} USDC
        </span>
      )}
      <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
    </div>
  );
}
```

- [x] **Step 2: NetworkBanner.tsx**

```tsx
'use client';

import { useAccount, useSwitchChain } from 'wagmi';
import { arcTestnet } from '@/lib/chain';

export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  if (!isConnected || chainId === arcTestnet.id) return null;

  return (
    <div className="bg-no/20 border-b border-no/40 text-no px-4 py-2 text-center text-sm">
      你当前不在 Arc Testnet。{' '}
      <button onClick={() => switchChain({ chainId: arcTestnet.id })} className="underline font-medium">
        切换到 Arc Testnet
      </button>
    </div>
  );
}
```

- [x] **Step 3: FaucetCard.tsx**

```tsx
'use client';

import { useAccount, useReadContract } from 'wagmi';
import { USDC_ADDRESS } from '@/lib/addresses';
import ERC20Abi from '@/lib/abis/ERC20.json';

export function FaucetCard() {
  const { address, isConnected } = useAccount();
  const { data: bal } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // bal 在加载前是 undefined，要先做存在性判断
  const balBn = (bal as bigint | undefined) ?? 0n;
  if (!isConnected || balBn > 0n) return null;

  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 my-6">
      <div className="text-warning font-semibold mb-1">需要 testnet USDC</div>
      <div className="text-zinc-400 text-sm mb-3">
        在 Arc 上 USDC 同时是下注本金和 gas。去 Circle Faucet 领取（同时取一点 native 用作 Pyth update fee）：
      </div>
      <a
        href="https://faucet.circle.com"
        target="_blank"
        rel="noopener"
        className="inline-block bg-warning text-base font-semibold px-4 py-2 rounded-lg"
      >
        前往 Circle Faucet →
      </a>
    </div>
  );
}
```

- [x] **Step 4: 准备 ERC20Abi**

```bash
# 用 Foundry 出 ABI（最简单是手写一份 minimal）
```

写 `web/lib/abis/ERC20.json`：

```json
[
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"}
]
```

- [x] **Step 5: Commit**

```bash
git add web/components/WalletPill.tsx web/components/NetworkBanner.tsx web/components/FaucetCard.tsx web/lib/abis/ERC20.json
git commit -m "feat(web): WalletPill + NetworkBanner + FaucetCard"
```

---

### Task 12.2: MarketCard + ResolveCountdown

**Files:**
- Create: `web/components/MarketCard.tsx`
- Create: `web/components/ResolveCountdown.tsx`

- [x] **Step 1: ResolveCountdown.tsx**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { fmtCountdown } from '@/lib/format';
import type { DashboardRow } from '@/lib/derivePosition';
import { deriveStatus } from '@/lib/derivePosition';

export function ResolveCountdown({ row }: { row: DashboardRow }) {
  const [now, setNow] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  useEffect(() => {
    const t = setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 1000);
    return () => clearInterval(t);
  }, []);
  const status = deriveStatus(row, now);

  if (status === 'active')   return <span className="text-warning font-mono text-xs">Closes in {fmtCountdown(row.market.betDeadline, now)}</span>;
  if (status === 'resolving') return <span className="text-warning font-mono text-xs">Resolving window open</span>;
  if (status === 'awaiting')  return <span className="text-zinc-500 font-mono text-xs">Awaiting resolution</span>;
  if (status === 'force-invalidatable') return <span className="text-zinc-500 font-mono text-xs">Force-invalidatable</span>;
  return <span className="text-zinc-500 font-mono text-xs">Resolved</span>;
}
```

- [x] **Step 2: MarketCard.tsx**

```tsx
'use client';

import type { DashboardRow } from '@/lib/derivePosition';
import { yesPercent, OUTCOMES } from '@/lib/derivePosition';
import { fmtUsdc } from '@/lib/format';
import { ResolveCountdown } from './ResolveCountdown';

export function MarketCard({ row, onBet }: { row: DashboardRow; onBet: (id: bigint, yes: boolean) => void }) {
  const m = row.market;
  const yesPct = yesPercent(m);
  const noPct = 100 - yesPct;
  const totalPool = m.yesPool + m.noPool;
  const outcome = OUTCOMES[m.outcome];
  const isActive = outcome === 'Unresolved';

  return (
    <article className="bg-surface border border-white/[0.06] rounded-2xl p-6 hover:border-white/[0.12] transition">
      <div className="flex justify-between items-center text-xs text-zinc-500 mb-3">
        <span className="font-mono">Pyth feed</span>
        <ResolveCountdown row={row} />
      </div>
      <div className="text-lg font-medium mb-4 leading-snug">{m.question}</div>
      <div className="flex gap-6 mb-4">
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Pool</div>
          <div className="font-mono text-lg">{fmtUsdc(totalPool)} USDC</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Implied YES</div>
          <div className="font-mono text-lg">{yesPct.toFixed(0)}%</div>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-no/20 overflow-hidden mb-4">
        <div className="h-full bg-yes transition-all" style={{ width: `${yesPct}%` }} />
      </div>
      {isActive ? (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => onBet(row.id, true)}
            className="bg-yes/10 text-yes border border-yes/40 hover:bg-yes/20 px-4 py-3 rounded-xl font-medium flex justify-between items-center">
            Bet YES <span className="font-mono text-xs opacity-80">{yesPct.toFixed(0)}%</span>
          </button>
          <button onClick={() => onBet(row.id, false)}
            className="bg-no/10 text-no border border-no/40 hover:bg-no/20 px-4 py-3 rounded-xl font-medium flex justify-between items-center">
            Bet NO <span className="font-mono text-xs opacity-80">{noPct.toFixed(0)}%</span>
          </button>
        </div>
      ) : (
        <div className="text-sm text-zinc-500">Outcome: {outcome}</div>
      )}
    </article>
  );
}
```

- [x] **Step 3: Commit**

```bash
git add web/components/ResolveCountdown.tsx web/components/MarketCard.tsx
git commit -m "feat(web): MarketCard + ResolveCountdown（含池子条 + 倒计时）"
```

---

### Task 12.3: BetModal（两步签名）

**Files:**
- Create: `web/components/BetModal.tsx`

- [x] **Step 1: 写 BetModal（核心：approve → bet 两步）**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { parseUsdc, fmtUsdc } from '@/lib/format';
import { PREDICTION_MARKET_ADDRESS, USDC_ADDRESS } from '@/lib/addresses';
import { arcTestnet } from '@/lib/chain';
import ERC20Abi from '@/lib/abis/ERC20.json';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import type { DashboardRow } from '@/lib/derivePosition';
import { maxUint256 } from 'viem';

type Step = 'idle' | 'approving' | 'betting' | 'done';

export function BetModal({ row, side, onClose }:
  { row: DashboardRow; side: boolean; onClose: () => void })
{
  const m = row.market;
  const [amount, setAmount] = useState('10');
  const [step, setStep] = useState<Step>('idle');

  const { address, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const { data: allowance } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20Abi, functionName: 'allowance',
    args: address ? [address, PREDICTION_MARKET_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 3000 },
  });

  const need = parseUsdc(amount || '0');
  const needsApprove = ((allowance as bigint) ?? 0n) < need;
  const onWrongChain = !!address && chainId !== arcTestnet.id;

  // 关键：approve 和 bet 用各自独立的 hash + receipt，避免状态机竞争
  const approveWc = useWriteContract();
  const betWc     = useWriteContract();
  const approveReceipt = useWaitForTransactionReceipt({ hash: approveWc.data });
  const betReceipt     = useWaitForTransactionReceipt({ hash: betWc.data });

  // approve 成功后才发起 bet
  useEffect(() => {
    if (step === 'approving' && approveReceipt.isSuccess) {
      setStep('betting');
      betWc.writeContract({
        address: PREDICTION_MARKET_ADDRESS, abi: PredictionMarketAbi,
        functionName: 'bet', args: [row.id, side, need],
        chainId: arcTestnet.id,
      });
    }
  }, [step, approveReceipt.isSuccess]);

  // bet 成功后才标 done
  useEffect(() => {
    if (step === 'betting' && betReceipt.isSuccess) {
      setStep('done');
      setTimeout(onClose, 1200);
    }
  }, [step, betReceipt.isSuccess]);

  const handleConfirm = async () => {
    if (onWrongChain) {
      try { await switchChainAsync({ chainId: arcTestnet.id }); } catch { return; }
    }
    if (needsApprove) {
      setStep('approving');
      approveWc.writeContract({
        address: USDC_ADDRESS, abi: ERC20Abi,
        functionName: 'approve', args: [PREDICTION_MARKET_ADDRESS, maxUint256],
        chainId: arcTestnet.id,
      });
    } else {
      setStep('betting');
      betWc.writeContract({
        address: PREDICTION_MARKET_ADDRESS, abi: PredictionMarketAbi,
        functionName: 'bet', args: [row.id, side, need],
        chainId: arcTestnet.id,
      });
    }
  };
  const isPending = approveWc.isPending || betWc.isPending;
  const waiting   = approveReceipt.isLoading || betReceipt.isLoading;
  const error     = approveWc.error || betWc.error;

  const total = m.yesPool + m.noPool + need;
  const winPool = side ? m.yesPool + need : m.noPool + need;
  const protocolFee = ((side ? m.noPool : m.yesPool) * BigInt(m.feeBpsSnapshot)) / 10000n;
  const impliedWin = winPool > 0n ? (need * (total - protocolFee)) / winPool : 0n;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 backdrop-blur-sm p-6"
         onClick={onClose}>
      <div className="bg-elevated border border-white/[0.12] rounded-2xl max-w-md w-full p-7 shadow-2xl"
           onClick={(e) => e.stopPropagation()}>
        <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Place Bet</div>
        <div className="text-lg font-medium mb-5 leading-snug">{m.question}</div>

        <div className="mb-4">
          <div className={`text-sm font-semibold uppercase tracking-wider mb-2 ${side ? 'text-yes' : 'text-no'}`}>
            Side: {side ? 'YES' : 'NO'}
          </div>
        </div>

        <div className="bg-surface border border-white/[0.12] rounded-xl px-4 py-3 flex items-baseline gap-3 mb-3">
          <input
            type="text" value={amount} onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-transparent outline-none text-2xl font-medium" disabled={step !== 'idle'}
          />
          <span className="text-zinc-400 text-sm">USDC</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-4 bg-surface rounded-xl p-4">
          <div>
            <div className="text-xs text-zinc-500">Your Stake</div>
            <div className="font-mono">{fmtUsdc(need)} USDC</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Implied Win</div>
            <div className="font-mono text-yes">~{fmtUsdc(impliedWin)} USDC</div>
          </div>
        </div>

        <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-2 mb-5">
          赔率会随新下注变化，最终在 bet deadline 后锁定。
        </div>

        {needsApprove && (
          <div className="text-xs text-zinc-500 mb-3">
            Step 1/2: Approve USDC（首次下注一次性）→ Step 2/2: Place Bet
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={onClose} className="border border-white/[0.12] py-3 rounded-xl">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={step !== 'idle' || isPending || waiting}
            className="bg-accent text-base font-semibold py-3 rounded-xl disabled:opacity-50"
          >
            {step === 'idle' && (needsApprove ? 'Approve & Bet' : 'Place Bet')}
            {step === 'approving' && (waiting ? 'Approving...' : 'Confirming approve')}
            {step === 'betting'   && (waiting ? 'Placing bet...' : 'Confirming bet')}
            {step === 'done'      && '✓ Done'}
          </button>
        </div>

        {error && <div className="text-xs text-no mt-3">{error.message}</div>}
      </div>
    </div>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add web/components/BetModal.tsx
git commit -m "feat(web): BetModal 两步签名（approve → bet）"
```

---

### Task 12.4: PositionList + ResolvedList

**Files:**
- Create: `web/components/PositionList.tsx`
- Create: `web/components/ResolvedList.tsx`

- [x] **Step 1: PositionList.tsx**

```tsx
'use client';

import type { DashboardRow } from '@/lib/derivePosition';
import { userPositionOf, OUTCOMES } from '@/lib/derivePosition';
import { fmtUsdc } from '@/lib/format';
import { useWriteContract } from 'wagmi';
import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';

export function PositionList({ rows }: { rows: DashboardRow[] }) {
  const userRows = rows.filter(r => userPositionOf(r) !== 'none' && OUTCOMES[r.market.outcome] === 'Unresolved');
  const { writeContract } = useWriteContract();

  if (userRows.length === 0) return null;

  return (
    <details open className="border border-white/[0.06] bg-surface rounded-2xl p-6 mt-8">
      <summary className="cursor-pointer text-sm uppercase tracking-wider text-zinc-400 font-semibold">
        My Positions <span className="text-zinc-600">({userRows.length})</span>
      </summary>
      <div className="mt-4 space-y-2">
        {userRows.map((r) => {
          const pos = userPositionOf(r);
          const stake = pos === 'yes' ? r.yesStake : pos === 'no' ? r.noStake : r.yesStake + r.noStake;
          return (
            <div key={r.id.toString()} className="flex items-center gap-5 px-4 py-3 bg-elevated border border-white/[0.06] rounded-xl">
              <div className="flex-1">
                <div className="text-sm font-medium">{r.market.question}</div>
              </div>
              <span className={`text-xs font-semibold uppercase px-2 py-1 rounded ${
                pos === 'yes' ? 'bg-yes/10 text-yes' : pos === 'no' ? 'bg-no/10 text-no' : 'bg-zinc-700 text-zinc-300'
              }`}>{pos}</span>
              <div className="font-mono text-sm text-zinc-300">{fmtUsdc(stake)} USDC</div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
```

- [x] **Step 2: ResolvedList.tsx**

```tsx
'use client';

import type { DashboardRow } from '@/lib/derivePosition';
import { OUTCOMES, userIsWinner } from '@/lib/derivePosition';
import { fmtUsdc } from '@/lib/format';
import { useWriteContract } from 'wagmi';
import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';

export function ResolvedList({ rows }: { rows: DashboardRow[] }) {
  const resolved = rows.filter(r => OUTCOMES[r.market.outcome] !== 'Unresolved');
  const { writeContract } = useWriteContract();

  if (resolved.length === 0) return null;

  const claim = (id: bigint) => {
    writeContract({
      address: PREDICTION_MARKET_ADDRESS, abi: PredictionMarketAbi,
      functionName: 'claim', args: [id],
    });
  };

  return (
    <details className="border border-white/[0.06] bg-surface rounded-2xl p-6 mt-8">
      <summary className="cursor-pointer text-sm uppercase tracking-wider text-zinc-400 font-semibold">
        Resolved <span className="text-zinc-600">({resolved.length})</span>
      </summary>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {resolved.map((r) => {
          const o = OUTCOMES[r.market.outcome];
          const canClaim = !r.claimedFlag && userIsWinner(r) && r.pendingPayout > 0n;
          return (
            <div key={r.id.toString()} className="bg-elevated border border-white/[0.06] rounded-xl p-4">
              <div className="text-xs text-zinc-500 mb-1">Outcome: <span className={
                o === 'Yes' ? 'text-yes' : o === 'No' ? 'text-no' : 'text-zinc-400'
              }>{o}</span></div>
              <div className="text-sm font-medium mb-2">{r.market.question}</div>
              <div className="flex justify-between items-center">
                <div className="text-xs font-mono text-zinc-500">
                  {r.pendingPayout > 0n ? `Payout: ${fmtUsdc(r.pendingPayout)} USDC` : r.claimedFlag ? 'Claimed' : 'No payout'}
                </div>
                {canClaim && (
                  <button onClick={() => claim(r.id)} className="bg-accent text-base text-sm font-semibold px-3 py-1.5 rounded-lg">
                    Claim
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}
```

- [x] **Step 3: Commit**

```bash
git add web/components/PositionList.tsx web/components/ResolvedList.tsx
git commit -m "feat(web): PositionList + ResolvedList（含 Claim 按钮）"
```

---

# Phase 13：页面

### Task 13.1: 主页 page.tsx

**Files:**
- Create: `web/app/page.tsx`

- [x] **Step 1: 写主页**

```tsx
'use client';

import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import type { DashboardRow } from '@/lib/derivePosition';
import { OUTCOMES } from '@/lib/derivePosition';
import { fmtUsdc } from '@/lib/format';
import { WalletPill } from '@/components/WalletPill';
import { NetworkBanner } from '@/components/NetworkBanner';
import { FaucetCard } from '@/components/FaucetCard';
import { MarketCard } from '@/components/MarketCard';
import { BetModal } from '@/components/BetModal';
import { PositionList } from '@/components/PositionList';
import { ResolvedList } from '@/components/ResolvedList';
import { zeroAddress } from 'viem';

export default function Home() {
  const { address } = useAccount();
  const user = address ?? zeroAddress;

  const { data, isLoading, refetch } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS, abi: PredictionMarketAbi,
    functionName: 'getDashboardLatest', args: [user, 100n],
    query: { refetchInterval: 5000 },
  });

  const [betting, setBetting] = useState<{ row: DashboardRow; side: boolean } | null>(null);

  const rows = (data?.[0] as DashboardRow[]) ?? [];
  const totalCount = (data?.[1] as bigint) ?? 0n;
  const active = rows.filter(r => OUTCOMES[r.market.outcome] === 'Unresolved');
  const totalPool = active.reduce((s, r) => s + r.market.yesPool + r.market.noPool, 0n);

  return (
    <>
      <NetworkBanner />
      <nav className="border-b border-white/[0.06] backdrop-blur sticky top-0 z-30 bg-base/80">
        <div className="max-w-6xl mx-auto px-7 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent/70" />
            <span className="font-semibold text-lg">Arc<span className="text-accent">Predict</span></span>
          </div>
          <WalletPill />
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-7 py-9">
        <div className="flex items-baseline gap-7 pb-7 border-b border-white/[0.06] mb-9">
          <h1 className="text-4xl font-semibold tracking-tight flex-1 leading-tight">
            Bet on what the<br />market <em className="text-accent not-italic">actually</em> thinks.
          </h1>
          <div className="flex gap-7 text-sm">
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Active</div>
              <div className="text-2xl font-mono">{active.length}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Pooled</div>
              <div className="text-2xl font-mono">{fmtUsdc(totalPool)} USDC</div>
            </div>
          </div>
        </div>

        <FaucetCard />

        <h2 className="text-sm uppercase tracking-wider text-zinc-400 font-semibold mb-5">
          Active Markets <span className="text-zinc-600">({active.length})</span>
        </h2>
        {isLoading ? (
          <div className="text-zinc-500">Loading markets...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {active.map((row) => (
              <MarketCard key={row.id.toString()} row={row}
                onBet={(id, side) => setBetting({ row, side })} />
            ))}
          </div>
        )}

        <PositionList rows={rows} />
        <ResolvedList rows={rows} />
      </main>

      <footer className="max-w-6xl mx-auto px-7 py-8 mt-12 border-t border-white/[0.06] text-xs text-zinc-500 flex justify-between flex-wrap gap-3">
        <div>ArcPredict · Arc Testnet · chainId 5042002</div>
        <div>
          <a href="https://testnet.arcscan.app" target="_blank" rel="noopener" className="hover:text-zinc-300">Arcscan</a> ·{' '}
          <a href="https://faucet.circle.com" target="_blank" rel="noopener" className="hover:text-zinc-300">USDC Faucet</a>
        </div>
      </footer>

      {betting && <BetModal row={betting.row} side={betting.side} onClose={() => { setBetting(null); refetch(); }} />}
    </>
  );
}
```

- [x] **Step 2: 跑 dev**

```bash
cd web && pnpm dev
```

打开 localhost:3000，连钱包，应能看到市场列表（前提合约已部署且 addresses.ts 正确）。

- [x] **Step 3: Commit**

```bash
git add web/app/page.tsx
git commit -m "feat(web): 主页 page.tsx 完整数据流（getDashboardLatest 单 RPC）"
```

---

### Task 13.2: /market/[id] + /connect

**Files:**
- Create: `web/app/market/[id]/page.tsx`
- Create: `web/app/connect/page.tsx`

- [x] **Step 1: market/[id]/page.tsx**

```tsx
'use client';

import { useParams } from 'next/navigation';
import { useAccount, useReadContract } from 'wagmi';
import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import { useState } from 'react';
import { MarketCard } from '@/components/MarketCard';
import { BetModal } from '@/components/BetModal';
import { WalletPill } from '@/components/WalletPill';
import { NetworkBanner } from '@/components/NetworkBanner';
import { zeroAddress } from 'viem';
import type { DashboardRow } from '@/lib/derivePosition';

export default function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  const idBn = BigInt(id);
  const { address } = useAccount();
  const user = address ?? zeroAddress;

  const { data, refetch } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS, abi: PredictionMarketAbi,
    functionName: 'getDashboard', args: [user, idBn, idBn + 1n],
    query: { refetchInterval: 5000 },
  });
  const row = (data?.[0] as DashboardRow[])?.[0];

  const [betting, setBetting] = useState<{ row: DashboardRow; side: boolean } | null>(null);

  return (
    <>
      <NetworkBanner />
      <nav className="border-b border-white/[0.06] sticky top-0 z-30 bg-base/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-7 py-4 flex justify-between items-center">
          <a href="/" className="font-semibold">← ArcPredict</a>
          <WalletPill />
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-7 py-9">
        {!row ? <div className="text-zinc-500">Loading...</div> : (
          <MarketCard row={row} onBet={(id, side) => setBetting({ row, side })} />
        )}
      </main>
      {betting && <BetModal row={betting.row} side={betting.side}
        onClose={() => { setBetting(null); refetch(); }} />}
    </>
  );
}
```

- [x] **Step 2: connect/page.tsx**

```tsx
'use client';

import { arcTestnet } from '@/lib/chain';

export default function Connect() {
  const params = {
    chainId: '0x' + arcTestnet.id.toString(16),
    chainName: arcTestnet.name,
    nativeCurrency: arcTestnet.nativeCurrency,
    rpcUrls: arcTestnet.rpcUrls.default.http,
    blockExplorerUrls: [arcTestnet.blockExplorers!.default.url],
  };

  return (
    <main className="max-w-2xl mx-auto px-7 py-9">
      <h1 className="text-2xl font-semibold mb-4">手动添加 Arc Testnet</h1>
      <p className="text-zinc-400 text-sm mb-6">
        如果钱包自动添加失败，把下面的参数复制到 MetaMask → Networks → Add network。
      </p>
      <div className="bg-surface border border-white/[0.06] rounded-xl p-5 font-mono text-sm space-y-2">
        <div><span className="text-zinc-500">Chain ID: </span>{arcTestnet.id} (hex: {params.chainId})</div>
        <div><span className="text-zinc-500">Name: </span>{arcTestnet.name}</div>
        <div><span className="text-zinc-500">RPC: </span>{params.rpcUrls[0]}</div>
        <div><span className="text-zinc-500">Symbol: </span>{arcTestnet.nativeCurrency.symbol}</div>
        <div><span className="text-zinc-500">Decimals: </span>{arcTestnet.nativeCurrency.decimals}</div>
        <div><span className="text-zinc-500">Explorer: </span>{params.blockExplorerUrls[0]}</div>
      </div>
      <p className="text-xs text-zinc-500 mt-6">
        注：Arc native 余额底层是 18 decimals，但钱包应显示为 6 decimals 的 USDC。这是 Arc 设计如此。
      </p>
    </main>
  );
}
```

- [x] **Step 3: Commit**

```bash
git add web/app/market web/app/connect
git commit -m "feat(web): /market/[id] 深链 + /connect 故障排查页"
```

---

# Phase 14：运营脚本

### Task 14.1: ListMarkets / ListResolvable

**Files:**
- Create: `contracts/script/ops/ListMarkets.s.sol`
- Create: `contracts/script/ops/ListResolvable.s.sol`

- [x] **Step 1: ListMarkets.s.sol**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { PredictionMarket } from "../../src/PredictionMarket.sol";

contract ListMarkets is Script {
    function run() external view {
        address mkt = vm.envAddress("PREDICTION_MARKET");
        PredictionMarket p = PredictionMarket(mkt);
        uint256 n = p.marketCount();
        for (uint i = 0; i < n; i++) {
            PredictionMarket.Market memory m = p.getMarket(i);
            console2.log("id=%d outcome=%d question=%s", i, uint8(m.outcome), m.question);
            console2.log("  yesPool=%d noPool=%d", uint256(m.yesPool), uint256(m.noPool));
            console2.log("  resolveAfter=%d (now=%d)", m.resolveAfter, block.timestamp);
        }
    }
}
```

- [x] **Step 2: ListResolvable.s.sol**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { PredictionMarket } from "../../src/PredictionMarket.sol";

contract ListResolvable is Script {
    function run() external view {
        address mkt = vm.envAddress("PREDICTION_MARKET");
        PredictionMarket p = PredictionMarket(mkt);
        uint256 n = p.marketCount();
        for (uint i = 0; i < n; i++) {
            PredictionMarket.Market memory m = p.getMarket(i);
            if (m.outcome == PredictionMarket.Outcome.Unresolved &&
                block.timestamp >= m.resolveAfter) {
                console2.log("resolvable id=%d question=%s", i, m.question);
            }
        }
    }
}
```

- [x] **Step 3: Commit**

```bash
git add contracts/script/ops/ListMarkets.s.sol contracts/script/ops/ListResolvable.s.sol
git commit -m "feat(ops): ListMarkets + ListResolvable 运营脚本"
```

---

### Task 14.2: ResolveDueMarkets + cron README

**Files:**
- Create: `contracts/script/ops/ResolveDueMarkets.ts`（Node 脚本，因 Foundry 不能直接调 HTTPS）
- Create: `contracts/script/ops/README.md`

- [x] **Step 1: 装 deps + 配 package.json（ESM + tsx）**

```bash
cd contracts/script/ops
npm init -y
npm pkg set type=module
npm i viem@^2 @pythnetwork/hermes-client@^2 dotenv@^16
npm i -D tsx@^4 typescript@^5 @types/node
```

- [x] **Step 2: 写 `package.json` script**

```json
{
  "type": "module",
  "scripts": {
    "resolve": "tsx ResolveDueMarkets.ts"
  }
}
```

- [x] **Step 3: ResolveDueMarkets.ts**

```ts
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { createWalletClient, createPublicClient, http, parseAbi, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { HermesClient } from '@pythnetwork/hermes-client';
import { readFileSync } from 'node:fs';

// 显式读 contracts/.env（脚本所在目录的上两层）
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: pathResolve(__dirname, '../../.env') });

const RPC_URL = process.env.RPC_URL;
const MKT     = process.env.PREDICTION_MARKET as `0x${string}` | undefined;
const PK_RAW  = process.env.OWNER_PRIVATE_KEY;
const PYTH    = process.env.PYTH_ADDRESS as `0x${string}` | undefined;
const HERMES  = process.env.PYTH_HERMES_ENDPOINT ?? 'https://hermes.pyth.network';

if (!RPC_URL || !MKT || !PK_RAW || !PYTH) {
  throw new Error('Missing env: RPC_URL / PREDICTION_MARKET / OWNER_PRIVATE_KEY / PYTH_ADDRESS');
}
// 容忍带或不带 0x 前缀
const PK = (PK_RAW.startsWith('0x') ? PK_RAW : `0x${PK_RAW}`) as `0x${string}`;

const abi = JSON.parse(
  readFileSync(pathResolve(__dirname, '../../out/PredictionMarket.sol/PredictionMarket.json'), 'utf8')
).abi;

const arcTestnet = defineChain({
  id: 5042002, name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: [RPC_URL] } },
  testnet: true,
});

const account = privateKeyToAccount(PK);
const wc = createWalletClient({ account, chain: arcTestnet, transport: http(RPC_URL) });
const pc = createPublicClient({ chain: arcTestnet, transport: http(RPC_URL) });
const hermes = new HermesClient(HERMES);

const PYTH_FEE_ABI = parseAbi(['function getUpdateFee(bytes[]) view returns (uint256)']);

async function main() {
  const count = (await pc.readContract({ address: MKT, abi, functionName: 'marketCount' })) as bigint;
  for (let i = 0n; i < count; i++) {
    const m = (await pc.readContract({ address: MKT, abi, functionName: 'getMarket', args: [i] })) as any;
    const nowSec = Math.floor(Date.now() / 1000);
    if (m.outcome !== 0) continue;
    if (nowSec < Number(m.resolveAfter)) continue;

    // spec 规定：窗口为 [resolveAfter, resolveAfter + 5min]，Hermes 保留 ~30 天历史更新；
    // 即使 5 min 实时窗口已过，仍可拉历史 update 把市场结算掉。所以**不要**跳过超期市场。
    const windowExpired = nowSec > Number(m.resolveAfter) + 300;
    if (windowExpired) {
      console.log(`market ${i}: 实时窗口已过，尝试拉历史 update`);
    }

    try {
      const res = await hermes.getPriceUpdatesAtTimestamp(
        Number(m.resolveAfter), [m.pythPriceId],
        { encoding: 'hex', parsed: false }
      );
      const updateData = res.binary.data.map((s: string) => (`0x${s}`) as `0x${string}`);

      const fee = (await pc.readContract({
        address: PYTH, abi: PYTH_FEE_ABI,
        functionName: 'getUpdateFee', args: [updateData],
      })) as bigint;

      const hash = await wc.writeContract({
        address: MKT, abi, functionName: 'resolve',
        args: [i, updateData], value: fee,
      });
      console.log(`market ${i}: tx=${hash}`);
    } catch (e) {
      console.error(`market ${i}: 失败 - 等下个周期或人工排查`, (e as Error).message);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [x] **Step 3: README.md**

```markdown
# Ops 运营脚本

## 自动结算 cron

```cron
*/1 * * * * cd /path/to/ArcPredict/contracts/script/ops && /usr/local/bin/npm run resolve >> /var/log/arc-predict-resolve.log 2>&1
```

## 手动查询

```bash
forge script script/ops/ListMarkets.s.sol --rpc-url $RPC_URL
forge script script/ops/ListResolvable.s.sol --rpc-url $RPC_URL
```

## 故障排查

- "fee" / "out of window" → Pyth Hermes 拿不到对应 publishTime 的 update，可能时间窗口已过 → 等 `resolveAfter + 7 天` 后用 `forceInvalid` 兜底
- 私钥泄露 → 立即换 OWNER_PRIVATE_KEY，旧合约里 owner 仍是泄露者，但旧市场仍可正常结算（resolve 任何人可触发）；新部署合约重新创建市场
```

- [x] **Step 4: Commit**

```bash
git add contracts/script/ops/
git commit -m "feat(ops): ResolveDueMarkets.ts + cron README"
```

---

# Phase 15：部署 + QA

### Task 15.1: Vercel 部署

- [x] **Step 1: 准备 vercel.json**

`web/vercel.json`:
```json
{
  "buildCommand": "pnpm build",
  "framework": "nextjs"
}
```

- [x] **Step 2: 在 Vercel 创建项目**

- 关联 GitHub repo
- 设置 Root Directory = `web`
- 配置 env：`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`、`NEXT_PUBLIC_PYTH_HERMES_ENDPOINT`

- [x] **Step 3: 部署并验证**

打开 Vercel 提供的 URL，做基本 smoke：能看到 markets，能连钱包。

- [x] **Step 4: Commit `vercel.json`**

```bash
git add web/vercel.json
git commit -m "deploy: 加 vercel.json，关联前端到 Vercel"
```

---

### Task 15.2: 手动 QA 全 checklist 跑一遍

按 spec §7.4 手动 QA 清单逐项过：

- [x] MetaMask 浏览器扩展连接 + 切换到 Arc testnet
- [x] WalletConnect 手机扫码连接
- [x] Coinbase Wallet 连接
- [x] Faucet 领 USDC 后下注成功
- [x] 余额不足时按钮正确禁用
- [x] 链错误时切换提示生效
- [x] approve 流程正确（首次签名 + 后续免）
- [x] Bet Modal "Implied Win" 数字与合约计算一致
- [x] 下注后前端刷新仓位
- [x] resolve 后 claim 金额与公式一致
- [x] Invalid 情况下退款正确
- [x] 移动端浏览器（Safari iOS + Chrome Android）布局可用
- [x] /market/[id] 深链可分享
- [x] /connect 故障排查页可用

发现 bug 当场补丁、commit。

- [x] **完成 QA 后 commit summary**

```bash
git commit --allow-empty -m "qa: 手动 QA 全清单通过，MVP 可上线"
```

---

# 故障排查 / FAQ

| 症状 | 检查 |
|---|---|
| `forge install` 卡住 | 用 GitHub mirror or `--shallow` |
| Pyth `parsePriceFeedUpdatesUnique` revert "out of window" | Hermes 返回的 publishTime 未必精确等于 resolveAfter，是 ±2-3 秒抖动；spec 窗口 5 分钟应足够 |
| viem 报 chain not registered | 确认 `arcTestnet` 已传入 `getDefaultConfig({ chains: [arcTestnet] })` |
| RainbowKit Connect 后 wagmi `chainId` 仍是 1 | 检查 SSR provider 是否标了 `'use client'` |
| Vercel build 失败 ABI 找不到 | 必须先在本地跑 `Deploy.s.sol` 把 abis/ 落盘并 commit 进 git |
| 移动端 RainbowKit Modal 不弹 | 检查 `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` 是否设 |

---

## 总结

完成 15 个 phase 共约 35 个 task 后：
- 智能合约部署到 Arc testnet 并 verified
- 3 个种子市场可见可下注
- Vercel 部署的前端 URL 可访问
- 手动 QA 清单全通
- Cron 自动结算运行中

任何阶段卡住超过 30 分钟 → 停下来报告用户。
