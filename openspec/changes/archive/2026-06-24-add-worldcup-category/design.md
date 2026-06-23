## Context

ArcPredict 当前是基于 Pyth 价格预言机的二元预测市场（`PredictionMarket` + `IPyth`，市场以连续资产价格为结算依据，资产映射在 `web/lib/asset-price-map.ts`）。世界杯属于离散事件结果型市场，**结算源、市场结构、UI 叙事**均与现有路径不兼容，但底层 USDC、下注、领奖流程应当复用。本设计在不破坏现有 Crypto 流程的前提下，扩展三层（合约 / 预言机 / 前端），并保留后续从 Admin 切换到 UMA 的接口空间。

当前为 MVP 阶段，未上 mainnet，可接受 BREAKING 改造；项目方对赛事结算有运营能力，可承担 Admin 模式的信任成本。

## Goals / Non-Goals

**Goals:**
- 引入 `marketKind` 维度，让 Crypto 与 World Cup 在同一前端、同一资金池内并存，但视觉与导航清晰隔离
- 支持三种世界杯市场类型：1X2（三选一）、单场让分（二元）、冠军盘（32 选 1）
- 抽象 `IEventOracle` 接口，MVP 用 Admin 实现，留空间后续无缝切换到 UMA Optimistic Oracle
- 前端复用现有 `MarketDetailCard` / `MarketCard` 骨架，避免组件家族失控膨胀
- 移动端世界杯卡片信息密度可控（默认折叠，点击展开）

**Non-Goals:**
- 不引入 UMA Optimistic Oracle（MVP 范围外，但接口预留）
- 不引入积分 / 成就 / 排行榜系统
- 不引入实时比分推送到结算（实时比分仅用于展示）
- 不支持非世界杯赛事（欧冠、英超等，留待后续 Sports 大品类扩展）
- 不做品类间资金池隔离（共享 USDC，仅前端视觉隔离）
- 不引入新的链上代币或质押机制

## Decisions

### D1：结算源用 AdminEventOracle + 异议期，预留 UMA 接口

**选择**：MVP 实现 `AdminEventOracle`：**复用现有 `PredictionMarket` 的单 EOA `Ownable` 模式**（沿用同一个 `OWNER_PRIVATE_KEY`），owner 提交结果 → 72 小时异议期（任何 EOA 可质押 100 USDC 挑战）→ 无挑战则最终化，有挑战则由 owner 裁定。同时定义 `IEventOracle` 接口，未来 `UMAEventOracle` 实现同接口可平替。

**替代方案**：
- 直接接 UMA Optimistic Oracle v3：去中心化最强，但增加 1-2 周工期，且需要绑定 USDC 作为 bond
- Chainlink Functions + 体育 API：实时性好，但需自维护 DON 任务和 API Key，中心化偏高且增加运维负担
- 部署独立 Gnosis Safe 多签：安全性更高，但项目尚未上 mainnet，且现有合约就是单 EOA owner 模式，独立多签会引入两套权限模型导致心智负担
- 纯管理员提交无异议期：实现最简，但信任成本不可接受

**理由**：世界杯赛事结果客观、争议小、64 场可控，Admin + 异议期足以撑住 MVP；与现有 owner 模式保持一致，运维流程一套就够；接口预留确保不锁死技术路径。挑战质押定为 100 USDC（而非 500），平衡反垃圾与小用户参与门槛。

### D2：新增独立 `EventMarket.sol` 单合约，镜像 PredictionMarket 结构

**架构事实修正（2026-06-12）**：经探查实际代码，现有 `PredictionMarket.sol` 是**单合约多市场 + pool-based AMM** 结构（`mapping(uint256 => Market) private _markets;`），不存在 `BinaryMarket` 或 `MarketFactory`。原 D2/D3 假设的 factory + per-market 合约模式与现实不符。

**选择**：新增独立合约 `contracts/src/EventMarket.sol`，**镜像 PredictionMarket 的存储与 AMM 流程**（pool-based、`Ownable2Step`、`SafeERC20`、单合约多市场），但：
- `outcomeCount ∈ [2, 32]`（动态而非固定 2）
- 每个 outcome 一个 pool：`uint128[] outcomePools`（替代固定 `yesPool` / `noPool`）
- 持仓存储：`mapping(uint256 => mapping(address => mapping(uint8 => uint128))) public stakeByOutcome;`
- 结算源改走 `IEventOracle`，不依赖 Pyth
- 共享同一 USDC `immutable` 地址，抵押资产一致；不同市场合约仍分别持有自身池子余额

**不修改** `PredictionMarket.sol`（避免回归现有 Crypto 流程）。

**替代方案**：
- 把 PredictionMarket 升级为通用 N-outcome：storage layout 破坏性大；现 Crypto 流程已稳定，回归风险不可接受
- 把 1X2 拆成 3 个独立二元市场：UX 差，无法在合约层保证互斥
- 把 EventMarket 与 PredictionMarket 共享基类：增加耦合，且短期收益不抵风险——先复制粘贴，将来需要时再统一

**理由**：架构最小变更原则；镜像模式让 EventMarket 的实现可大量参考 PredictionMarket 的久经测试代码；接口隔离让未来 UMA 切换零成本。

### D3：前端按 marketKind 路由到两个合约地址（无 Factory）

**选择**：因不存在 factory，路由发生在**前端**。`web/lib/addresses.ts` 同时持有 `PREDICTION_MARKET_ADDRESS` 与 `EVENT_MARKET_ADDRESS`；`web/app/page.tsx` 按 `category` state（`'crypto'` / `'worldcup'`）决定调用哪个合约的 `getDashboardLatest`。`web/lib/market-kind.ts` 提供 `MarketKind` 枚举（`'price'` / `'event'`），由 DashboardRow 携带，用于 UI 变体路由。

**替代方案**：
- 在链上新增统一 Router 合约：增加 gas 成本与攻击面，无明显收益
- 共用单合约通过 kind 字段路由：把 World Cup 资产塞进 PredictionMarket 等于回到 D2 否决的方案

**理由**：前端路由零链上成本、零回归风险；两份 ABI 与两个地址的心智负担可控。

### D4：前端 BaseMarketCard + slot 模式，新增 WorldCupMarketCard 变体

**选择**：抽取 `BaseMarketCard`，暴露 `renderHeader` / `renderOutcomes` / `renderFooter` slot。`MarketCard`（Crypto）和 `WorldCupMarketCard`（赛事）作为变体填充 slot。`MarketDetailCard` 同样按 `marketKind` 切换内部 slot 内容（价格图 ↔ 概率图、Pyth 模块 ↔ 赛事信息模块）。

**替代方案**：
- 完全独立组件家族：代码重复，footer（流动性/持仓/倒计时）会双写
- 单组件内部 if/else 分支：随品类增多会爆炸

**理由**：slot 模式在变体可控（当前 2 种）时是甜区，且与现有"修复详情页卡片隔离"的方向一致。

### D5：MarketFilterBar 两级过滤（品类 Tab + 品类内子过滤）

**选择**：顶层加品类 Tab（Crypto / World Cup），切换时下方过滤器内容整体替换：
- Crypto：保留现有币种过滤
- World Cup：阶段过滤（All / Group Stage / R16 / QF / SF / Final / Winner）

**替代方案**：把世界杯阶段直接平铺到现有过滤器：拥挤、品类混淆

**理由**：与"卡片折叠为二元视图"的移动端策略一致，强调品类作为顶层心智模型。

### D6：World Cup accent 视觉，不引入全局绿色主题

**选择**：`ArcBackground` 增加 `variant` prop，World Cup 品类传入 `pitch` 变体（绿茵纹理，浅色主题下饱和度降低）；倒计时图标在 World Cup 卡片内替换为足球；其余 UI 元素保持现有浅色主题色板，不引入全局绿色。

**替代方案**：完整绿色主题切换：破坏现有视觉一致性，且无法应对未来更多品类（每个品类一套主题不可持续）

**理由**：accent 级别变化足以建立品类识别，避免主题污染。

### D7：赛程数据用静态种子，比分流低频按需展示

**选择**：世界杯赛程（64 场 + 32 队）打包为 `web/lib/worldcup-seed.ts` 静态种子（前端构建时确定）。实时比分通过 `web/lib/event-source.ts` 调 **TheSportsDB 免费版**（不付费），策略为：
- **仅在比赛进行中且用户聚焦详情页时**轮询，间隔 **60 秒**（不是 5-10 秒）
- 用户切走 Tab / 滚出视口 → 立刻停止轮询（用 `Page Visibility API` + `IntersectionObserver`）
- 列表页（卡片）**不轮询比分**，只显示赛程时间
- 全局加单层缓存（`SWR` 或自实现），同一 `matchId` 60 秒内只发一次请求
- 比赛未开始 / 已结束 → 0 请求

**不进入结算路径**（结算只信 `AdminEventOracle`）。

**替代方案**：从合约读取赛程：上链成本高且无必要；高频轮询：API 配额吃紧、对用户网络无意义

**理由**：清晰隔离"展示数据"与"结算数据"，前者可降级（API 挂了不影响下注/领奖）；最低频策略把 TheSportsDB 免费配额（30 req/min）压在 1 场比赛 1 req/min，64 场比赛即便同时进行也远低于配额上限。

### D8：资金池共享，前端视觉隔离

**选择**：Crypto 与 World Cup 市场都使用同一个 USDC token 地址，但 `PredictionMarket` 与 `EventMarket` 分别作为 ERC20 spender 和资金持有合约；前端在 World Cup Tab 下不展示 Crypto 持仓，反之亦然；`PositionList` 接受 `kind` 过滤参数。

**替代方案**：双独立 Vault：流动性割裂，用户体验差

**理由**：合约层简单、抵押资产统一；前端隔离已足够建立品类心智。由于没有共享 vault，用户需要分别授权不同合约地址。

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| AdminEventOracle 中心化风险（owner EOA 作恶或失误） | 72h 异议期；公开提交事件；owner key 安全等同现有 PredictionMarket（同 key），不增加新攻击面；预留 UMA 升级路径 |
| 冠军盘 32 选 1 流动性过浅，价格虚高 | 接受作为已知问题（用户决策已确认）；MVP 阶段做 LP 引导（项目方初始流动性）；详情页明确标注"低流动性"警示 |
| 异议期被恶意挑战刷量 | 挑战需质押 100 USDC；恶意挑战质押金没收为协议收入；自然抑制刷量 |
| 比分 API 失效或限流 | 60s 低频轮询 + 仅聚焦时启动 + Page Visibility/IntersectionObserver 严格停止，远低于 TheSportsDB 免费配额；失败时降级为仅显示种子赛程 |
| 移动端世界杯卡片信息过载 | 默认折叠二元视图 + 点击展开（D4 决策已覆盖） |
| `marketKind` 引入后现有 Crypto 市场需要数据迁移 | 当前未上 mainnet，旧市场可直接重新部署，避免迁移脚本复杂度 |
| 队徽版权（FIFA / 各国足协商标） | 用 SVG 国旗图标（country-flag-icons 类开源库）+ 队名缩写代替官方队徽；规避商标问题 |
| owner 离线无法响应挑战 | owner 离线时 72h 异议期到期后任何 EOA 可触发 finalize（采用提案结果），即"无响应等同放任"，挑战方质押金原路退回 |

## Migration Plan

由于当前未上 mainnet：
1. 部署新合约：`AdminEventOracle` + `EventMarket`
2. 保持现有 `PredictionMarket` 不变，前端地址表新增 `EVENT_MARKET_ADDRESS` 与 `ADMIN_EVENT_ORACLE_ADDRESS`
3. 前端发版：开启 `NEXT_PUBLIC_WORLDCUP_ENABLED=false`，验证 Crypto 流程无回归
4. 灌入世界杯赛程种子数据，预创建 1X2 + 让分 + 冠军盘市场（项目方注入初始流动性）
5. 切换 `NEXT_PUBLIC_WORLDCUP_ENABLED=true`，灰度开放
6. **回滚策略**：关 flag 即可回到纯 Crypto 视图；合约层世界杯结算可单独 pause（`AdminEventOracle.pause()`），不影响 Crypto

## Open Questions

所有 5 项已敲定（2026-06-12）：

- **Q1（已决）**：复用现有 `Ownable` 单 EOA owner 模式，不引入额外多签。沿用 `OWNER_PRIVATE_KEY` 与现有运维流程
- **Q2（已决）**：挑战质押 **100 USDC**（从 500 下调），降低小用户参与门槛；不做动态调整，保持简单
- **Q3（已决）**：冠军盘**不做**淘汰队伍保险金或主动裁剪；已淘汰队伍的 outcome 持仓保留到最终结算，合约层不因淘汰主动清零。MVP 不实现可转让 outcome token 或二级交易
- **Q4（已决）**：TheSportsDB **免费版**；轮询策略 **60 秒/场/聚焦中**，配合 Page Visibility + IntersectionObserver 严格停止；列表页不轮询；预算上限零付费
- **Q5（已决）**：**SVG 国旗图标**，引入 `country-flag-icons` 或同等开源 SVG 国旗库；不做自绘队徽（规避 FIFA 商标）
