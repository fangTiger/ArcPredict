# 世界杯品类设计文档（Codex 执行版）

| 元数据 | 值 |
|---|---|
| 主题 | 在 ArcPredict 引入"世界杯"事件品类 |
| 范围 | 合约（新 `EventMarket` + `AdminEventOracle`）+ 前端（品类导航、卡片家族、详情页、视觉）+ 部署 + 验证 |
| 关联 OpenSpec 变更 | `openspec/changes/add-worldcup-category/`（canonical specs） |
| 实施人 | Codex（read-only 审查 → workspace-write 实施） |
| 负责把关 | Claude（最终代码审查与合并） |
| 日期 | 2026-06-12 |
| 阶段定级 | 大任务（跨合约 + 前端 + 部署，需 bite-sized 子步骤） |

> **如何使用此文档**：本文是 Codex 自主执行的入口蓝图。Codex 应先通读全文，再按"实施阶段"顺序逐步推进。每个阶段末尾的"DoD（Definition of Done）"需在进入下一阶段前全部满足。规范层 SHALL/MUST 级要求以 `openspec/changes/add-worldcup-category/specs/**/*.md` 为准；本文档处理"如何映射到当前代码"。

---

## 1. 任务概述

### 1.1 业务目标

世界杯是 4 年一届的全球高关注度赛事，能在短期内显著拉新与提升活跃度。ArcPredict 当前仅支持基于 Pyth 价格预言机的加密资产二元市场，叙事单一。本次引入世界杯品类，让产品在赛事窗口期具备额外流量入口与用户停留场景。

### 1.2 技术目标

- 在不破坏现有 Crypto 流程（合约 / 前端 / 运维）的前提下，扩展出一条并行的"赛事 → 离散结果"市场通道
- 共享 USDC 资金池，前端按品类做视觉隔离
- 沿用现有 owner EOA 权限模型，不引入多签或新密钥
- 留接口空间，未来可平替到 UMA Optimistic Oracle，无需破坏性变更

### 1.3 用户决策（已敲定，2026-06-12）

| Q | 决策 |
|---|---|
| 结算源 | Admin + 72h 异议期（MVP）；接口预留 UMA |
| 市场范围 | 1X2 + 单场让分 + 冠军盘 32 选 1（全部首发） |
| 积分系统 | 不做 |
| 资金池 | 共享 USDC，前端视觉隔离 |
| Oracle 权限 | 复用现有 `OWNER_PRIVATE_KEY` 单 EOA（`Ownable2Step`） |
| 挑战质押 | 100 USDC |
| 已淘汰队伍 | 不做特殊处理，持仓保留至冠军最终化；合约不因淘汰强制清零 |
| 比分轮询 | TheSportsDB 免费版，60s/场，仅聚焦时；列表页零轮询 |
| 队徽 | SVG 国旗图标（开源库，按 32 国 tree-shake） |

---

## 2. 现状评估（必读）

### 2.1 合约层现状

**关键事实——不要假设有 factory 或 per-market 合约**：

- `contracts/src/PredictionMarket.sol`（441 行）：**单合约多市场**结构
  - 通过 `mapping(uint256 => Market) private _markets;` 管理所有市场
  - `marketCount` 全局自增 ID
  - **pool-based AMM**：每个 Market 持有 `yesPool`、`noPool`、`winnerPool`、`protocolFee` 等 `uint128`
  - 二元 outcome：`enum Outcome { Unresolved, Yes, No, Invalid }`
  - 权限模型：`Ownable2Step`（OpenZeppelin），通过 `vm.envUint("OWNER_PRIVATE_KEY")` 部署
  - 结算源：`IPyth`（Pyth Network），通过 `pythPriceId + threshold + ORACLE_WINDOW` 解析
  - USDC 通过 `immutable USDC` 引用，下注/赔付走 `SafeERC20`
- `contracts/script/Deploy.s.sol`：读取 `OWNER_PRIVATE_KEY`，部署 PredictionMarket
- `contracts/script/CreateMarket.s.sol`、`SeedLiquidity.s.sol`：owner 创建市场与注流

### 2.2 前端现状

- `web/app/page.tsx`（119 行）：
  - 调用 `useReadContract({ address: PREDICTION_MARKET_ADDRESS, abi: PredictionMarketAbi, functionName: 'getDashboardLatest' })` 拉市场
  - 返回 `[DashboardRow[], bigint]`
  - 渲染 `<MarketFilterBar>` + `<MarketCard>` 列表
- `web/components/MarketFilterBar.tsx`（116 行）：
  - 当前两维度：`Asset`（BTC/ETH/SOL/all） + `Cadence`（daily/weekly/monthly/quarterly/all）
  - 纯客户端组件 `'use client'`
  - 使用 Tailwind 自定义 token：`ink`、`paper`、`hair`、`arc/20`
- `web/components/MarketCard.tsx`（244 行）：现 Crypto 卡片完整实现
- `web/components/MarketDetailCard.tsx`：详情页卡片
- `web/components/ArcBackground.tsx`：背景动画
- `web/components/BetModal.tsx`、`PositionList.tsx`、`ResolveCountdown.tsx`、`ResolvedList.tsx`：下注与持仓视图
- `web/lib/`：
  - `addresses.ts`：合约地址表
  - `asset-price-map.ts`：Pyth priceId → 资产代号映射
  - `pyth.ts`：Pyth 客户端封装
  - `cadence-tag.ts`、`derivePosition.ts`、`format.ts`：辅助工具

### 2.3 数据流

```
[Pyth Hermes] ──▶ PredictionMarket (resolve) ──▶ getDashboardLatest()
                                                       │
                                                       ▼
                                              web/app/page.tsx
                                                       │
                                                       ▼
                                              MarketCard × N
                                                       │
                                                       ▼
                                              BetModal → PredictionMarket.bet()
```

---

## 3. 范围

### 3.1 在范围内

- 新增合约：`IEventOracle.sol`、`AdminEventOracle.sol`、`EventMarket.sol`
- 新增前端：World Cup 品类导航、卡片变体、详情页变体、绿茵背景、SVG 国旗、比分轮询
- 新增数据：64 场赛程 + 32 队种子数据
- 部署脚本与项目方 SOP
- 端到端回归与降级验证

### 3.2 不在范围内

- UMA Optimistic Oracle 接入（接口预留即可，不实现）
- 积分 / 成就 / 排行榜
- 实时比分参与结算（仅展示）
- 非世界杯赛事（欧冠 / 英超 / NBA 等）
- 自绘队徽 / FIFA 商标素材
- 资金池隔离（共享 USDC，仅前端视觉隔离）
- 主题级绿色（仅 accent，不污染浅色主题）

---

## 4. 高层架构变更

### 4.1 合约层目标拓扑

```
                      ┌─────────────────────────────┐
                      │ owner EOA (OWNER_PRIVATE_KEY)│
                      └──────┬──────────────┬───────┘
                             │              │
                             ▼              ▼
   ┌─────────────────────────────┐   ┌──────────────────────────────┐
   │ PredictionMarket.sol（已存在）│   │ EventMarket.sol（新）          │
   │ - mapping[id] => Market      │   │ - mapping[id] => EventMarketDef│
   │ - pool-based, binary         │   │ - pool-based, N-outcome (N∈[2,32])│
   │ - Pyth resolve               │   │ - AdminEventOracle resolve     │
   └─────────┬───────────────────┘   └─────────┬─────────────────────┘
             │                                  │
             └─────────────┬────────────────────┘
                           ▼
                    USDC（共享池）
                           ▲
                           │
   ┌───────────────────────┴──────────────┐
   │ AdminEventOracle.sol（新）             │
   │ - Ownable2Step（同一 OWNER_PRIVATE_KEY）│
   │ - propose / challenge / revoke / confirm│
   │ - finalizeOnTimeout                    │
   │ - implements IEventOracle              │
   └────────────────────────────────────────┘
```

**关键设计点**：
- **不动 `PredictionMarket.sol`**（避免回归）
- `EventMarket.sol` **镜像** PredictionMarket 的存储与流程模式（pool-based AMM、单合约多市场、`Ownable2Step`），但 outcome 数量可变（N ∈ [2, 32]），结算改走 `IEventOracle`
- `AdminEventOracle.sol` 是独立合约，**EventMarket 通过接口调用**，未来可平替 `UMAEventOracle`
- owner 复用：部署脚本读取同一 `OWNER_PRIVATE_KEY`，结果是 EventMarket、AdminEventOracle、PredictionMarket 三者 owner 一致

### 4.2 前端目标拓扑

```
web/app/page.tsx
   │
   ├── useReadContract(PredictionMarket.getDashboardLatest) ──▶ Crypto rows
   ├── useReadContract(EventMarket.getDashboardLatest)       ──▶ World Cup rows
   │
   ├── MarketFilterBar
   │     ├── 顶层品类 Tab（Crypto / World Cup）  ← 新增
   │     ├── Crypto 子过滤（Asset / Cadence）   ← 现有
   │     └── World Cup 子过滤（Stage）          ← 新增
   │
   └── 列表渲染
         ├── category === 'crypto' → CryptoMarketCard（现有 MarketCard 重命名）
         └── category === 'worldcup' → WorldCupMarketCard（新）

详情页：
   └── MarketDetailCard（按 marketKind 路由 slot）
         ├── PRICE → PythPanel + PriceChart
         └── EVENT → EventInfoPanel + ImpliedProbabilityChart
```

### 4.3 数据流（World Cup）

```
[TheSportsDB API] ──60s 聚焦──▶ event-source.ts ──▶ EventInfoPanel（仅展示）
                                                          │
                                                          │
   [worldcup-seed.ts 静态种子] ──▶ MarketFilterBar / 列表
                                                          │
                                                          ▼
                                                  下注 / 领奖
                                                          │
                                                          ▼
                                                EventMarket.bet()
                                                EventMarket.claim()
                                                          ▲
                                                          │
                                       AdminEventOracle.finalizeResult()
```

---

## 5. 实施阶段

> Codex 执行说明：每阶段必须先完成所有 task 并通过 DoD 自检（`forge test` / `pnpm typecheck` / `pnpm lint` / 手动核验），再进入下一阶段。任一阶段失败必须停下来汇报，**禁止跳过失败用例继续推进**。

### Phase 1 — 合约接口与 AdminEventOracle

**目标**：建立可独立测试的 Oracle 实现，不依赖 EventMarket。

#### Tasks

- [ ] 1.1 创建 `contracts/src/interfaces/IEventOracle.sol`：
  - `enum EventStatus { Pending, Proposed, Challenged, Finalized }`
  - `function proposeResult(bytes32 eventId, uint8 outcomeIndex) external;`
  - `function challenge(bytes32 eventId) external;`
  - `function revokeProposal(bytes32 eventId) external;` （owner only）
  - `function confirmProposal(bytes32 eventId) external;` （owner only）
  - `function finalizeResult(bytes32 eventId) external;`
  - `function finalizeOnTimeout(bytes32 eventId) external;`
  - `function getResult(bytes32 eventId) external view returns (uint8 outcomeIndex, bool finalized);`
  - `function getEventStatus(bytes32 eventId) external view returns (EventStatus);`
- [ ] 1.2 实现 `contracts/src/AdminEventOracle.sol`：
  - 继承 `Ownable2Step`（与 `PredictionMarket` 一致）
  - 构造函数接收 `(address usdc, address initialOwner, address feeRecipient, address bonusBank, uint8 maxOutcomes)`
  - 常量：`DISPUTE_WINDOW = 72 hours`、`CHALLENGE_STAKE = 100 * 1e6`（USDC 6 位精度）、`BONUS = 100 * 1e6`
  - 存储：`mapping(bytes32 => Proposal) proposals;`，`Proposal { uint8 outcomeIndex; uint64 proposedAt; address challenger; uint64 challengedAt; EventStatus status; }`
  - 状态机实现（见 §6.1）
  - pause / unpause（`Pausable` from OZ）
  - 全套 events
- [ ] 1.3 Foundry 测试 `contracts/test/AdminEventOracle.t.sol`：
  - `test_proposeAndFinalize_NoChallenge`
  - `test_challenge_OwnerRevokes_ChallengerRefundedWithBonus`
  - `test_challenge_OwnerConfirms_ChallengerStakeForfeited`
  - `test_challenge_OwnerInactive_FinalizeOnTimeout_StakeRefundedNoBonus`
  - `test_pause_BlocksAllMutations_ReadsStillWork`
  - `test_nonOwner_Reverts`
  - `test_doubleChallenge_Reverts`
  - `test_finalizeBeforeWindow_Reverts`
  - 覆盖率 ≥ 95%
- [ ] 1.4 Natspec 注释（所有 public/external 方法），中文（项目语言规范）

#### DoD

- `cd contracts && forge build` 成功
- `forge test --match-contract AdminEventOracle` 全绿
- `forge coverage --match-contract AdminEventOracle` 覆盖率 ≥ 95%
- 无 Slither 高危告警（若环境已配置 Slither）

---

### Phase 2 — EventMarket 合约

**目标**：镜像 PredictionMarket 的存储与流程，但支持 N-outcome 与 IEventOracle 结算。

#### Tasks

- [ ] 2.1 创建 `contracts/src/EventMarket.sol`：
  - 继承 `Ownable2Step`
  - 存储结构（参考 PredictionMarket，但去掉 Pyth 字段，改 eventId + oracle）：
    ```solidity
    struct EventMarketDef {
        bytes32 eventId;          // AdminEventOracle 内 eventId
        uint8 outcomeCount;       // 2 / 3 / 32
        uint64 betDeadline;
        uint64 resolveAfter;
        uint128[] outcomePools;   // 每个 outcome 一个池
        uint128 winnerPool;
        uint128 protocolFee;
        uint16 feeBpsSnapshot;
        address feeRecipientSnapshot;
        uint8 settledOutcome;     // 0xFF 表示未结算
        uint64 settleTime;
        string question;
    }
    ```
  - 持仓存储：`mapping(uint256 => mapping(address => mapping(uint8 => uint128))) public stakeByOutcome;`
  - `IEventOracle public oracle;`（构造函数传入，immutable）
  - 方法对应 PredictionMarket 同名：`createMarket`、`bet`、`resolve`、`claim`、`getDashboardLatest`
  - `createMarket(...)` 要求 `outcomeCount ∈ [2, 32]`
  - `bet(uint256 id, uint8 outcomeIndex, uint128 amount)` 检查 outcomeIndex < outcomeCount
  - `resolve(uint256 id)` 调用 `oracle.getResult(eventId)`，要求 finalized = true
  - `claim(uint256 id)` 按持仓 outcome === settledOutcome 比例分 winnerPool
  - 共享 USDC（与 PredictionMarket 同一 `address USDC` immutable 参数）
- [ ] 2.2 Foundry 测试 `contracts/test/EventMarket.t.sol`：
  - `test_create_1X2Market_3Outcomes`
  - `test_create_BinaryHandicap_2Outcomes`
  - `test_create_Winner_32Outcomes`
  - `test_bet_DistributesToCorrectPool`
  - `test_resolve_OnlyAfterOracleFinalized`
  - `test_claim_WinnerOnly_LosersGetZero`
  - `test_eliminatedTeamHoldingRemainsUntilFinalSettlement`（已淘汰队伍持仓不强制归零）
  - `test_revertOnInvalidOutcomeIndex`
  - `test_sharedUSDCWithPredictionMarket`（mock setup 验证与 PredictionMarket 使用同一 USDC token 地址）
  - 覆盖率 ≥ 95%
- [ ] 2.3 用 Mock IEventOracle 注入测试（不依赖 AdminEventOracle）
- [ ] 2.4 端到端集成测试 `contracts/test/EventMarketE2E.t.sol`：
  - 部署 AdminEventOracle + EventMarket
  - 创建 1X2 → 多用户下注 → owner 提议 → 72h 后 finalize → 赢家 claim
  - 创建冠军盘 → 32 用户分别下注一队 → 决赛后 finalize → 冠军方 claim

#### DoD

- `forge test --match-contract "EventMarket"` 全绿（包括 E2E）
- 覆盖率 ≥ 95%
- 与 PredictionMarket 的存储布局对比文档（注释中说明同构点与差异点）

---

### Phase 3 — 前端数据层

**目标**：提供 marketKind 路由、世界杯赛程种子、比分数据源。

#### Tasks

- [ ] 3.1 创建 `web/lib/market-kind.ts`：
  ```ts
  export type MarketKind = 'price' | 'event';
  export type WorldCupStage = 'group' | 'r16' | 'qf' | 'sf' | 'final' | 'winner';
  export const MARKET_KINDS: MarketKind[] = ['price', 'event'];
  ```
- [ ] 3.2 创建 `web/lib/worldcup-seed.ts`：
  - 导出 `WORLDCUP_TEAMS: Team[]`（32 队，含 ISO 3166-1 alpha-2 国家代码、英文名、中文名缩写）
  - 导出 `WORLDCUP_MATCHES: Match[]`（48 场小组赛 + 16 场淘汰赛，淘汰赛队伍用占位符 `'GROUP_A_W'` 等）
  - 导出 `MATCH_BY_ID(matchId)`、`MATCHES_BY_STAGE(stage)` 辅助函数
  - 时间用 UTC ISO 8601 字符串
- [ ] 3.3 创建 `web/lib/event-source.ts`：
  - 默认 `BASE_URL = 'https://www.thesportsdb.com/api/v1/json/123'`（免费版；以 TheSportsDB 当前官方文档为准）
  - 导出 React Hook `useLiveScore(matchId, opts)`：
    - 仅当 `opts.matchInProgress === true` 且 `document.visibilityState === 'visible'` 且 `inView === true` 时启动 `setInterval(60_000)`
    - 用 `IntersectionObserver` 监听 `opts.containerRef`，离开视口立即清 interval
    - 用 `document.addEventListener('visibilitychange', ...)` 暂停/恢复
    - 全局 `Map<matchId, { score; ts }>` 缓存，60s 内同 matchId 直接返回缓存
    - 失败时返回 `{ status: 'error', score: null }`，调用方根据 status 降级
  - 列表页**绝不调用** `useLiveScore`（在 Hook 中加 dev-only `console.warn` 检测多实例并发）
- [ ] 3.4 扩展 `web/lib/addresses.ts`：
  - 现状核实（2026-06-12）：该文件是 4 行平铺常量，顶部注释 `// Auto-generated by Deploy.s.sol`，由部署脚本回写——**不存在按 chainId 路由**
  - **沿用现有 flat constants 风格**，仅追加两行：
    - `export const EVENT_MARKET_ADDRESS = '0x...' as const;`
    - `export const ADMIN_EVENT_ORACLE_ADDRESS = '0x...' as const;`
  - 更新 `contracts/script/DeployWorldCup.s.sol` 在部署末尾回写这两行到 `addresses.ts`（与现有 `Deploy.s.sol` 模式一致）
  - 不引入 `addresses-by-chain.ts` 或类似新结构（如未来需要多链，单独提案）
- [ ] 3.5 创建 `web/lib/abis/EventMarket.json` 与 `AdminEventOracle.json`（由 Phase 1/2 forge build 产物拷贝）
- [ ] 3.6 引入 SVG 国旗：
  - 评估 `country-flag-icons`（4 MB 全集）vs `flag-icons`（推荐）
  - 采用 `flag-icons` + 按需 import：`import 'flag-icons/css/flag-icons.min.css';`
  - 或更轻量：直接 import 32 国 SVG 文件，自建 `Flag` 组件
  - 测算最终 bundle 增量 ≤ 80 KB gzip
- [ ] 3.7 灰度开关：`web/lib/feature-flags.ts`（新建或扩展）：
  - `export const WORLDCUP_ENABLED = process.env.NEXT_PUBLIC_WORLDCUP_ENABLED === 'true';`
  - 用于条件渲染品类 Tab

#### DoD

- `pnpm typecheck` 通过
- `pnpm lint` 通过
- `worldcup-seed.ts` 数据完整性自检脚本（32 队、64 场）通过
- `event-source.ts` 在 Jest/Vitest 中至少覆盖：visibility 切换暂停、IntersectionObserver 触发停止、错误降级
- bundle analyzer 显示新依赖增量 ≤ 80 KB gzip

---

### Phase 4 — 前端列表 Walking Skeleton（导航 + 卡片家族 + 绿茵背景）

> **范围修正记录（2026-06-12，与 Codex 校准）**：原 docs/plans Phase 4 把 OpenSpec tasks Phase 4 + 5 + 6 + 7 + 8 全部合并为 12 项，单 Phase 范围过大。现拆为两批：
> - **本 Phase 4** = OpenSpec Phase 4（导航）+ Phase 5（卡片家族）+ Phase 7（视觉），构成"列表视图 walking skeleton"，DoD 完成后用户在 World Cup Tab 下能看到完整的卡片列表与绿茵背景
> - **新 Phase 5** = OpenSpec Phase 6（详情页）+ Phase 8（持仓过滤），见下一节
> - 后续 Phase 6/7/8 = 原 docs/plans Phase 5/6/7（部署 / 验证 / 归档）

**目标**：用户进入首页可见 Crypto/World Cup 品类 Tab；切到 World Cup 后看到品类导航、阶段子过滤、绿茵背景、世界杯卡片列表（1X2 / 让分 / 冠军盘三种变体）；移动端卡片折叠展开正常；灰度关闭时完全回退到现状。

#### Tasks

- [x] 4.1 抽取 `web/components/BaseMarketCard.tsx`：
  - Props：`{ renderHeader, renderOutcomes, renderFooter, className?: string }`
  - 不含任何业务逻辑，仅布局壳子（与现有 MarketCard 的容器样式一致）
- [x] 4.2 将 `web/components/MarketCard.tsx` 重命名为 `CryptoMarketCard.tsx`，改为 BaseMarketCard 变体，业务行为不变（确认 import 全部修复）
- [x] 4.3 新建 `web/components/WorldCupMarketCard.tsx`：
  - Header slot：两队国旗（SVG）+ 队名缩写 + "VS" + 赛事阶段标签 + 开赛时间
  - Outcomes slot：路由到 `WorldCupOutcomePanel`
  - Footer slot：复用现有 footer（流动性 / 持仓 / 倒计时），倒计时图标用 `⚽`
- [x] 4.4 新建 `web/components/WorldCupOutcomePanel.tsx`：
  - 1X2（3-outcome）：三栏网格，每栏 outcome 名 + 赔率 + 隐含概率
  - 让分（2-outcome）：二栏，复用 1X2 样式
  - 冠军盘（32-outcome）：默认显示前 3 队 + "查看全部 32 队" 折叠按钮，展开后两列网格
- [x] 4.5 移动端折叠：
  - `WorldCupMarketCard` 通过 `useMediaQuery('(max-width: 767px)')` 判断
  - 移动端 1X2 默认折叠为"主队 WIN / 其他"二元视图，添加展开/收起按钮
  - 移动端冠军盘默认仅显示前 3 队（与桌面一致，但展开仅显前 8 队 + 滚动）
- [x] 4.6 重构 `web/components/MarketFilterBar.tsx`：
  - 顶部增加品类 Tab（`Crypto` / `World Cup`），通过 prop `category` 与 `onCategoryChange` 控制
  - World Cup 激活时下方切换为 Stage 过滤（`All / Group / R16 / QF / SF / Final / Winner`）
  - Crypto 激活时保留现有 Asset + Cadence 过滤
  - `filterMarkets` 函数扩展支持 category + stage 过滤
- [x] 4.7 改造 `web/app/page.tsx`：
  - 新增 `useState<'crypto' | 'worldcup'>('crypto')` 与 URL 同步（`useSearchParams` + `router.replace`）
  - `WORLDCUP_ENABLED === false` 时不渲染品类 Tab，强制 Crypto
  - 并行 `useReadContract` 两个合约：PredictionMarket 和 EventMarket，按 category 决定渲染哪边
  - **暂不**改 PositionList 的 kindFilter（留到 Phase 5），现阶段保持现有行为
- [x] 4.8 改造 `web/components/ArcBackground.tsx`：
  - 新增 `variant: 'default' | 'pitch'` prop
  - `pitch` 变体：浅色主题下饱和度降低的绿茵纹理（CSS pattern 或 SVG）
  - World Cup Tab 激活时父级传 `variant="pitch"`

#### DoD

- `pnpm typecheck` 通过
- `pnpm lint` 通过
- `pnpm dev` 启动后视觉自检（用 Phase 6 部署后的真实 EventMarket，或临时 mock 数据）：
  - 默认 Crypto Tab，行为与现有完全一致（无回归）
  - 切到 World Cup Tab，看到品类切换、阶段子过滤、绿茵背景、World Cup 卡片列表
  - 1X2 / 让分 / 冠军盘三种 outcome 布局都能正确渲染
  - 移动端（DevTools 模拟 iPhone 12）卡片折叠/展开正常
  - 切回 Crypto Tab，Asset/Cadence 过滤恢复
- `NEXT_PUBLIC_WORLDCUP_ENABLED=false` 时回归测试：完全看不到 World Cup 任何痕迹
- bundle analyzer 显示新增 UI 与 SVG 国旗增量 ≤ 80 KB gzip（与 Phase 3.7 共同核验）

#### 对应 OpenSpec tasks

- OS Phase 4 全部（4.1–4.4：MarketFilterBar 改造 + URL 持久化 + 灰度）
- OS Phase 5 全部（5.1–5.5：BaseMarketCard 抽取 + WorldCupMarketCard + WorldCupOutcomePanel + 移动端折叠）
- OS Phase 7 全部（7.1–7.3：ArcBackground variant + ⚽ 倒计时图标）

---

### Phase 5 — 详情页与持仓视图

**目标**：World Cup 卡片点击进入详情页，看到赛事信息模块（含 60s 比分轮询）与隐含概率走势图；持仓视图按品类隔离正确。

#### Tasks

- [x] 5.1 改造 `web/components/MarketDetailCard.tsx`：
  - 增加 `marketKind` prop
  - PRICE：保留现有 Pyth 模块 + 价格走势（无改动）
  - EVENT：渲染新组件 `<EventInfoPanel />` + `<ImpliedProbabilityChart />`
- [x] 5.2 新建 `web/components/EventInfoPanel.tsx`：
  - 显示两队信息、阶段、开赛时间、实时比分（用 Phase 3.3 的 `useLiveScore` 60s 策略）
  - 明确标注 "Resolution Source: AdminEventOracle (Owner + 72h Dispute Window)"，附合约地址区块浏览器链接
- [x] 5.3 新建 `web/components/ImpliedProbabilityChart.tsx`：
  - 每个 outcome 一条概率曲线
  - 基于 `outcomePools` 比例反推（后续若引入可转让 outcome token，再接入 token 价格历史）
  - 使用现有项目内的图表库（若无，引入 `recharts` 或 `lightweight-charts`，按现有 PriceChart 选型一致）
- [x] 5.4 改造 `web/components/PositionList.tsx`：
  - 新增 `kindFilter?: MarketKind`
  - Crypto Tab 下传 `'price'`，World Cup Tab 下传 `'event'`
  - SiteHeader 提供"全部持仓"入口（不过滤）
- [x] 5.5 改造 `web/app/page.tsx`：把 Phase 4 暂留的 `PositionList kindFilter` 接通

#### DoD

- `pnpm typecheck` 通过
- `pnpm lint` 通过
- `pnpm dev` 启动后视觉自检：
  - 点击 World Cup 卡片 → 进入详情页 → 看到 EventInfoPanel + ImpliedProbabilityChart
  - 详情页明确标注 Resolution Source 与合约链接
  - Crypto 详情页保持现有外观（Pyth 模块 + 价格走势）
  - 持仓视图：Crypto Tab 仅显示 Crypto 持仓，World Cup Tab 仅显示 World Cup 持仓，SiteHeader 全部持仓入口可用
  - 60s 比分轮询：DevTools Network 面板观察列表页 0 请求；详情页聚焦时 60s 间隔；切走 Tab / 滚出视口立即停止
- `NEXT_PUBLIC_WORLDCUP_ENABLED=false` 时回归：详情页路由不可达，持仓视图不出现 kindFilter 异常

#### 对应 OpenSpec tasks

- OS Phase 6 全部（6.1–6.4：MarketDetailCard 路由 + EventInfoPanel + ImpliedProbabilityChart + 区块浏览器链接）
- OS Phase 8 全部（8.1–8.3：PositionList kindFilter + 全部持仓入口）

---

### Phase 6 — 部署脚本与初始数据

**目标**：上链部署、种子市场创建、初始流动性注入。

#### Tasks

- [x] 6.1 创建 `contracts/script/DeployWorldCup.s.sol`：
  - 读取 `OWNER_PRIVATE_KEY`、**`USDC_ADDRESS`**（沿用现有 `Deploy.s.sol` / `SeedLiquidity.s.sol` / `.env.example` 命名）、`FEE_RECIPIENT`、`BONUS_BANK_ADDRESS` 环境变量
  - 部署 `AdminEventOracle(USDC_ADDRESS, owner, feeRecipient, bonusBank, 32)`
  - 部署 `EventMarket(USDC_ADDRESS, owner, feeRecipient, address(adminEventOracle))`
  - 部署末尾按 `Deploy.s.sol` 模式将两个新地址回写到 `web/lib/addresses.ts`（追加 `EVENT_MARKET_ADDRESS` 与 `ADMIN_EVENT_ORACLE_ADDRESS` 两行）
- [x] 6.2 创建 `contracts/script/SeedWorldCupMarkets.s.sol`：
  - 读取 `worldcup-seed.ts` 等价 JSON（建议从 `contracts/script/data/worldcup-seed.json` 读取，由前端种子导出脚本生成保持单一来源）
  - 为每场小组赛创建：1 个 1X2（3-outcome）+ 1 个总进球数让分（2-outcome）
  - 为决赛阶段创建：1 个冠军盘（32-outcome）
  - 设置合理 `betDeadline`（开赛前 5 分钟）和 `resolveAfter`（开赛后 150 分钟）
- [x] 6.3 ~~SeedEventOracle.s.sol~~ — **不需要**。`AdminEventOracle` 采用 `mapping(bytes32 => Proposal) proposals;`，未写入条目对应 `EventStatus.Pending`（枚举默认值 = 0），`getEventStatus()` 对任意未注册 `eventId` 自然返回 `Pending`。预注册脚本无功能价值，已删除。在 Phase 1 的 Foundry 测试中加一个用例 `test_unregisteredEvent_DefaultsToPending` 锁住此契约不变量即可
- [x] 6.4 项目方初始流动性脚本 `contracts/script/SeedWorldCupLiquidity.s.sol`：
  - 为每个市场注入起始流动性（如 1000 USDC，按 outcome 数等分到各 pool）
- [x] 6.5 `.env.example` 更新（位置：项目根 `.env.example` 与 `contracts/.env.example` 两处）：
  - 新增 `BONUS_BANK_ADDRESS`（用于 AdminEventOracle 的 bonus 预留账户）
  - 新增 `NEXT_PUBLIC_WORLDCUP_ENABLED`
  - 新增 `NEXT_PUBLIC_EVENT_MARKET_ADDRESS`、`NEXT_PUBLIC_ADMIN_EVENT_ORACLE_ADDRESS`
  - 新增 `SPORTSDB_API_BASE`（默认 `https://www.thesportsdb.com/api/v1/json/123`，如需 self-host 代理可替换）
  - **不引入** `USDC` 这个 env 名，沿用现有 `USDC_ADDRESS`

#### DoD

- `forge script DeployWorldCup --rpc-url $RPC --broadcast` 在测试网部署成功
- `forge script SeedWorldCupMarkets --rpc-url $RPC --broadcast` 创建至少 1 个 1X2 + 1 个让分 + 1 个冠军盘
- 前端 `pnpm build` 通过，地址表加载正确
- `.env.example` 更新完毕，无遗漏变量

---

### Phase 7 — 端到端验证

**目标**：用 2022 世界杯历史数据回放，证明三类市场的下注 → 结算 → 领奖完整闭环。

#### Tasks

- [ ] 7.1 灰度关闭回归（`NEXT_PUBLIC_WORLDCUP_ENABLED=false`）：
  - Crypto 流程：首页加载、过滤、下注、领奖、Faucet、钱包连接全部无回归
  - 确认 World Cup Tab 完全不可见，路由不可达
- [ ] 7.2 灰度开启端到端（`NEXT_PUBLIC_WORLDCUP_ENABLED=true`）：
  - **1X2 路径**：创建 ARG vs FRA → 用户下注 ARG WIN → owner proposeResult(ARG=0) → 72h 后任意人 finalize → ARG 持仓者 claim
  - **让分路径**：创建总进球数 OVER 2.5 → 用户下注 OVER → owner propose(OVER=0) → finalize → OVER 持仓者 claim
  - **冠军盘路径**：32 用户分别下注一队 → owner propose 冠军 → finalize → 冠军方 claim
- [ ] 7.3 三条挑战路径验证：
  - **owner 撤销**：owner propose 错误结果 → 任意 EOA 挑战 100 USDC → owner revokeProposal → 挑战方收到 100 + 100 bonus → owner 重新 propose 正确结果
  - **owner 驳回**：owner propose 正确结果 → 恶意 EOA 挑战 100 USDC → owner confirmProposal → 恶意方 100 USDC 没收到 feeRecipient
  - **owner 不响应**：owner propose → EOA 挑战 → 72h 后任意人 finalizeOnTimeout → 原 proposal 生效，挑战方退回 100 USDC（无 bonus）
- [x] 7.4 移动端视觉验证（Chrome DevTools iPhone 12 / Pixel 5）：
  - 品类 Tab 切换
  - 卡片折叠展开
  - 绿茵背景渲染
  - 详情页布局
- [ ] 7.5 比分 API 失败降级：
  - 临时把 `event-source.ts` 的 base URL 改成不可达地址，确认前端隐藏比分模块、不影响下注领奖
  - 验证轮询策略：在 DevTools Network 面板观察，确认列表页 0 请求、详情页聚焦时 60s 间隔、切走 Tab 后 0 请求
- [x] 7.6 bundle 体积回归：
  - 对比 `pnpm build` 前后 `.next/analyze` 报告，新依赖增量 ≤ 80 KB gzip
- [x] 7.7 Slither 审计（合约层）：
  - `slither contracts/src/AdminEventOracle.sol`
  - `slither contracts/src/EventMarket.sol`
  - 无 High / Medium 告警（Low / Informational 单独评估）

#### DoD

- 所有 6 条 E2E 路径在测试网跑通，链上交易哈希记录到 `docs/qa/2026-06-12-worldcup-e2e.md`
- 灰度关闭回归无回归
- Slither 无 High / Medium 告警
- 移动端截图归档到 `docs/qa/screenshots/worldcup/`

---

### Phase 8 — 文档与归档

#### Tasks

- [ ] 8.1 创建 `docs/plans/2026-06-12-worldcup-runbook.md`：
  - owner 操作 SOP：propose / revoke / confirm / pause
  - bonus 预留账户充值方法
  - 比分 API 替换 / 代理步骤
  - 紧急止损 SOP（pause AdminEventOracle）
- [ ] 8.2 更新 `web/README.md` 与项目根 `README.md`：
  - 新增 World Cup 品类介绍
  - 灰度开关说明
  - 新合约地址参考
- [ ] 8.3 OpenSpec 归档：
  - 同步 delta spec 到 `openspec/specs/worldcup-category/` 与 `openspec/specs/event-oracle/`
  - `openspec validate add-worldcup-category --strict --no-interactive`
  - `/opsx:archive add-worldcup-category`
  - 执行 OpenSpec 完整性检查（CLAUDE.md Section 0.7 6 项）

#### DoD

- runbook 经 owner 评审
- README 双语校对完成
- `openspec/specs/` 出现两个新 capability 目录
- archive 后 `openspec list` 不再显示 active change

---

## 6. 关键实现细节

### 6.1 AdminEventOracle 状态机

```
Pending
  │
  │ owner.proposeResult(eventId, outcomeIndex)
  ▼
Proposed (proposedAt = now)
  │
  ├─ 无挑战，now > proposedAt + 72h
  │   │ anyone.finalizeResult()
  │   ▼
  │  Finalized
  │
  └─ EOA.challenge() with 100 USDC stake
      ▼
   Challenged
      │
      ├─ owner.revokeProposal()
      │   │ refund challenger 100 USDC + transfer 100 USDC bonus from bonusBank
      │   ▼
      │  Pending（owner 可重新 propose）
      │
      ├─ owner.confirmProposal()
      │   │ forfeit challenger stake to feeRecipient
      │   ▼
      │  Finalized (outcomeIndex = original proposal)
      │
      └─ now > proposedAt + 72h（owner 不响应）
          │ anyone.finalizeOnTimeout()
          │ refund challenger 100 USDC (no bonus)
          ▼
         Finalized (outcomeIndex = original proposal)
```

**关键不变量**：
- 每个 eventId 至多一个挑战（先到先得）
- `finalizeResult` 只能在 `Proposed` 且未被挑战的情况下、72h 异议期后调用
- `finalizeOnTimeout` 只能在 `Challenged` 状态且 72h 异议期后调用
- 所有"任意人可触发"的方法都是无利益冲突的状态推进
- pause 状态下所有 mutate 方法 revert，read 方法继续可用

### 6.2 EventMarket 与 PredictionMarket 同构性

| 维度 | PredictionMarket | EventMarket |
|---|---|---|
| 单合约多市场 | ✓ | ✓ |
| 自增 ID | ✓ | ✓ |
| pool-based AMM | ✓ | ✓（每 outcome 一池） |
| `Ownable2Step` | ✓ | ✓ |
| `SafeERC20` | ✓ | ✓ |
| Outcome 数量 | 固定 2（Yes/No） | 可变 2–32 |
| 结算源 | Pyth（IPyth） | IEventOracle |
| 共享 USDC | — | ✓（同 immutable address） |
| feeBps / feeRecipient | ✓ | ✓ |

EventMarket 大部分逻辑可从 PredictionMarket 抽象，但**不要把 PredictionMarket 也重构成共享基类**——增加回归风险。先复制粘贴 + 改 outcome 数量与结算源接口，将来需要时再统一。

### 6.3 前端品类路由

```typescript
// web/app/page.tsx 伪代码
const [category, setCategory] = useState<'crypto' | 'worldcup'>(
  searchParams.get('category') === 'worldcup' ? 'worldcup' : 'crypto'
);

// 同步 URL
useEffect(() => {
  const params = new URLSearchParams(searchParams);
  if (category === 'worldcup') params.set('category', 'worldcup');
  else params.delete('category');
  router.replace(`?${params.toString()}`, { scroll: false });
}, [category]);

// 并行拉取
const cryptoRows = useReadContract({
  address: PREDICTION_MARKET_ADDRESS,
  abi: predictionMarketAbi,
  functionName: 'getDashboardLatest',
});

const worldcupRows = useReadContract({
  address: EVENT_MARKET_ADDRESS,
  abi: eventMarketAbi,
  functionName: 'getDashboardLatest',
  query: { enabled: WORLDCUP_ENABLED && category === 'worldcup' },
});

const visibleRows = category === 'crypto' ? cryptoRows.data?.[0] : worldcupRows.data?.[0];
```

### 6.4 SVG 国旗组件

```tsx
// web/components/Flag.tsx
import 'flag-icons/css/flag-icons.min.css';

export function Flag({ code, size = 24 }: { code: string; size?: number }) {
  return (
    <span
      className={`fi fi-${code.toLowerCase()}`}
      style={{ width: size, height: size * 0.75 }}
      aria-label={code.toUpperCase()}
    />
  );
}
```

若 bundle 增量超标，改用动态 import + 32 国 SVG 文件按需加载。

### 6.5 比分轮询 Hook

```tsx
// web/lib/event-source.ts 关键骨架
const cache = new Map<string, { score: Score; ts: number }>();

export function useLiveScore(
  matchId: string,
  opts: { matchInProgress: boolean; containerRef: RefObject<HTMLElement> }
) {
  const [state, setState] = useState<{ status: 'idle' | 'ok' | 'error'; score: Score | null }>({
    status: 'idle',
    score: null,
  });

  useEffect(() => {
    if (!opts.matchInProgress) return;
    let timer: number | undefined;
    let active = true;

    const fetchOnce = async () => {
      const cached = cache.get(matchId);
      if (cached && Date.now() - cached.ts < 60_000) {
        if (active) setState({ status: 'ok', score: cached.score });
        return;
      }
      try {
        const res = await fetch(`${SPORTSDB_API_BASE}/eventslast.php?id=${matchId}`);
        const data = await res.json();
        const score = parseScore(data);
        cache.set(matchId, { score, ts: Date.now() });
        if (active) setState({ status: 'ok', score });
      } catch {
        if (active) setState({ status: 'error', score: null });
      }
    };

    const start = () => {
      fetchOnce();
      timer = window.setInterval(fetchOnce, 60_000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && document.visibilityState === 'visible') start();
      else stop();
    });
    if (opts.containerRef.current) observer.observe(opts.containerRef.current);

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && opts.containerRef.current) {
        const rect = opts.containerRef.current.getBoundingClientRect();
        if (rect.bottom > 0 && rect.top < window.innerHeight) start();
      } else {
        stop();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [matchId, opts.matchInProgress, opts.containerRef]);

  return state;
}
```

---

## 7. 验收标准

- [ ] 合约层：`forge test` 全绿，覆盖率 ≥ 95%，Slither 无 High/Medium
- [ ] 前端层：`pnpm typecheck` + `pnpm lint` + `pnpm build` 全部通过；bundle 增量 ≤ 80 KB gzip
- [ ] 端到端：1X2 / 让分 / 冠军盘 三类市场下注 → 结算 → 领奖闭环通过
- [ ] 异议机制：3 条挑战路径（撤销 / 驳回 / 不响应）行为正确，质押金流向正确
- [ ] 灰度关闭：Crypto 流程零回归
- [ ] 灰度开启：品类切换、视觉、移动端折叠、绿茵背景、比分轮询策略均正确
- [ ] OpenSpec：归档完成，`openspec/specs/` 反映最新能力
- [ ] 文档：runbook、README、E2E 报告齐备

---

## 8. 风险与降级

| Risk | Mitigation |
|---|---|
| owner key 泄露或失误 | sigBy 与 PredictionMarket 同一 key，攻击面不变；72h 异议期 + 任意人 finalize 兜底；pause 可紧急止损 |
| 冠军盘流动性过浅 | 项目方初始注入 1000 USDC，详情页明确低流动性警示，接受作为已知风险 |
| 异议恶意刷量 | 100 USDC 质押 + 没收到 feeRecipient，自然抑制 |
| 比分 API 限流或失效 | 60s 低频策略远低于免费配额；失败时降级仅显示赛程；不影响下注领奖 |
| `marketKind` 引入后破坏现有用户体验 | URL query 默认无 category 参数时进入 Crypto Tab（行为与现状一致）；灰度开关一键回退 |
| 队徽 FIFA 商标 | 仅用 SVG 国旗 + 队名缩写，规避商标 |
| Slither 出现 Medium 告警 | 阻塞合并直到修复或写明缓解措施 |

---

## 9. 参考资料

- **OpenSpec change**：`openspec/changes/add-worldcup-category/`
  - `proposal.md` — Why / What / Capabilities / Impact
  - `design.md` — 8 项核心决策与替代方案
  - `specs/worldcup-category/spec.md` — 9 项需求
  - `specs/event-oracle/spec.md` — 6 项需求
  - `tasks.md` — 11 组 ~50 步任务清单
- **现有合约**：`contracts/src/PredictionMarket.sol`
- **现有部署**：`contracts/script/Deploy.s.sol`
- **现有前端**：
  - `web/app/page.tsx`
  - `web/components/MarketCard.tsx`
  - `web/components/MarketFilterBar.tsx`
- **决策对话**：本文档 §1.3 总结的 9 项已敲定决策

---

## 10. 沟通规约

- Codex **不得**自行扩大范围（如顺手把 PredictionMarket 重构成与 EventMarket 共享基类）；若发现确实需要，停下来汇报
- 每完成一个 Phase 末尾的 DoD 自检后，向用户汇报阶段成果（哈希、覆盖率、截图），等待用户确认再进入下一 Phase
- 任何 spec 与现实代码冲突的地方，**以本文档 §2 现状评估为准**，必要时回头修改 OpenSpec design.md
- 不修改 `PredictionMarket.sol` 与现有 Crypto 流程
- 注释与文档使用中文（CLAUDE.md 语言规范）
- 与用户的沟通使用中文

---

文档结束。Codex 可从 Phase 1 开始执行。
