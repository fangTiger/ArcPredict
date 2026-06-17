# ArcPredict 自动化品类扩展设计

> Status: Draft（待用户复核）
> Date: 2026-06-17
> Author: bagen + Claude（brainstorming）
> Spec lineage: 接续 `2026-06-15-ai-lens-design.md`，对 `add-worldcup-category` 的下一步演进

## 0. 修订记录

| 日期 | 版本 | 说明 |
|---|---|---|
| 2026-06-17 | v0.1 | 初稿，对应 brainstorming 6 段设计 |
| 2026-06-18 | v0.2 | Pivot：宏观市场也走 EventMarket（discrete outcomes），砍掉 FredPriceAdapter。原因：摸 PredictionMarket.sol 代码后发现 `resolve` 走 Pyth `parsePriceFeedUpdatesUnique` push 流程，adapter 兼容代价远大于预期；改为题目 event 化后获得"零新合约 + 全品类单一结题路径"的工程红利，代价仅是宏观题目颗粒度从精确数字变区间 |

## 1. 背景与目标

### 1.1 当前状态

- ArcPredict 已上线两类市场：`crypto`（价格预测，复用 Pyth）+ `worldcup`（事件预测，AdminEventOracle）。
- WorldCup 题目通过 `SeedWorldCupMarkets.s.sol` 手工 seed，运营成本高。
- AI Lens 能力已就位，contextBuilder 按 category 分文件。

### 1.2 目标

- **核心目标**：争取 Arc Discord builder 角色 → 需要持续可见的产品迭代节奏。
- **派生约束**：新品类必须零人工维护，靠公开数据 API 自动开市 + 自动结题。
- **副产品**：homepage 从 2 类扩到 4 类（Phase 1），并建立一套"每周/每两周可加一个新品类"的工程能力（核心护城河）。

### 1.3 非目标

- 不做选举、娱乐、AI 事件等需要人工裁决的品类。
- 不替代或修改 worldcup 现有运营逻辑。
- 不引入新的 LLM provider 或新的链。

## 2. 设计原则

1. **零合约改动**：所有现有合约（PredictionMarket / EventMarket / AdminEventOracle）零修改，也不引入新合约。全品类（macro / chain）一律走 EventMarket + AdminEventOracle，宏观题目用 discrete outcome 区间表达（详见 §5）。
2. **MarketSource 插件化**：每个品类是一个 source plugin（一个文件 + 一个 Lens contextBuilder），新增品类成本可预测。
3. **链上即真相**：不引入外部数据库；自动化流程是无状态的（每次 tick 从链上 + 数据源重算）。
4. **幂等 + 去重**：`marketId = hash(sourceId, externalKey)` 保证多次 tick 不会重复开市，无需额外去重表。
5. **失败局部化**：单 source 失败不阻塞其他 source；失败的单条操作下次 tick 自动重试。

## 3. 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│   Vercel Cron (1 次/天, 02:00 UTC)                              │
│   POST /api/cron/markets/tick                                   │
│                                                                  │
│   for source in registry.enabled():                             │
│     ① fetchUpcoming()  → 新市场草稿                              │
│     ② createOnChain()  → 调合约开市 + 引导流动性                │
│     ③ resolvePending() → 查数据源 → 喂 oracle 结题              │
│     ④ preloadLens()    → 预生成 Lens 分析 cache 24h             │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│   合约层（全部不动 / 不新增）                                      │
│   EventMarket.sol         ← 全品类用                              │
│   AdminEventOracle.sol    ← 全品类结题用                          │
│   PredictionMarket.sol    ← 现有 crypto 二元市场继续用             │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│   前端层                                                          │
│   MarketCategory: 'crypto' | 'worldcup' | 'macro' | 'chain'     │
│   MarketFilterBar 加 2 个 tab                                    │
│   Lens contextBuilders/macro.ts, chain.ts                       │
└─────────────────────────────────────────────────────────────────┘
```

## 4. MarketSource 接口

### 4.1 接口形状

```ts
type MarketSourceId = string;          // e.g. "fred-macro" | "chain-event"
type ExternalKey = string;             // 数据源里唯一标识一个未来事件

interface MarketDraft {
  externalKey: ExternalKey;
  category: MarketCategory;
  question: string;                    // 英文（与项目语言策略一致，见 commit da023cc）
  outcomes: { id: string; label: string }[];  // ≥ 2 个，宏观题目用区间
  betDeadline: number;                 // unix sec
  resolveAfter: number;                // unix sec
  resolveSourceMeta: object;           // 给 resolve() 留的钩子数据
}

interface ResolvedOutcome {
  kind: 'settled' | 'invalid' | 'still-open';
  settledOutcomeIndex?: number;        // settled 时必填
  evidence?: { sourceUrl: string; rawValue: unknown };
}

interface MarketSource {
  id: MarketSourceId;
  category: MarketCategory;
  enabled: boolean;                    // 总开关（熔断）

  fetchUpcoming(now: Date): Promise<MarketDraft[]>;
  resolve(market: OnChainMarket, now: Date): Promise<ResolvedOutcome>;
  buildLensContext?(market: OnChainMarket): Promise<object>;
}
```

**为什么砍掉 `kind` 字段**：全品类统一走 EventMarket，没有 price/event 分歧。`PredictionMarket.sol` 由现有 crypto 二元市场继续使用，但本框架不再生成 price kind 草稿。

### 4.2 ExternalKey 设计

`externalKey` 是去重的灵魂，必须从数据源派生且对同一现实事件保持一致。

| Source | externalKey 格式 | 示例 |
|---|---|---|
| fred-macro | `{seriesId}:{releaseDate}` | `CPIAUCSL:2026-07-15` |
| chain-event (TVL 阈值) | `{chain}:tvl:gte:{value}:{deadlineISO}` | `eth:tvl:gte:200B:2026-09-30` |
| chain-event (Token unlock) | `unlock:{token}:{unlockDate}` | `unlock:ARB:2026-08-16` |

`marketId = keccak256(abi.encode(sourceId, externalKey))` → 链上既有的 `markets[marketId]` 检查天然防重复。

### 4.3 Cron 生命周期（一次 tick）

```
tick(now):
  for source in registry.enabled():
    try:
      drafts = source.fetchUpcoming(now)
      for d in drafts:
        marketId = hash(source.id, d.externalKey)
        if exists(marketId): skip                        // 幂等
        if d.betDeadline - now < CREATE_GUARD: skip      // 太近不开
        chainWriter.createMarket(marketId, d)
        chainWriter.seedLiquidity(marketId)              // 引导流动性
        lensPreloader.warm(marketId)                     // 预生成 Lens

      for m in chainReader.openMarkets(source.id):
        if m.resolveAfter > now: continue
        r = source.resolve(m, now)
        match r.kind:
          'still-open': continue                         // 下次 tick
          'invalid':    chainWriter.invalidate(m)
          'settled':    chainWriter.settle(m, r)
    except Error as e:
      log.error(source.id, e)                            // 局部失败
```

约束：每个 source 单 tick 最多处理 5 个新建 + 10 个 resolve，避免超 Vercel 60s 限制。

### 4.4 ResolvedOutcome 的三态

- `still-open`：数据源还没出结果（FRED 当天没发布、TVL 还没达到 deadline），cron 下次再来。这是正常态。
- `invalid`：题目作废（数据系列下架、unlock 推迟到无法判定）。调 `AdminEventOracle.invalidate` 让用户全额退款（合约已有逻辑）。
- `settled`：拿到结果，调对应合约 settle。

## 5. 链上结题机制

### 5.1 统一走 EventMarket + AdminEventOracle

全品类（macro / chain）一律走 EventMarket + AdminEventOracle 一条路径，零新合约。

**eventId 派生**：`eventId = computeMarketId(sourceId, externalKey)`（同一份哈希既是幂等键也是 oracle 的事件 ID）。

**开市**：cron 调 `EventMarket.createMarket(eventId, outcomeCount, betDeadline, resolveAfter, question)`，合约自动分配 `uint256 id`。幂等检查通过链上 `EventMarket.MarketCreated(id, eventId, ...)` 事件扫 eventId 实现。

### 5.2 多步结题流程（cross-tick）

`AdminEventOracle` 内置 72h challenge window，cron 的结题不是一次完成，而是跨多个 tick：

```
Day 0 (resolveAfter 已到 + 数据已公布)
  cron 调用 oracle.proposeResult(eventId, outcomeIdx)
  状态：Pending → Proposed

Day 1, 2 (challenge window 内)
  cron 看到 status == Proposed 且距 proposedAt < 72h，跳过

Day 3+ (challenge window 结束)
  cron 调用 oracle.finalizeResult(eventId)
  状态：Proposed → Finalized

Day 3+ (同 tick 顺手做)
  cron 调用 EventMarket.resolve(id)（任何人可调）
  状态：market 结算，玩家可 claim
```

**挑战分支**（人工干预）：如果有人在 challenge window 内挑战，oracle 状态变 `Challenged`，cron **不再自动推进**，记录告警等 owner 手动 `confirmProposal` / `revokeProposal`。Phase 1 此分支预期罕见，不做自动化。

### 5.3 题目区间化策略（宏观品类）

由于走 EventMarket，宏观题目要从精确数字改为区间。Phase 1 模板：

| 指标 | outcome 设计 | 区间依据 |
|---|---|---|
| CPI YoY | < 2.5% / 2.5–3.5% / > 3.5% | 2024-26 历史范围 + 当前共识 |
| Fed Funds Rate（下次 FOMC） | 不变 / 加 25bp / 加 50bp+ / 降 25bp+ | FOMC 历史步长 |
| Non-Farm Payrolls | < 100k / 100–200k / > 200k | 近 2 年波动范围 |

具体阈值在 `sources/fred-macro.ts` 中维护，可按数据漂移更新。

### 5.4 自动化钱包

- 一个专用的 EOA，仅持有少量 ETH 用于 gas + 少量 USDC 用于引导流动性。
- 私钥放 Vercel Environment Variables。
- 权限：oracle 的 owner / EventMarket 的 owner（用于 createMarket、proposeResult），ERC20 transferFrom（仅 seed liquidity）。无任何资产转出权限。
- 不复用 deployer 钱包。Phase 1 部署时把 oracle/EventMarket 的 ownership transferOwnership 到此钱包，或把 deployer 也保留为 backup admin。

### 5.4 引导流动性

新市场创建后立即调用 seed liquidity：
- Phase 1 固定金额：每个市场 10 USDC（每个 outcome 均分）
- 自动化钱包持有少量 USDC 余额，cron 监控低于阈值时打日志告警
- Phase 2 再做策略化（按品类、热度差异化）

### 5.5 Cron 执行环境

- **平台**：Vercel Cron（已有 web app 部署）
- **路径**：`/api/cron/markets/tick`
- **频率**：`0 2 * * *`（每日 02:00 UTC）
- **鉴权**：Header `Authorization: Bearer ${CRON_SECRET}`
- **fallback**：GitHub Actions（如果 Vercel Cron 出问题，同样的 endpoint 用 GH Actions 触发）

## 6. AI Lens 协同

### 6.1 新增两个 contextBuilder

```
web/lib/lens/contextBuilders/
├── crypto.ts      ← 已有
├── event.ts       ← 已有
├── macro.ts       ← 新增
└── chain.ts       ← 新增
```

### 6.2 macro.ts 内容契约

context block 拼装：
1. 当前题目元数据（指标、目标值、deadline）
2. FRED 拉的历史序列（最近 12 个月）
3. 同类指标对照（CPI 题目时附带 PCE、Core CPI、PPI）
4. 共识预期值（来自 Cleveland Fed Nowcast 或类似源；可选，不强依赖）
5. 相关资产联动（BTC/ETH 在过去 3 次同类数据公布前后的价格 delta）

### 6.3 chain.ts 内容契约

context block 拼装：
1. 当前题目元数据
2. DefiLlama 当前数值 + 3/7/30 天变化
3. 子组成拆解（TVL = staking + DEX + lending + ...）
4. 历史里程碑（上次达到 X 的日期）
5. 距 deadline 的剩余时间 + 实现所需日均增长率

### 6.4 预生成 cache

- cron tick 在 createMarket 后调用 `lensPreloader.warm(marketId)`
- 调用 Lens 路由，结果写入现有 `web/lib/lens/cache.ts` 的 cache 层
- TTL 24 小时（与现有 Lens cache 策略对齐）
- 用户首次访问新市场零延迟看到 Lens 分析

### 6.5 调用路径零改动

复用现有 `web/lib/lens/route-handler.ts` 的 dispatch 表，新增 2 行 mapping（`macro → macro.ts`、`chain → chain.ts`），不动 LLM 接口 / prompts / budget / cache 任何层。

## 7. 落地路径

### 7.1 Phase 1（Week 1）：框架 + 2 个品类落地

| Day | 任务 | 交付物 |
|---|---|---|
| 1 | MarketSource 接口、registry、cron 骨架 | tick endpoint 可手动触发（empty registry） |
| 1-2 | FRED / DefiLlama 数据 clients | 单测覆盖，本地 cache 工作 |
| 2-3 | fred-macro source（CPI + Fed Funds + NFP，区间 outcomes） | cron 自动开 3 类宏观市场 |
| 3 | chain-event source（Token unlock + TVL 阈值） | cron 自动开链上市场 |
| 4 | chain-reader / chain-writer：createMarket + propose + finalize + EventMarket.resolve + seed | 端到端：cron → 链 → 前端可见 |
| 4 | macro.ts / chain.ts Lens contextBuilder + 预生成 hook | Lens 在新品类工作 |
| 5 | 前端 MarketCategory tabs + homepage widget | UI 上 4 类全部可浏览 |
| 5 | E2E smoke test（mainnet fork 跑一次完整 tick） | Phase 1 收尾 |

**Phase 1 验收标准**：
- cron 自动开出至少 5 个宏观市场 + 5 个链上市场
- 一个 mock 结题流程跑通（用历史日期触发 settle）
- 前端 4 个 tab 可浏览、下注、看 Lens 分析
- 一次 cron tick < 60s
- 24h 稳定运行 + 至少 1 个真实自动结题成功 → 触发 Phase 2

### 7.2 Phase 2（Week 2-3）：体育

- the-odds-api source：EPL 或 NBA 赛程
- 复用 EventMarket + AdminEventOracle，无新合约
- Discord 发更新："上线体育品类，覆盖 X 联赛"

### 7.3 Phase 3（Week 4+）：迭代弹药

- 电竞（Pandascore）
- 链上事件深化（协议升级、桥接 TVL、新链上线日）
- 每个动作 = 1 个 source plugin = 1 篇 Discord 更新

## 8. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| FRED API 限速或下线 | 宏观市场无法开/结 | 单 source 失败局部化；本地 24h cache；Phase 1 跑通后接 fallback 数据源 |
| DefiLlama 短暂不可用 | 链上市场无法开/结 | 同上 + 链上数据可直接走 RPC 兜底 |
| 自动化钱包私钥泄漏 | 资金 + 错题风险 | 仅持小额 ETH + 必要 USDC；权限白名单；定期轮换 |
| 题目颗粒度不对（无人下注） | 流动性死寂 | Phase 1 开 10 个市场观察 7 天 take rate，颗粒度差就调题目模板 |
| cron 单次超 60s | 部分操作未完成 | 每 source 限额 5 新建 + 10 resolve；下次 tick 继续 |
| 数据公布延迟导致 resolveAfter 早于实际可结题时间 | resolve 持续返回 still-open | 这是预期行为；监控连续 3 次 still-open 打告警 |
| AdminEventOracle 被恶意挑战 | 自动结题被中断，等 owner 手动处理 | Phase 1 单 source 每天 1-3 个新市场，预期罕见；记录告警，owner 介入 |
| 自动化钱包被设为 oracle owner 后忘记备份 | owner 单点失败 | 部署时把 deployer 也保留为 backup admin，或先 multisig |

## 9. 关键决策记录

| # | 决策 | 选择 | 备选 | 选择理由 |
|---|---|---|---|---|
| D1 | 是否引入数据库 | 不引入 | Postgres / JSON 文件 | 链上 + 数据源已是真相，cron 无状态可还原所有信息 |
| D2 | 宏观题目结题路径 | 题目 event 化（discrete outcome） | 新增 FredPriceAdapter 兼容 Pyth | v0.1 选 adapter；v0.2 摸合约后改判：PredictionMarket.resolve 走 Pyth `parsePriceFeedUpdatesUnique` push 流程，adapter 兼容 100+ 行+ETH fee 模拟，复杂度远超预期；event 化代价仅是颗粒度变区间，换来零新合约 + 全品类单一结题路径 |
| D3 | cron 平台 | Vercel Cron | GH Actions / 独立服务 | 已有 Vercel 部署，零新基础设施 |
| D4 | Phase 1 品类选择 | 宏观 + 链上 | 宏观/体育/AI/选举/电竞 | 数据源最稳定、自动化最彻底、与 Lens 协同最强 |
| D5 | 评估颗粒度 | 单 tick = 5 新建 + 10 resolve 上限 | 不限 / 异步队列 | Vercel 60s 限制；上限简单可调 |
| D6 | 引导流动性策略 | 固定 10 USDC/市场 | 按品类差异化 / 不引导 | 简单可控；Phase 2 再策略化 |
| D7 | OpenSpec 流程 | 走完整 OpenSpec | 仅 superpowers spec | CLAUDE.md 强制；ai-lens 已有先例 |

## 10. Out of Scope

明确不在本次范围：

- 不开发新的 LLM/AI Lens 视角（只复用现有 Lens 框架）
- 不修改 worldcup 现有流程
- 不引入新链 / 跨链 / L2 桥
- 不做用户自创题目（UGC）
- 不做实时数据流（cron 1 次/天足够 Phase 1）
- 不做策略化引导流动性（Phase 2 再说）
- 不做 admin dashboard UI（cron 状态查 Vercel 日志即可）

## 11. 后续步骤

1. 用户复核本设计文档（你正在做的事）
2. 复核通过后，用 `superpowers:writing-plans` 生成实施计划
3. 实施计划同时生成 `openspec/changes/add-automated-categories/` 提案目录
4. 按 OpenSpec 流程实施 Phase 1

---

*Spec lineage: 2026-06-07 arc-predict → 2026-06-11 phase16 → 2026-06-14 synthra-redesign → 2026-06-15 ai-lens → 2026-06-17 categories-expansion*
