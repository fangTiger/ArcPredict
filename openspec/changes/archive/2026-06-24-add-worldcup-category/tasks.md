## 1. 合约层 — IEventOracle 接口与 AdminEventOracle 实现

- [x] 1.1 定义 `contracts/src/interfaces/IEventOracle.sol` 接口（含 `proposeResult` / `finalizeResult` / `getResult` / `getEventStatus` / `challenge` / `revokeProposal` / `confirmProposal` / `finalizeOnTimeout`）
- [x] 1.2 实现 `contracts/src/AdminEventOracle.sol`：继承 OZ `Ownable2Step`，**沿用现有 `PredictionMarket` 同一 owner EOA**；72h 异议期；100 USDC 挑战质押；pause/unpause；feeRecipient 预留 bonus 账户用于奖励有效挑战
- [x] 1.3 实现状态机：`Pending → Proposed → (Finalized | Challenged → (Confirmed → Finalized | Revoked → Pending | TimeoutFinalized))`
- [x] 1.4 添加全套 events：`ResultProposed`、`Challenged`、`ProposalRevoked`、`ProposalConfirmed`、`Finalized`、`FinalizedOnTimeout`、`Paused`、`Unpaused`
- [x] 1.5 用 Foundry 编写测试：无挑战路径、owner 撤销提案（挑战方收回 + bonus）、owner 驳回挑战（质押没收）、owner 超时不响应（任意人触发 finalizeOnTimeout）、暂停状态、非 owner 调用 revert

## 2. 合约层 — EventMarket（镜像 PredictionMarket 单合约多市场结构）

> 架构修正：项目无 factory，PredictionMarket 是 pool-based 单合约多市场。新增独立合约 `EventMarket.sol`，不动 PredictionMarket。

- [x] 2.1 实现 `contracts/src/EventMarket.sol`：继承 `Ownable2Step`；存储结构镜像 PredictionMarket 但 outcome 数量动态（`uint128[] outcomePools`，N ∈ [2, 32]）；持仓 `mapping(uint256 => mapping(address => mapping(uint8 => uint128)))`；结算源 immutable `IEventOracle oracle`；共享 USDC immutable 地址
- [x] 2.2 方法对齐 PredictionMarket：`createMarket` / `bet` / `resolve`（调 `oracle.getResult`）/ `claim` / `getDashboardLatest`
- [x] 2.3 Foundry 测试：1X2（3-outcome）/ 让分（2-outcome）/ 冠军盘（32-outcome）的下注、结算、领奖；已淘汰队伍持仓不被强制清零；非法 outcomeIndex revert；同一 USDC token 地址验证
- [x] 2.4 端到端集成测试 `EventMarketE2E.t.sol`：AdminEventOracle + EventMarket 全流程联调
- [x] 2.5 **不修改** `PredictionMarket.sol`；不引入共享基类（保持回归零风险）

## 3. 前端数据层

- [x] 3.1 新建 `web/lib/market-kind.ts`，导出 `MarketKind` 枚举（镜像合约）与按 kind 过滤的工具函数
- [x] 3.2 新建 `web/lib/worldcup-seed.ts`，包含 32 队 + 64 场比赛元数据（`matchId` / `stage` / `kickoffTime` / `homeTeam` / `awayTeam` / ISO 3166-1 国家代码用于 SVG 国旗映射）
- [x] 3.3 新建 `web/lib/event-source.ts`，封装 **TheSportsDB 免费版** 调用；默认 base URL 使用当前官方免费路径 `https://www.thesportsdb.com/api/v1/json/123`，支持 `SPORTSDB_API_BASE` 运维覆盖；严格遵守 60s 间隔 + 仅聚焦时启动 + Page Visibility + IntersectionObserver 停止策略；全局共享缓存避免重复请求；失败优雅降级
- [x] 3.4 扩展 `web/lib/addresses.ts`，沿用现有 flat constants 风格追加 `AdminEventOracle`、`EventMarket` 地址；不引入按 chainId 路由结构；后续 `DeployWorldCup.s.sol` 必须按 `Deploy.s.sol` 模式回写这两行
- [x] 3.5 新增 `web/lib/abis/AdminEventOracle.json`、`EventMarket.json` ABI 导出
- [x] 3.6 引入 SVG 国旗依赖：评估 `country-flag-icons` 或 `flag-icons` 包，按需 tree-shake 仅引入 32 支参赛国（控制 bundle 体积）
- [x] 3.7 新建或扩展 `web/lib/feature-flags.ts`，导出 `WORLDCUP_ENABLED = process.env.NEXT_PUBLIC_WORLDCUP_ENABLED === 'true'`

## 4. 前端 — 品类导航与过滤

- [x] 4.1 重构 `web/components/MarketFilterBar.tsx`，加入顶层品类 Tab（Crypto / World Cup）
- [x] 4.2 World Cup Tab 下展示阶段子过滤（All / Group Stage / R16 / QF / SF / Final / Winner）
- [x] 4.3 默认 Tab 为 Crypto；状态通过 URL query (`?category=worldcup`) 持久化以便分享链接
- [x] 4.4 灰度开关：读取 `NEXT_PUBLIC_WORLDCUP_ENABLED`，关时不渲染品类 Tab

## 5. 前端 — 卡片家族重构

- [x] 5.1 抽取 `web/components/BaseMarketCard.tsx`，暴露 `renderHeader` / `renderOutcomes` / `renderFooter` slot
- [x] 5.2 将现有 `MarketCard.tsx` 改为 `CryptoMarketCard.tsx`，作为 BaseMarketCard 的 Crypto 变体
- [x] 5.3 新建 `web/components/WorldCupMarketCard.tsx`：队徽（SVG 国旗 + 队名缩写）、赛事阶段标签、开赛时间
- [x] 5.4 新建 `web/components/WorldCupOutcomePanel.tsx`，根据市场类型渲染：
  - 1X2：三栏（主胜 / 平 / 客胜）+ 赔率 + 隐含概率
  - 让分：二栏 OVER/UNDER
  - 冠军盘：前 3 + "查看全部 32 队" 折叠展开
- [x] 5.5 移动端折叠：`WorldCupMarketCard` 在 < 768px 默认显示二元视图，添加展开按钮

## 6. 前端 — 详情页与赛事信息模块

- [x] 6.1 重构 `web/components/MarketDetailCard.tsx`，按 `marketKind` 路由内部 slot：
  - `PRICE`：保留现有价格走势图 + Pyth 模块
  - `EVENT`：换成隐含概率走势图 + 赛事信息模块
- [x] 6.2 新建 `web/components/EventInfoPanel.tsx`：展示两队信息、赛事阶段、开赛时间、实时比分（从 event-source 按 60s 低频策略轮询）、明确标注 "Resolution Source: AdminEventOracle (Owner + 72h Dispute Window)"
- [x] 6.3 新建 `web/components/ImpliedProbabilityChart.tsx`：每个 outcome 一条概率曲线（基于 outcomePools 比例反推；后续若引入可转让 outcome token，再接入 token 价格历史）
- [x] 6.4 详情页提供链接到 `AdminEventOracle` 合约地址的区块浏览器

## 7. 前端 — 视觉与背景

- [x] 7.1 `web/components/ArcBackground.tsx` 增加 `variant` prop（`default` / `pitch`）；`pitch` 实现绿茵浅纹理（与浅色主题协调，饱和度降低）
- [x] 7.2 World Cup Tab 激活时父级传 `variant="pitch"`，其他品类保持 `default`
- [x] 7.3 World Cup 卡片倒计时图标用足球（`⚽`）替代沙漏

## 8. 前端 — 持仓视图按品类隔离

- [x] 8.1 `web/components/PositionList.tsx` 接受 `kindFilter?: MarketKind` 参数
- [x] 8.2 Crypto Tab 下传 `PRICE`，World Cup Tab 下传 `EVENT`
- [x] 8.3 Header 提供"全部持仓"入口（无过滤）

## 9. 部署与配置

- [x] 9.1 编写 Foundry 部署脚本 `contracts/script/DeployWorldCup.s.sol`：部署 `AdminEventOracle`（owner = `vm.addr(OWNER_PRIVATE_KEY)`，与现有 `PredictionMarket` owner 一致）与 `EventMarket`；从 `OWNER_PRIVATE_KEY` 环境变量读取签名钥（沿用 `Deploy.s.sol` 模式）
- [x] 9.2 部署完成后填回前端 `web/lib/addresses.ts`
- [x] 9.3 项目方批量预创建 1X2 + 让分 + 冠军盘市场（脚本 `contracts/script/SeedWorldCupMarkets.s.sol`）
- [x] 9.4 项目方注入初始流动性（首批 USDC，避免市场冷启动）
- [x] 9.5 配置环境变量：`NEXT_PUBLIC_WORLDCUP_ENABLED=false`（先关闭）；体育 API key

## 10. 灰度发布与验证

> **DoD 关单规则**：10.1 + 10.2 + 10.3 + 10.4 + 10.5 + 10.6 全部 [x] → Phase 7 主线 DoD 达成 → change 可 archive。10.7 不阻塞 archive，由部署后 73h 单独补录。
> 进度：全 Phase 完成，归档于 2026-06-24。10.7 仍为 post-archive smoke，不阻塞归档。

- [x] 10.1 灰度关闭状态下回归测试：Crypto 流程无任何变化（首页、下注、领奖、Faucet、钱包）
  - 证据：`docs/qa/2026-06-23-phase7-10x-non-broadcast.md` §10.1；`NEXT_PUBLIC_WORLDCUP_ENABLED=false pnpm exec vitest run` 为 `36 passed | 2 skipped`，`NEXT_PUBLIC_WORLDCUP_ENABLED=false pnpm build` exit 0，`NEXT_PUBLIC_WORLDCUP_ENABLED=false pnpm typecheck` exit 0；首页/hero/filter/position 静态 smoke 通过，BetModal 旧静态脚本已因 BetForm 重构漂移而不作为本轮证据。
- [x] 10.2 Phase 7a：本地 Anvil 完整 6 步闭环（真实 72h dispute window via vm.warp）
  - [x] 10.2.1 编写 `contracts/script/Phase7E2E.s.sol`
  - [x] 10.2.2 Anvil 跑通：deploy → seed 98 → 3 钱包 deposit → final-1 三向下注 → warp 到 kickoff+150min → admin propose ARG → warp +72h → finalize → 3 钱包 claim
  - [x] 10.2.3 输出 `docs/qa/2026-06-13-phase7a-anvil-e2e.md`：tx hashes、gas、状态读、payout 对账
- [x] 10.3 Phase 7b：测试网部署 + 首笔下注证据（compressed final-1 startTime = deploy + 15min）
  - 证据：`docs/qa/2026-06-13-phase7b-testnet-deploy.md` §环境 / §新合约 / §Seed 结果 / §首笔下注；Arc Testnet chainId `5042002` 广播 `100` 笔 tx，`marketCount=98`，final-1 `marketId=96`，kickoff 相对 EventMarket 部署区块 `+862s`。
  - [x] 10.3.1 编写 `contracts/script/DeployWorldCupTestnet.s.sol`（仅 final-1 kickoff 压缩，其余 97 个保持真实赛程偏移）
    - 证据：`docs/qa/2026-06-13-phase7b-testnet-deploy.md` §环境 / §Seed 结果；脚本常量 `TESTNET_FINAL_KICKOFF_DELAY = 15 minutes`，final-1 读数 `startTime=1782234237`。
  - [x] 10.3.2 广播部署 + seed + USDC fund（人工确认 broadcast）
    - 证据：`docs/qa/2026-06-13-phase7b-testnet-deploy.md` §新合约 / §Seed 结果；AdminEventOracle `0xA4b27Ee975C31Ad60fF0Bda8ACB680Cb183BC004`，EventMarket `0x2E9F15905739632ed7b156b4c7824d368a97bB15`，deploy tx `0x77f7a8e8e4454dfe2552b39dea7a28b767c2b445ec7aac3734379a54fc015339` / `0x398a7df2f124b195aeca61e62db3935157f2f05c3ec13a70c123ade7d57c390b`。
  - [x] 10.3.3 前端连接，在 final-1 下一笔小额 ARG 单
    - 证据：`web/lib/addresses.ts` 已回填新 EventMarket/AdminEventOracle；`docs/qa/2026-06-13-phase7b-testnet-deploy.md` §首笔下注记录 final-1 `outcomeIndex=0 (home / ARG)`，金额 `500000` raw USDC，bet tx `0xa1453b221e50e019253304b68021061b14e7c247f729bca7275a3ffa7883aa0e`，池子从 `[0,0,0]` 变为 `[500000,0,0]`。
  - [x] 10.3.4 输出 `docs/qa/2026-06-13-phase7b-testnet-deploy.md`：合约地址、tx hash、区块浏览器链接、前端截屏
    - 证据：`docs/qa/2026-06-13-phase7b-testnet-deploy.md` §新合约 / §首笔下注 / §Owner 验证；本轮按最终任务包以链上读数和 tx explorer 作为首注证据，未执行 Vercel 或远端前端部署。
- [x] 10.4 三条挑战路径验证（在 7a Anvil 环境内联补充，复用 6 步框架）
  - 证据：`contracts/script/Phase7E2EChallengePaths.s.sol` 与 `docs/qa/2026-06-23-phase7-10x-non-broadcast.md` §10.4；沙箱拒绝本地 Anvil RPC 绑定，已记录降级，并用 `forge script --offline script/Phase7E2EChallengePaths.s.sol -vvv` 跑通同一 dry-run EVM 流程，exit 0，`Script ran successfully.`，`Gas used: 51821503`。
  - [x] 10.4.1 owner 撤销路径
    - 证据：§10.4.1；`revokeProposal` 后状态回 Pending，挑战者恢复到 `10000.000000`，bonusBank 扣 `100.000000`，重新提案后 Alice claim，market/oracle 余额归零。
  - [x] 10.4.2 owner 驳回路径
    - 证据：§10.4.2；`confirmProposal` 后状态 Finalized，挑战质押没收到 feeRecipient，feeRecipient 为 `102.000000`，Alice claim 后 market/oracle 余额归零。
  - [x] 10.4.3 owner 不响应（finalizeOnTimeout）路径
    - 证据：§10.4.3；72h+ 后 `finalizeOnTimeout`，挑战者仅退回 stake、无 bonus，feeRecipient 仅协议费 `2.000000`，Alice claim 后 market/oracle 余额归零。
- [x] 10.5 移动端可视化检查：卡片折叠展开、品类 Tab 切换、绿茵背景
- [x] 10.6 比分 API 失败降级验证：断网/拔 key 后页面仍可正常下注领奖
  - 证据：`web/test/event-source.degradation.test.tsx` 与 `docs/qa/2026-06-23-phase7-10x-non-broadcast.md` §10.6；覆盖网络错误、4xx、5xx、429、timeout、空响应、非法 JSON；`pnpm exec vitest run test/event-source.degradation.test.tsx` 为 `7 passed`，相关组件/数据层回归为 `36 passed`。
- [ ] 10.7 Phase 7c（post-archive smoke，不阻塞 archive）：测试网 finalize/claim
  - 注：post-archive smoke，不阻塞本次 `add-worldcup-category` 归档；等待 final-1 resolveAfter 与 72h dispute window 后补录。
  - [ ] 10.7.1 propose outcome=ARG via AdminEventOracle 测试网
  - [ ] 10.7.2 等待 72h dispute window 过
  - [ ] 10.7.3 调 finalize
  - [ ] 10.7.4 claim 7b 那笔下注
  - [ ] 10.7.5 追加 "Phase 7c smoke" 章节到 7b 文档

## 11. 文档与归档

- [x] 11.1 在 `docs/` 下新增 `worldcup-category-runbook.md`，记录 owner 提案/撤销/确认操作流程、异议处理 SOP、API 替换步骤、bonus 预留账户充值方法
  - 证据：`docs/worldcup-category-runbook.md`；包含 capability 概述、owner SOP、dispute、bonus bank、SPORTSDB API 切换、灰度开关、自动化钱包私钥保管和回滚/应急。
- [x] 11.2 更新 `web/README.md` 与项目根 README，加入新品类介绍与开关说明
  - 证据：`web/README.md` §Market Categories 与项目根 `README.md`；记录 Crypto / World Cup 差异、`NEXT_PUBLIC_WORLDCUP_ENABLED`、`SPORTSDB_API_BASE` / `NEXT_PUBLIC_SPORTSDB_API_BASE`。
- [x] 11.3 提案归档前同步 delta spec 到 `openspec/specs/worldcup-category/` 与 `openspec/specs/event-oracle/`，完成完整性检查（CLAUDE.md Section 0.7）
  - 证据：`openspec/specs/worldcup-category/spec.md`、`openspec/specs/worldcup-category/design.md`、`openspec/specs/event-oracle/spec.md`、`openspec/specs/event-oracle/design.md` 已创建；delta 已转为正式 capability spec，不保留 `ADDED Requirements` 头；完整性检查见 `docs/qa/2026-06-13-phase7b-testnet-deploy.md` §Section 0.7 §worldcup 自检。
