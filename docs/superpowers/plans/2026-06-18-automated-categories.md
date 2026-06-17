# ArcPredict · 自动化品类扩展实施计划（Phase 1）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 ArcPredict 引入 `macro`（宏观经济）与 `chain`（链上事件）两个**全自动化品类**，并落地一套可复用的 `MarketSource` 插件框架 + Vercel Cron 自动化管道。Phase 1 范围：框架 + 2 个品类 + Lens 协同 + 前端 4 类 tab。

**Architecture:**
1. **off-chain TS 层**：`MarketSource` 插件接口 + 注册表 + cron orchestrator，无外部 DB，靠链上 + deterministic `externalKey` 保证幂等。
2. **合约层**：仅新增 `FredPriceAdapter.sol`（Pyth 兼容接口，~30 行），复用现有 `PredictionMarket / EventMarket / AdminEventOracle`。
3. **AI Lens 层**：新增 `macro.ts` / `chain.ts` 两个 contextBuilder，复用现有 `route-handler.ts`，cron 顺手预生成 24h cache。
4. **前端层**：`MarketCategory` enum 扩到 4 类，`MarketFilterBar` 加 2 个 tab，`HomeHero` 暴露新品类。

**Tech Stack:** Next.js 14 (App Router) · TypeScript · Foundry · Solidity 0.8.20 · Vercel Cron · viem · zod · Vitest · DefiLlama / FRED 公开 API

**Source spec:** `docs/superpowers/specs/2026-06-17-categories-expansion-design.md`

**OpenSpec change id:** `add-automated-categories`

---

## 工作目录与命令约定

```bash
# 前端 / off-chain
cd web
pnpm install
pnpm typecheck
pnpm lint
pnpm vitest run                          # 全量 unit test
pnpm vitest run test/markets             # 仅本计划相关
pnpm build
pnpm dev

# 合约
cd contracts
forge build
forge test
forge test --match-contract FredPriceAdapter
forge script script/DeployFredAdapter.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
```

**新增环境变量（`.env.local` 与 Vercel Project Env）：**

```ini
# Cron 鉴权
CRON_SECRET=                              # 32 字节随机串

# 自动化钱包
AUTOMATION_PRIVATE_KEY=                   # 0x...，仅持小额 ETH + 必要 USDC
AUTOMATION_RPC_URL=                       # mainnet / L2 RPC

# 合约地址
NEXT_PUBLIC_FRED_ADAPTER_ADDRESS=         # 部署后填入

# 外部 API（均为 free tier，无需 key 也能 demo，但有 key 限速更宽）
FRED_API_KEY=                             # 可选，https://fred.stlouisfed.org/docs/api/api_key.html
DEFILLAMA_BASE_URL=https://api.llama.fi   # 默认值
```

**测试基础设施约定：**

- TS 单测：Vitest，文件 `web/test/markets/**.test.ts`
- 合约测试：Foundry，文件 `contracts/test/FredPriceAdapter.t.sol`
- E2E：mainnet fork via `anvil --fork-url $MAINNET_RPC`

---

## 文件结构总览

```
contracts/                                ← 不动（无新合约、无修改）

web/
├── lib/
│   ├── market-kind.ts                    ← MOD: 扩 MarketCategory
│   ├── markets/                          ← NEW 目录
│   │   ├── external-key.ts               ← marketId 确定性哈希
│   │   ├── registry.ts                   ← enabled sources 注册表
│   │   ├── sources/
│   │   │   ├── base.ts                   ← MarketSource 接口
│   │   │   ├── fred-macro.ts             ← Phase 1 品类 #1
│   │   │   └── chain-event.ts            ← Phase 1 品类 #2
│   │   ├── clients/
│   │   │   ├── fred.ts                   ← FRED API 客户端
│   │   │   └── defillama.ts              ← DefiLlama API 客户端
│   │   └── scheduler/
│   │       ├── tick.ts                   ← cron 单次执行入口
│   │       ├── chain-reader.ts           ← 读链上市场状态
│   │       ├── chain-writer.ts           ← 写链：create / settle / invalidate / seed
│   │       └── lens-preloader.ts         ← 预生成 Lens cache
│   └── lens/
│       ├── route-handler.ts              ← MOD: 新增 macro/chain 分发
│       └── contextBuilders/
│           ├── macro.ts                  ← NEW
│           └── chain.ts                  ← NEW
├── app/
│   └── api/cron/markets/tick/
│       └── route.ts                      ← NEW: Vercel Cron 入口
├── components/
│   ├── MarketFilterBar.tsx               ← MOD: 加 2 tab
│   └── HomeHero.tsx                      ← MOD: surface 新品类
└── test/
    └── markets/                          ← NEW: 单测目录

vercel.json                                ← MOD: cron 配置

openspec/changes/add-automated-categories/  ← NEW: OpenSpec 提案
├── proposal.md
├── design.md
├── tasks.md
└── specs/
    ├── market-sources/spec.md            ← ADDED capability
    ├── market-category/spec.md           ← MODIFIED capability
    └── ai-lens/spec.md                   ← MODIFIED capability
```

---

## Phase 0：OpenSpec 提案脚手架

> 按 CLAUDE.md 强制要求：新能力先有 OpenSpec 提案，再实施。
> 本 Phase 不写代码，仅落档 spec delta，作为 Phase A+ 的契约源。

### Task 0.1：创建 OpenSpec 变更目录骨架

**Files:**
- Create: `openspec/changes/add-automated-categories/proposal.md`
- Create: `openspec/changes/add-automated-categories/design.md`
- Create: `openspec/changes/add-automated-categories/tasks.md`

- [ ] **Step 1: 创建 proposal.md**

```markdown
# Change: 引入 macro / chain 两个全自动化品类与 MarketSource 框架

## Why
当前 ArcPredict 只有 crypto + worldcup 两类市场，且 worldcup 题目手工 seed，
持续运营成本高。为支持 Arc Discord builder 路径上的持续可见迭代，需建立
"零人工维护、自动开市 + 自动结题"的品类管道，并立刻填充 2 个新品类。

## What Changes
- 新增 capability **market-sources**：MarketSource 插件接口 + 注册表 + cron orchestrator
- **MODIFIED** capability **market-category**：MarketCategory enum 扩展 `'macro' | 'chain'`
- **MODIFIED** capability **ai-lens**：新增 macro / chain 两个 contextBuilder
- Phase 1 接入 2 个具体 source：`fred-macro`（CPI / Fed Funds / NFP，全部 discrete outcome 区间）+ `chain-event`（Token unlock / TVL 阈值）
- 全品类统一走 EventMarket + AdminEventOracle，零新合约（v0.2 pivot，见 spec §9 D2）

## Impact
- Affected specs: market-category, ai-lens, market-sources (new)
- Affected code:
  - web/lib/market-kind.ts (扩 enum)
  - web/lib/markets/** (整个新目录)
  - web/lib/lens/contextBuilders/{macro,chain}.ts (NEW)
  - web/lib/lens/route-handler.ts (新增 dispatch)
  - web/app/api/cron/markets/tick/route.ts (NEW)
  - web/components/{MarketFilterBar,HomeHero}.tsx (扩展)
  - vercel.json (cron 配置)
- 无破坏性变更（worldcup / crypto 流程不动）
- 无合约改动（FredPriceAdapter 方案已废弃，见 spec v0.2 修订）
```

- [ ] **Step 2: 创建 design.md（链接到 superpowers 设计文档）**

```markdown
# Design: add-automated-categories

完整技术设计见：
[`docs/superpowers/specs/2026-06-17-categories-expansion-design.md`](../../../docs/superpowers/specs/2026-06-17-categories-expansion-design.md)

OpenSpec design.md 仅列要点与决策记录，避免双份维护。

## 关键决策

| # | 决策 | 选择 | 备选 | 理由 |
|---|---|---|---|---|
| D1 | 数据持久化 | 无外部 DB | Postgres / JSON | 链上 + 数据源即真相 |
| D2 | price kind 自动结题 | 新增 FredPriceAdapter | 题目 event 化 | 保留数字目标颗粒度 |
| D3 | cron 平台 | Vercel Cron | GH Actions | 已有部署，零新基础设施 |
| D4 | Phase 1 品类 | macro + chain | sports / esports | 数据源最稳、与 Lens 协同最强 |
| D5 | tick 上限 | 5 新建 + 10 resolve / source | 不限 | Vercel 60s 限制 |
| D6 | 引导流动性 | 固定 10 USDC | 策略化 | Phase 1 简单可控 |

## 架构图

参见 superpowers 设计文档 §3。
```

- [ ] **Step 3: 创建 tasks.md（与本 plan 的 Phase 对齐）**

```markdown
# Tasks: add-automated-categories

## Phase 0: OpenSpec scaffolding
- [ ] 0.1 创建 openspec/changes/add-automated-categories/ 骨架
- [ ] 0.2 落档 spec delta（market-sources / fred-adapter / market-category / ai-lens）
- [ ] 0.3 运行 `openspec validate add-automated-categories --strict`

## Phase A: Types & primitives
- [ ] A.1 扩展 MarketCategory enum
- [ ] A.2 实现 external-key marketId 哈希工具
- [ ] A.3 实现 MarketSource 接口与基础类型
- [ ] A.4 实现 source registry

## Phase B: 数据源 clients
- [ ] B.1 FRED API 客户端 + 缓存
- [ ] B.2 DefiLlama API 客户端 + 缓存

## Phase D: 链上交互层
- [ ] D.1 chain-reader（扫 EventMarket events + 读 oracle status）
- [ ] D.2 chain-writer（createMarket / proposeResult / finalizeResult / EventMarket.resolve / seedLiquidity）

## Phase E: Sources 实现
- [ ] E.1 fred-macro source（CPI + Fed Funds + NFP）
- [ ] E.2 chain-event source（Token unlock + TVL 阈值）

## Phase F: AI Lens
- [ ] F.1 macro.ts contextBuilder
- [ ] F.2 chain.ts contextBuilder
- [ ] F.3 route-handler dispatch 扩展
- [ ] F.4 lens-preloader

## Phase G: Cron orchestrator
- [ ] G.1 tick.ts 主循环
- [ ] G.2 /api/cron/markets/tick route handler
- [ ] G.3 vercel.json cron 配置

## Phase H: 前端
- [ ] H.1 MarketFilterBar 扩 4 tab
- [ ] H.2 HomeHero 暴露新品类入口

## Phase I: 验收
- [ ] I.1 mainnet fork E2E smoke test
- [ ] I.2 测试网 24h 稳定运行验收

## Phase J: 归档
- [ ] J.1 合并 delta 到 openspec/specs/
- [ ] J.2 归档变更到 archive/YYYY-MM-DD-add-automated-categories/
```

- [ ] **Step 4: 提交**

```bash
git add openspec/changes/add-automated-categories/
git commit -m "openspec(propose): add-automated-categories 骨架"
```

### Task 0.2：落档 3 份 spec delta

**Files:**
- Create: `openspec/changes/add-automated-categories/specs/market-sources/spec.md`
- Create: `openspec/changes/add-automated-categories/specs/market-category/spec.md`
- Create: `openspec/changes/add-automated-categories/specs/ai-lens/spec.md`

- [ ] **Step 1: market-sources/spec.md（ADDED）**

```markdown
## ADDED Requirements

### Requirement: MarketSource 插件接口

系统 SHALL 提供 `MarketSource` 接口供新品类实现，每个 source 自包含
`fetchUpcoming` 与 `resolve` 两个生命周期方法，并通过 deterministic
`externalKey` 保证 cron 多次 tick 的幂等。

#### Scenario: 新品类无需改动 cron
- **WHEN** 工程师新增一个 `MarketSource` 实现并注册到 registry
- **THEN** cron tick SHALL 自动调用它的 `fetchUpcoming` 与 `resolve`
- **AND** 无需修改 `tick.ts` / `chain-writer.ts` / `chain-reader.ts`

#### Scenario: 幂等去重
- **WHEN** cron 在同一天连跑两次 tick
- **THEN** 同一 `externalKey` 对应的 marketId SHALL 不会被重复 createMarket
- **AND** 链上 `markets[marketId]` 已存在的检查 SHALL 阻止重复开市

### Requirement: Cron 单次执行约束

系统 SHALL 在单次 cron tick 内对每个 source 限制：最多创建 5 个新市场、
最多结题 10 个已到期市场，剩余项延后到下次 tick 处理。

#### Scenario: 限额生效
- **WHEN** 某个 source 的 `fetchUpcoming` 返回 8 个 drafts
- **THEN** chain-writer SHALL 仅处理前 5 个
- **AND** 剩余 3 个在下次 tick 自动重新出现并被处理

### Requirement: 失败局部化

系统 SHALL 在单个 source 抛错时局部化失败，其他 source 不受影响。

#### Scenario: 单 source 失败不阻塞
- **WHEN** `fred-macro` 在 `fetchUpcoming` 抛 fetch timeout
- **THEN** `chain-event` source SHALL 仍正常执行
- **AND** cron tick 整体 SHALL 返回 200，但 response body 包含 per-source error
```

- [ ] **Step 2: market-category/spec.md（MODIFIED）**

```markdown
## MODIFIED Requirements

### Requirement: MarketCategory enum 覆盖 4 类

前端 `MarketCategory` 类型 SHALL 包含 `'crypto' | 'worldcup' | 'macro' | 'chain'`
共 4 个值；所有依赖该类型的过滤、路由、UI 渲染 SHALL 完整覆盖 4 类。

#### Scenario: 4 类 tab 可点选
- **WHEN** 用户访问 `/`
- **THEN** MarketFilterBar SHALL 渲染 4 个 category tab
- **AND** 点击每个 tab SHALL 显示对应 category 的市场列表

#### Scenario: 类型穷举检查
- **WHEN** 任意 switch / mapping 引用 MarketCategory
- **THEN** TypeScript SHALL 编译报错若漏掉任一新增 case
```

- [ ] **Step 3: ai-lens/spec.md（MODIFIED）**

```markdown
## MODIFIED Requirements

### Requirement: Lens 覆盖 4 类市场

`web/lib/lens/route-handler.ts` SHALL 按 `market.category` 分发到对应
contextBuilder：crypto / event / macro / chain。

#### Scenario: macro 市场 Lens 分析
- **WHEN** 用户对 category=macro 的市场触发 Ask AI
- **THEN** route-handler SHALL 使用 `contextBuilders/macro.ts` 拼装 context
- **AND** context SHALL 包含 FRED 历史序列 + 同类指标对照 + 相关资产联动

#### Scenario: chain 市场 Lens 分析
- **WHEN** 用户对 category=chain 的市场触发 Ask AI
- **THEN** route-handler SHALL 使用 `contextBuilders/chain.ts` 拼装 context
- **AND** context SHALL 包含 DefiLlama 当前值 + 子组成拆解 + 历史里程碑

### Requirement: Lens cache 预生成

Cron 在创建新市场后 SHALL 立即调用 lens-preloader，预生成 Lens 分析并写入
现有 cache 层，TTL 24 小时。预生成失败不阻塞 createMarket 主流程。
```

- [ ] **Step 4: 验证 + 提交**

```bash
openspec validate add-automated-categories --strict
git add openspec/changes/add-automated-categories/specs/
git commit -m "openspec(propose): 落档 3 份 spec delta"
```

预期：validate 通过，无 schema 错误。

---

## Phase A：Types & 基础工具

### Task A.1：扩展 MarketCategory enum

**Files:**
- Modify: `web/lib/market-kind.ts`
- Test: `web/test/markets/market-kind.test.ts`

- [ ] **Step 1: 写失败测试**

`web/test/markets/market-kind.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { MARKET_CATEGORIES, type MarketCategory } from '@/lib/market-kind';

describe('MarketCategory enum', () => {
  it('contains all 4 categories', () => {
    expect(MARKET_CATEGORIES).toEqual(['crypto', 'worldcup', 'macro', 'chain']);
  });

  it('exhaustive switch compiles for all categories', () => {
    const label = (c: MarketCategory): string => {
      switch (c) {
        case 'crypto':   return 'Crypto';
        case 'worldcup': return 'World Cup';
        case 'macro':    return 'Macro';
        case 'chain':    return 'On-chain';
      }
    };
    expect(label('macro')).toBe('Macro');
    expect(label('chain')).toBe('On-chain');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd web && pnpm vitest run test/markets/market-kind.test.ts
```

预期：FAIL — `MARKET_CATEGORIES` 当前只有 2 项。

- [ ] **Step 3: 修改 market-kind.ts**

```typescript
// web/lib/market-kind.ts (顶部附近)
export type MarketCategory = 'crypto' | 'worldcup' | 'macro' | 'chain';
export const MARKET_CATEGORIES: MarketCategory[] = ['crypto', 'worldcup', 'macro', 'chain'];
```

- [ ] **Step 4: 跑测试确认通过 + typecheck**

```bash
pnpm vitest run test/markets/market-kind.test.ts
pnpm typecheck
```

预期：测试 PASS；typecheck 可能在其他文件报"switch 未覆盖 macro/chain"——**先记录，后续 Task H.1 修复**。

- [ ] **Step 5: 提交**

```bash
git add web/lib/market-kind.ts web/test/markets/market-kind.test.ts
git commit -m "feat(markets): extend MarketCategory to 4 values"
```

### Task A.2：实现 external-key marketId 哈希工具

**Files:**
- Create: `web/lib/markets/external-key.ts`
- Test: `web/test/markets/external-key.test.ts`

- [ ] **Step 1: 写失败测试**

`web/test/markets/external-key.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { computeMarketId } from '@/lib/markets/external-key';

describe('computeMarketId', () => {
  it('produces deterministic 32-byte hash', () => {
    const id1 = computeMarketId('fred-macro', 'CPIAUCSL:2026-07-15');
    const id2 = computeMarketId('fred-macro', 'CPIAUCSL:2026-07-15');
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('produces different ids for different sources', () => {
    const a = computeMarketId('fred-macro', 'X');
    const b = computeMarketId('chain-event', 'X');
    expect(a).not.toBe(b);
  });

  it('produces different ids for different externalKeys', () => {
    const a = computeMarketId('fred-macro', 'A');
    const b = computeMarketId('fred-macro', 'B');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run test/markets/external-key.test.ts
```

预期：FAIL — `computeMarketId` 不存在。

- [ ] **Step 3: 实现**

`web/lib/markets/external-key.ts`

```typescript
import { keccak256, toBytes, concat, stringToBytes } from 'viem';

export type MarketSourceId = string;
export type ExternalKey = string;

/**
 * 通过 sourceId + externalKey 派生确定性的 32-byte marketId。
 * 同一对 (sourceId, externalKey) 永远生成同一 marketId，
 * 配合链上 markets[id] 存在性检查实现 cron 幂等。
 */
export function computeMarketId(
  sourceId: MarketSourceId,
  externalKey: ExternalKey,
): `0x${string}` {
  const packed = concat([
    stringToBytes(sourceId),
    toBytes(0x1f),                 // separator (US, ASCII unit separator)
    stringToBytes(externalKey),
  ]);
  return keccak256(packed);
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run test/markets/external-key.test.ts
```

预期：3 PASS。

- [ ] **Step 5: 提交**

```bash
git add web/lib/markets/external-key.ts web/test/markets/external-key.test.ts
git commit -m "feat(markets): deterministic marketId hashing"
```

### Task A.3：MarketSource 接口与基础类型

**Files:**
- Create: `web/lib/markets/sources/base.ts`
- Test: `web/test/markets/source-base.test.ts`

- [ ] **Step 1: 写失败测试**

`web/test/markets/source-base.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  type MarketSource,
  type MarketDraft,
  type ResolvedOutcome,
  ResolveStillOpen,
} from '@/lib/markets/sources/base';

describe('MarketSource base types', () => {
  it('MarketDraft requires at least 2 outcomes', () => {
    const d: MarketDraft = {
      externalKey: 'k',
      category: 'macro',
      question: 'Q',
      outcomes: [
        { id: 'lt', label: '< 2.5%' },
        { id: 'mid', label: '2.5-3.5%' },
        { id: 'gt', label: '> 3.5%' },
      ],
      betDeadline: 0,
      resolveAfter: 0,
      resolveSourceMeta: {},
    };
    expect(d.outcomes).toHaveLength(3);
  });

  it('ResolveStillOpen is a singleton', () => {
    const r: ResolvedOutcome = ResolveStillOpen;
    expect(r.kind).toBe('still-open');
  });

  it('MarketSource shape compiles', () => {
    const fake: MarketSource = {
      id: 'fake',
      category: 'macro',
      enabled: true,
      async fetchUpcoming() { return []; },
      async resolve() { return ResolveStillOpen; },
    };
    expect(fake.id).toBe('fake');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run test/markets/source-base.test.ts
```

预期：FAIL — 文件不存在。

- [ ] **Step 3: 实现**

`web/lib/markets/sources/base.ts`

```typescript
import type { MarketCategory } from '@/lib/market-kind';
import type { ExternalKey, MarketSourceId } from '@/lib/markets/external-key';

export interface OutcomeOption {
  id: string;
  label: string;
}

export interface MarketDraft {
  externalKey: ExternalKey;
  category: MarketCategory;
  question: string;
  outcomes: OutcomeOption[];     // ≥ 2，宏观题目用区间
  betDeadline: number;            // unix sec
  resolveAfter: number;           // unix sec
  resolveSourceMeta: Record<string, unknown>;
}

export type OracleStatus = 'pending' | 'proposed' | 'challenged' | 'finalized';

export type OnChainMarket = {
  marketId: bigint;                    // EventMarket 自动分配的 uint256 id
  eventId: `0x${string}`;              // 我们派生的 deterministic key
  sourceId: MarketSourceId;
  externalKey: ExternalKey;
  question: string;
  outcomeCount: number;
  betDeadline: number;
  resolveAfter: number;
  isSettled: boolean;                  // EventMarket.settledOutcome != UNRESOLVED
  oracleStatus: OracleStatus;
  proposedAt?: number;                 // oracle.proposeResult 时间，用于 challenge window 判断
};

export type ResolvedOutcome =
  | { kind: 'still-open' }
  | { kind: 'invalid'; reason: string }
  | {
      kind: 'settled';
      settledOutcomeIndex: number;
      publishedAt: number;
      evidence?: { sourceUrl: string; rawValue: unknown };
    };

export const ResolveStillOpen: ResolvedOutcome = { kind: 'still-open' };

export interface MarketSource {
  id: MarketSourceId;
  category: MarketCategory;
  enabled: boolean;
  fetchUpcoming(now: Date): Promise<MarketDraft[]>;
  resolve(market: OnChainMarket, now: Date): Promise<ResolvedOutcome>;
  buildLensContext?(market: OnChainMarket): Promise<Record<string, unknown>>;
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run test/markets/source-base.test.ts
pnpm typecheck
```

预期：3 PASS，typecheck OK。

- [ ] **Step 5: 提交**

```bash
git add web/lib/markets/sources/base.ts web/test/markets/source-base.test.ts
git commit -m "feat(markets): MarketSource interface + types"
```

### Task A.4：Source registry

**Files:**
- Create: `web/lib/markets/registry.ts`
- Test: `web/test/markets/registry.test.ts`

- [ ] **Step 1: 写失败测试**

`web/test/markets/registry.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetRegistry,
  registerSource,
  enabledSources,
  getSource,
} from '@/lib/markets/registry';
import { ResolveStillOpen, type MarketSource } from '@/lib/markets/sources/base';

const make = (id: string, enabled = true): MarketSource => ({
  id,
  category: 'macro',
  enabled,
  async fetchUpcoming() { return []; },
  async resolve() { return ResolveStillOpen; },
});

describe('source registry', () => {
  beforeEach(() => resetRegistry());

  it('registers and returns enabled sources only', () => {
    registerSource(make('a', true));
    registerSource(make('b', false));
    expect(enabledSources().map((s) => s.id)).toEqual(['a']);
  });

  it('rejects duplicate registration', () => {
    registerSource(make('a'));
    expect(() => registerSource(make('a'))).toThrow(/duplicate/i);
  });

  it('getSource returns by id (or undefined)', () => {
    const s = make('a');
    registerSource(s);
    expect(getSource('a')).toBe(s);
    expect(getSource('missing')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run test/markets/registry.test.ts
```

预期：FAIL。

- [ ] **Step 3: 实现**

`web/lib/markets/registry.ts`

```typescript
import type { MarketSource } from '@/lib/markets/sources/base';

const sources = new Map<string, MarketSource>();

export function registerSource(source: MarketSource): void {
  if (sources.has(source.id)) {
    throw new Error(`duplicate source registration: ${source.id}`);
  }
  sources.set(source.id, source);
}

export function enabledSources(): MarketSource[] {
  return Array.from(sources.values()).filter((s) => s.enabled);
}

export function getSource(id: string): MarketSource | undefined {
  return sources.get(id);
}

/** 仅用于单测，清空注册表。 */
export function resetRegistry(): void {
  sources.clear();
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run test/markets/registry.test.ts
```

预期：3 PASS。

- [ ] **Step 5: 提交**

```bash
git add web/lib/markets/registry.ts web/test/markets/registry.test.ts
git commit -m "feat(markets): source registry"
```

---

## Phase B：数据源 clients

### Task B.1：FRED API 客户端

**Files:**
- Create: `web/lib/markets/clients/fred.ts`
- Test: `web/test/markets/clients/fred.test.ts`

**Background:** FRED REST API `https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=$KEY&file_type=json`。无 key 时回退 `&api_key=` 可读公开端点（限速更严，但 demo 够用）。我们关心两类调用：
1. `getReleaseSchedule(seriesId)` — 数据发布日历
2. `getLatestObservation(seriesId)` — 最新公布值（用于结题）

- [ ] **Step 1: 写失败测试（用 mock fetch）**

`web/test/markets/clients/fred.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createFredClient } from '@/lib/markets/clients/fred';

const mockFetch = (payload: unknown, status = 200) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });

describe('fred client', () => {
  it('getLatestObservation parses value + date', async () => {
    const fetch = mockFetch({
      observations: [
        { date: '2026-06-12', value: '3.21' },
        { date: '2026-05-15', value: '3.18' },
      ],
    });
    const c = createFredClient({ fetch: fetch as unknown as typeof globalThis.fetch });
    const obs = await c.getLatestObservation('CPIAUCSL');
    expect(obs).toEqual({ date: '2026-06-12', value: 3.21 });
  });

  it('returns null when observations array is empty', async () => {
    const fetch = mockFetch({ observations: [] });
    const c = createFredClient({ fetch: fetch as unknown as typeof globalThis.fetch });
    expect(await c.getLatestObservation('X')).toBeNull();
  });

  it('throws on non-200', async () => {
    const fetch = mockFetch({}, 500);
    const c = createFredClient({ fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(c.getLatestObservation('X')).rejects.toThrow(/FRED/);
  });

  it('cache hits skip fetch for TTL', async () => {
    const fetch = mockFetch({ observations: [{ date: '2026-06-01', value: '1' }] });
    const c = createFredClient({
      fetch: fetch as unknown as typeof globalThis.fetch,
      cacheTtlMs: 60_000,
      now: () => 0,
    });
    await c.getLatestObservation('X');
    await c.getLatestObservation('X');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run test/markets/clients/fred.test.ts
```

- [ ] **Step 3: 实现**

`web/lib/markets/clients/fred.ts`

```typescript
export type FredObservation = { date: string; value: number };

type CacheEntry<T> = { value: T; expiresAt: number };

export interface FredClient {
  getLatestObservation(seriesId: string): Promise<FredObservation | null>;
  getObservationByDate(seriesId: string, date: string): Promise<FredObservation | null>;
}

export interface FredClientOptions {
  fetch?: typeof globalThis.fetch;
  apiKey?: string;
  baseUrl?: string;
  cacheTtlMs?: number;
  now?: () => number;
}

export function createFredClient(opts: FredClientOptions = {}): FredClient {
  const fetch = opts.fetch ?? globalThis.fetch;
  const baseUrl = opts.baseUrl ?? 'https://api.stlouisfed.org/fred';
  const apiKey = opts.apiKey ?? process.env.FRED_API_KEY ?? '';
  const ttl = opts.cacheTtlMs ?? 24 * 60 * 60 * 1000;
  const now = opts.now ?? Date.now;
  const cache = new Map<string, CacheEntry<unknown>>();

  const cached = async <T>(key: string, loader: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now()) return hit.value as T;
    const value = await loader();
    cache.set(key, { value, expiresAt: now() + ttl });
    return value;
  };

  const get = async (path: string, qs: Record<string, string>): Promise<any> => {
    const url = new URL(`${baseUrl}${path}`);
    for (const [k, v] of Object.entries({ ...qs, api_key: apiKey, file_type: 'json' })) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`FRED ${path} ${res.status}`);
    return res.json();
  };

  const parseObs = (raw: any): FredObservation | null => {
    if (!raw || raw.value === '.' || raw.value == null) return null;
    const value = Number(raw.value);
    if (Number.isNaN(value)) return null;
    return { date: String(raw.date), value };
  };

  return {
    async getLatestObservation(seriesId) {
      return cached(`latest:${seriesId}`, async () => {
        const data = await get('/series/observations', {
          series_id: seriesId,
          sort_order: 'desc',
          limit: '1',
        });
        return parseObs(data.observations?.[0]);
      });
    },

    async getObservationByDate(seriesId, date) {
      return cached(`obs:${seriesId}:${date}`, async () => {
        const data = await get('/series/observations', {
          series_id: seriesId,
          observation_start: date,
          observation_end: date,
        });
        return parseObs(data.observations?.[0]);
      });
    },
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run test/markets/clients/fred.test.ts
```

预期：4 PASS。

- [ ] **Step 5: 提交**

```bash
git add web/lib/markets/clients/fred.ts web/test/markets/clients/fred.test.ts
git commit -m "feat(markets): FRED API client with 24h cache"
```

### Task B.2：DefiLlama API 客户端

**Files:**
- Create: `web/lib/markets/clients/defillama.ts`
- Test: `web/test/markets/clients/defillama.test.ts`

**Background:** DefiLlama 公开 endpoint：
- 链 TVL：`GET https://api.llama.fi/v2/chains` → 列出所有链当前 TVL
- 协议 TVL：`GET https://api.llama.fi/protocol/{slug}` → 时间序列
- Gas：`GET https://api.llama.fi/chains` 不提供，gas 走 RPC

我们用前两个端点。

- [ ] **Step 1: 写失败测试**

`web/test/markets/clients/defillama.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createDefiLlamaClient } from '@/lib/markets/clients/defillama';

const mockFetch = (payload: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => payload });

describe('defillama client', () => {
  it('getChainTvl returns current TVL in USD', async () => {
    const fetch = mockFetch([
      { name: 'Ethereum', tvl: 123_456_789_000 },
      { name: 'Arbitrum', tvl: 5_000_000_000 },
    ]);
    const c = createDefiLlamaClient({ fetch: fetch as any });
    expect(await c.getChainTvl('Ethereum')).toBe(123_456_789_000);
    expect(await c.getChainTvl('Unknown')).toBeNull();
  });

  it('getProtocolTvlSeries returns time series', async () => {
    const fetch = mockFetch({
      tvl: [
        { date: 1_700_000_000, totalLiquidityUSD: 100 },
        { date: 1_700_086_400, totalLiquidityUSD: 110 },
      ],
    });
    const c = createDefiLlamaClient({ fetch: fetch as any });
    const series = await c.getProtocolTvlSeries('aave-v3');
    expect(series).toHaveLength(2);
    expect(series[1].tvl).toBe(110);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run test/markets/clients/defillama.test.ts
```

- [ ] **Step 3: 实现**

`web/lib/markets/clients/defillama.ts`

```typescript
export interface DefiLlamaClient {
  getChainTvl(chainName: string): Promise<number | null>;
  getProtocolTvlSeries(slug: string): Promise<{ ts: number; tvl: number }[]>;
}

export interface DefiLlamaClientOptions {
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
  cacheTtlMs?: number;
  now?: () => number;
}

export function createDefiLlamaClient(opts: DefiLlamaClientOptions = {}): DefiLlamaClient {
  const fetch = opts.fetch ?? globalThis.fetch;
  const baseUrl = opts.baseUrl ?? process.env.DEFILLAMA_BASE_URL ?? 'https://api.llama.fi';
  const ttl = opts.cacheTtlMs ?? 60 * 60 * 1000; // 1h
  const now = opts.now ?? Date.now;
  const cache = new Map<string, { value: unknown; expiresAt: number }>();

  const cached = async <T>(key: string, loader: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now()) return hit.value as T;
    const value = await loader();
    cache.set(key, { value, expiresAt: now() + ttl });
    return value;
  };

  const get = async (path: string): Promise<any> => {
    const res = await fetch(`${baseUrl}${path}`);
    if (!res.ok) throw new Error(`DefiLlama ${path} ${res.status}`);
    return res.json();
  };

  return {
    async getChainTvl(chainName) {
      return cached(`chains`, async () => {
        const list = (await get('/v2/chains')) as { name: string; tvl: number }[];
        const map = new Map(list.map((x) => [x.name.toLowerCase(), x.tvl]));
        return map;
      }).then((m) => m.get(chainName.toLowerCase()) ?? null);
    },

    async getProtocolTvlSeries(slug) {
      return cached(`protocol:${slug}`, async () => {
        const data = await get(`/protocol/${slug}`);
        const arr = (data.tvl ?? []) as { date: number; totalLiquidityUSD: number }[];
        return arr.map((p) => ({ ts: p.date, tvl: p.totalLiquidityUSD }));
      });
    },
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm vitest run test/markets/clients/defillama.test.ts
```

- [ ] **Step 5: 提交**

```bash
git add web/lib/markets/clients/defillama.ts web/test/markets/clients/defillama.test.ts
git commit -m "feat(markets): DefiLlama client with 1h cache"
```

---

## Phase C：~~FredPriceAdapter 合约~~（已废弃）

> v0.2 pivot 后此 Phase 不再需要。设计已变为：全品类统一走 EventMarket + AdminEventOracle，宏观题目改 discrete outcome 区间（详见 spec §5 与 §9 D2）。
> 后续 Phase D-J 编号不变（不重排，避免引用混乱）。
> 跳过 Phase C 直接进入 Phase D。


---

## Phase D：链上交互层

> 本计划假设 `EventMarket` 与 `AdminEventOracle` 的 ABI 通过 `contracts/cache/` 或 viem 的 `parseAbi` 已可访问。若项目还没有现成的 viem ABI 导出，先在 `web/lib/markets/scheduler/abi.ts` 收一份。

### Task D.0：合约 ABI 收口

**Files:**
- Create: `web/lib/markets/scheduler/abi.ts`

- [ ] **Step 1: 收 EventMarket / AdminEventOracle / ERC20 的最小 ABI**

`web/lib/markets/scheduler/abi.ts`

```typescript
import { parseAbi } from 'viem';

export const eventMarketAbi = parseAbi([
  'function createMarket(bytes32 eventId, uint8 outcomeCount, uint64 betDeadline, uint64 resolveAfter, string question) returns (uint256 id)',
  'function resolve(uint256 id)',
  'event MarketCreated(uint256 indexed id, bytes32 indexed eventId, uint8 outcomeCount, uint64 betDeadline, uint64 resolveAfter, uint16 feeBpsSnapshot, address feeRecipientSnapshot, string question)',
  'event Resolved(uint256 indexed id, uint8 outcomeIndex, uint64 settleTime, uint128 winnerPool, uint128 protocolFee)',
  'function _markets(uint256) view returns (bytes32 eventId, uint8 outcomeCount, uint64 betDeadline, uint64 resolveAfter, uint8 settledOutcome, uint64 settleTime, uint128 winnerPool, uint128 protocolFee, uint16 feeBpsSnapshot, address feeRecipientSnapshot, string question)',
]);

export const adminOracleAbi = parseAbi([
  'function proposeResult(bytes32 eventId, uint8 outcomeIndex)',
  'function finalizeResult(bytes32 eventId)',
  'function getResult(bytes32 eventId) view returns (uint8 outcomeIndex, bool finalized)',
  'function getEventStatus(bytes32 eventId) view returns (uint8 status)',
  'event ResultProposed(bytes32 indexed eventId, uint8 outcomeIndex, uint64 proposedAt)',
  'event Finalized(bytes32 indexed eventId, uint8 outcomeIndex, uint64 finalizedAt)',
  'event Challenged(bytes32 indexed eventId, address challenger, uint64 challengedAt)',
]);

export const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
]);

// OracleStatus enum from AdminEventOracle.sol
export const ORACLE_STATUS = {
  Pending: 0,
  Proposed: 1,
  Challenged: 2,
  Finalized: 3,
} as const;

export type OracleStatusValue = typeof ORACLE_STATUS[keyof typeof ORACLE_STATUS];
```

- [ ] **Step 2: 校验 ABI 与实际合约对齐**

```bash
cd contracts
forge inspect EventMarket abi | python3 -c "
import json, sys
abi = json.load(sys.stdin)
sigs = [f for f in abi if f.get('type')=='function' and f['name'] in ('createMarket','resolve')]
print('\n'.join(json.dumps(s) for s in sigs))
"
```

预期：与 `abi.ts` 中的 parseAbi 签名一致。若不一致，立即更新 abi.ts 后重跑。

- [ ] **Step 3: 提交**

```bash
git add web/lib/markets/scheduler/abi.ts
git commit -m "feat(markets): minimal viem ABI for EventMarket + AdminEventOracle"
```

### Task D.1：chain-reader（读链状态）

**Files:**
- Create: `web/lib/markets/scheduler/chain-reader.ts`
- Test: `web/test/markets/chain-reader.test.ts`

**职责：** 给定 `eventId`，判断是否已建市场、当前 oracle 状态、是否到结题时间。无状态，纯链上读取。

- [ ] **Step 1: 写失败测试（用 viem 的 testClient + mock）**

`web/test/markets/chain-reader.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createChainReader } from '@/lib/markets/scheduler/chain-reader';
import { ORACLE_STATUS } from '@/lib/markets/scheduler/abi';

const fakePublicClient = (overrides: Record<string, any>) => ({
  getContractEvents: vi.fn().mockResolvedValue(overrides.events ?? []),
  readContract: vi.fn().mockImplementation(async ({ functionName }: any) => {
    if (functionName === 'getEventStatus') return overrides.status ?? ORACLE_STATUS.Pending;
    if (functionName === '_markets') return overrides.market ?? null;
    throw new Error(`unexpected readContract: ${functionName}`);
  }),
});

describe('chain-reader', () => {
  it('marketIdForEventId returns null when no MarketCreated event', async () => {
    const client = fakePublicClient({ events: [] });
    const r = createChainReader({
      client: client as any,
      eventMarketAddress: '0xaa',
      oracleAddress: '0xbb',
    });
    expect(await r.marketIdForEventId('0x' + '00'.repeat(32) as any)).toBeNull();
  });

  it('marketIdForEventId returns id from MarketCreated event', async () => {
    const client = fakePublicClient({
      events: [{ args: { id: 42n, eventId: '0xee' } }],
    });
    const r = createChainReader({
      client: client as any,
      eventMarketAddress: '0xaa',
      oracleAddress: '0xbb',
    });
    expect(await r.marketIdForEventId('0xee' as any)).toBe(42n);
  });

  it('oracleStatus returns mapped enum string', async () => {
    const client = fakePublicClient({ status: ORACLE_STATUS.Proposed });
    const r = createChainReader({
      client: client as any,
      eventMarketAddress: '0xaa',
      oracleAddress: '0xbb',
    });
    expect(await r.oracleStatus('0xee' as any)).toBe('proposed');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run test/markets/chain-reader.test.ts
```

- [ ] **Step 3: 实现**

`web/lib/markets/scheduler/chain-reader.ts`

```typescript
import type { PublicClient } from 'viem';
import {
  eventMarketAbi,
  adminOracleAbi,
  ORACLE_STATUS,
  type OracleStatusValue,
} from './abi';

export type OracleStatusName = 'pending' | 'proposed' | 'challenged' | 'finalized';

const statusName = (v: OracleStatusValue): OracleStatusName => {
  switch (v) {
    case ORACLE_STATUS.Pending: return 'pending';
    case ORACLE_STATUS.Proposed: return 'proposed';
    case ORACLE_STATUS.Challenged: return 'challenged';
    case ORACLE_STATUS.Finalized: return 'finalized';
  }
};

export interface ChainReaderOptions {
  client: PublicClient;
  eventMarketAddress: `0x${string}`;
  oracleAddress: `0x${string}`;
  fromBlock?: bigint;
}

export function createChainReader(opts: ChainReaderOptions) {
  const { client, eventMarketAddress, oracleAddress, fromBlock = 0n } = opts;

  return {
    /** 通过扫 MarketCreated 事件实现"eventId → marketId"映射 + 幂等去重。 */
    async marketIdForEventId(eventId: `0x${string}`): Promise<bigint | null> {
      const events = await client.getContractEvents({
        address: eventMarketAddress,
        abi: eventMarketAbi,
        eventName: 'MarketCreated',
        args: { eventId },
        fromBlock,
      });
      if (events.length === 0) return null;
      const first = events[0] as unknown as { args: { id: bigint } };
      return first.args.id;
    },

    async oracleStatus(eventId: `0x${string}`): Promise<OracleStatusName> {
      const raw = (await client.readContract({
        address: oracleAddress,
        abi: adminOracleAbi,
        functionName: 'getEventStatus',
        args: [eventId],
      })) as number;
      return statusName(raw as OracleStatusValue);
    },

    async marketSettled(marketId: bigint): Promise<boolean> {
      const tuple = (await client.readContract({
        address: eventMarketAddress,
        abi: eventMarketAbi,
        functionName: '_markets',
        args: [marketId],
      })) as readonly [
        `0x${string}`, number, bigint, bigint, number, bigint, bigint, bigint, number, `0x${string}`, string,
      ];
      const settledOutcome = tuple[4];
      // EventMarket.UNRESOLVED_OUTCOME = 255
      return settledOutcome !== 255;
    },
  };
}
```

- [ ] **Step 4: 跑测试**

```bash
pnpm vitest run test/markets/chain-reader.test.ts
```

预期：3 PASS。

- [ ] **Step 5: 提交**

```bash
git add web/lib/markets/scheduler/{abi,chain-reader}.ts web/test/markets/chain-reader.test.ts
git commit -m "feat(markets): chain-reader for event/oracle/market state"
```

### Task D.2：chain-writer（写链：createMarket / propose / finalize / resolve / seed）

**Files:**
- Create: `web/lib/markets/scheduler/chain-writer.ts`
- Test: `web/test/markets/chain-writer.test.ts`

**职责：** 包装 EventMarket / AdminEventOracle / ERC20 调用。每个方法独立可测，向上层（tick.ts）暴露 high-level intent：`openMarket(draft) / proposeOutcome(eventId, idx) / finalizeOutcome(eventId) / claimSettled(marketId) / seedLiquidity(marketId, outcomes)`。

- [ ] **Step 1: 写失败测试**

`web/test/markets/chain-writer.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createChainWriter } from '@/lib/markets/scheduler/chain-writer';
import { computeMarketId } from '@/lib/markets/external-key';

const fakeWalletClient = () => {
  const writes: any[] = [];
  return {
    writes,
    client: {
      writeContract: vi.fn().mockImplementation(async (args) => {
        writes.push(args);
        return '0x' + '1'.repeat(64);
      }),
      account: { address: '0x' + 'aa'.repeat(20) },
    },
  };
};

describe('chain-writer', () => {
  it('openMarket calls EventMarket.createMarket with eventId from externalKey', async () => {
    const { client, writes } = fakeWalletClient();
    const w = createChainWriter({
      walletClient: client as any,
      eventMarketAddress: '0xaa' as any,
      oracleAddress: '0xbb' as any,
      usdcAddress: '0xcc' as any,
    });
    const eventId = computeMarketId('fred-macro', 'k');
    await w.openMarket({
      eventId,
      question: 'Q',
      outcomeCount: 3,
      betDeadline: 1000,
      resolveAfter: 2000,
    });
    expect(writes).toHaveLength(1);
    expect(writes[0].functionName).toBe('createMarket');
    expect(writes[0].args[0]).toBe(eventId);
    expect(writes[0].args[1]).toBe(3);
  });

  it('proposeOutcome calls oracle.proposeResult', async () => {
    const { client, writes } = fakeWalletClient();
    const w = createChainWriter({
      walletClient: client as any,
      eventMarketAddress: '0xaa' as any,
      oracleAddress: '0xbb' as any,
      usdcAddress: '0xcc' as any,
    });
    await w.proposeOutcome('0xee' as any, 1);
    expect(writes[0].functionName).toBe('proposeResult');
    expect(writes[0].args).toEqual(['0xee', 1]);
  });

  it('finalizeOutcome calls oracle.finalizeResult', async () => {
    const { client, writes } = fakeWalletClient();
    const w = createChainWriter({
      walletClient: client as any,
      eventMarketAddress: '0xaa' as any,
      oracleAddress: '0xbb' as any,
      usdcAddress: '0xcc' as any,
    });
    await w.finalizeOutcome('0xee' as any);
    expect(writes[0].functionName).toBe('finalizeResult');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run test/markets/chain-writer.test.ts
```

- [ ] **Step 3: 实现**

`web/lib/markets/scheduler/chain-writer.ts`

```typescript
import type { WalletClient, PublicClient } from 'viem';
import { eventMarketAbi, adminOracleAbi, erc20Abi } from './abi';

export interface OpenMarketArgs {
  eventId: `0x${string}`;
  question: string;
  outcomeCount: number;
  betDeadline: number;
  resolveAfter: number;
}

export interface ChainWriterOptions {
  walletClient: WalletClient;
  publicClient?: PublicClient;
  eventMarketAddress: `0x${string}`;
  oracleAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
}

export function createChainWriter(opts: ChainWriterOptions) {
  const { walletClient, eventMarketAddress, oracleAddress, usdcAddress } = opts;

  return {
    async openMarket(args: OpenMarketArgs): Promise<`0x${string}`> {
      return walletClient.writeContract({
        address: eventMarketAddress,
        abi: eventMarketAbi,
        functionName: 'createMarket',
        args: [
          args.eventId,
          args.outcomeCount,
          BigInt(args.betDeadline),
          BigInt(args.resolveAfter),
          args.question,
        ],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
    },

    async proposeOutcome(eventId: `0x${string}`, outcomeIndex: number): Promise<`0x${string}`> {
      return walletClient.writeContract({
        address: oracleAddress,
        abi: adminOracleAbi,
        functionName: 'proposeResult',
        args: [eventId, outcomeIndex],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
    },

    async finalizeOutcome(eventId: `0x${string}`): Promise<`0x${string}`> {
      return walletClient.writeContract({
        address: oracleAddress,
        abi: adminOracleAbi,
        functionName: 'finalizeResult',
        args: [eventId],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
    },

    /** EventMarket.resolve 任何人可调，cron 顺手把 finalized 的 oracle 结果落到 market 上。 */
    async settleMarket(marketId: bigint): Promise<`0x${string}`> {
      return walletClient.writeContract({
        address: eventMarketAddress,
        abi: eventMarketAbi,
        functionName: 'resolve',
        args: [marketId],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
    },

    /** Phase 1：固定 10 USDC，按 outcome 均分 approve（实际下注通过另一路径）。
     *  此处仅 approve USDC 给 EventMarket，方便后续 seed 调用。 */
    async approveUsdc(amount: bigint): Promise<`0x${string}`> {
      return walletClient.writeContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [eventMarketAddress, amount],
        chain: walletClient.chain ?? null,
        account: walletClient.account!,
      });
    },
  };
}
```

- [ ] **Step 4: 跑测试**

```bash
pnpm vitest run test/markets/chain-writer.test.ts
```

预期：3 PASS。

- [ ] **Step 5: 提交**

```bash
git add web/lib/markets/scheduler/chain-writer.ts web/test/markets/chain-writer.test.ts
git commit -m "feat(markets): chain-writer for EventMarket + AdminEventOracle"
```

> **注意：** 引导流动性（实际下注几个 outcome 用 EventMarket.bet）放到 Task D.3，因为需要 bet 函数 ABI 与策略。

### Task D.3：引导流动性（seed liquidity）

**Files:**
- Create: `web/lib/markets/scheduler/seed-liquidity.ts`
- Test: `web/test/markets/seed-liquidity.test.ts`
- Modify: `web/lib/markets/scheduler/abi.ts`（追加 EventMarket.bet 签名）

- [ ] **Step 1: 追加 bet ABI**

在 `abi.ts` 的 `eventMarketAbi` 中加入：

```typescript
'function bet(uint256 id, uint8 outcomeIndex, uint128 amount)',
```

- [ ] **Step 2: 写失败测试（验证 seedLiquidity 对每个 outcome 各下注一次）**

`web/test/markets/seed-liquidity.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createSeedLiquidity } from '@/lib/markets/scheduler/seed-liquidity';

const fakeWriter = () => {
  const calls: any[] = [];
  return {
    calls,
    writer: {
      approveUsdc: vi.fn().mockImplementation(async (n: bigint) => {
        calls.push({ kind: 'approve', n });
        return '0x' + '1'.repeat(64);
      }),
    },
    walletClient: {
      writeContract: vi.fn().mockImplementation(async (a: any) => {
        calls.push({ kind: 'bet', args: a.args });
        return '0x' + '2'.repeat(64);
      }),
      account: { address: '0x' + 'aa'.repeat(20) },
      chain: null,
    },
  };
};

describe('seed-liquidity', () => {
  it('approves and bets equal amount on each outcome', async () => {
    const { writer, walletClient, calls } = fakeWriter();
    const seed = createSeedLiquidity({
      writer: writer as any,
      walletClient: walletClient as any,
      eventMarketAddress: '0xaa' as any,
      perMarketUsdc: 10_000_000n, // 10 USDC (6 decimals)
    });
    await seed.seed(123n, 3);
    expect(calls[0]).toEqual({ kind: 'approve', n: 10_000_000n });
    expect(calls.slice(1).every((c) => c.kind === 'bet')).toBe(true);
    expect(calls.slice(1)).toHaveLength(3);
    const amounts = calls.slice(1).map((c) => c.args[2]);
    expect(new Set(amounts)).toEqual(new Set([3_333_333n])); // 10/3 truncated
  });
});
```

- [ ] **Step 3: 实现**

`web/lib/markets/scheduler/seed-liquidity.ts`

```typescript
import type { WalletClient } from 'viem';
import { eventMarketAbi } from './abi';

interface ChainWriterLike {
  approveUsdc(amount: bigint): Promise<`0x${string}`>;
}

export interface SeedLiquidityOptions {
  writer: ChainWriterLike;
  walletClient: WalletClient;
  eventMarketAddress: `0x${string}`;
  perMarketUsdc: bigint; // total seed budget per market (USDC raw, 6 decimals)
}

export function createSeedLiquidity(opts: SeedLiquidityOptions) {
  const { writer, walletClient, eventMarketAddress, perMarketUsdc } = opts;

  return {
    async seed(marketId: bigint, outcomeCount: number): Promise<void> {
      await writer.approveUsdc(perMarketUsdc);
      const perOutcome = perMarketUsdc / BigInt(outcomeCount);
      for (let i = 0; i < outcomeCount; i++) {
        await walletClient.writeContract({
          address: eventMarketAddress,
          abi: eventMarketAbi,
          functionName: 'bet',
          args: [marketId, i, perOutcome],
          chain: walletClient.chain ?? null,
          account: walletClient.account!,
        });
      }
    },
  };
}
```

- [ ] **Step 4: 跑测试**

```bash
pnpm vitest run test/markets/seed-liquidity.test.ts
```

预期：1 PASS。

- [ ] **Step 5: 提交**

```bash
git add web/lib/markets/scheduler/{abi,seed-liquidity}.ts web/test/markets/seed-liquidity.test.ts
git commit -m "feat(markets): seed liquidity (10 USDC / market, equal split)"
```

---

## Phase E：Sources 实现

> 两个 source 互不依赖，可并行实施。建议先 E.1（fred-macro）跑通整条链路再做 E.2，避免一次性 debug 量过大。

### Task E.1：fred-macro source

**Files:**
- Create: `web/lib/markets/sources/fred-macro.ts`
- Test: `web/test/markets/sources/fred-macro.test.ts`

**契约：**
- 覆盖 3 个 FRED series：`CPIAUCSL`（CPI YoY %）、`FEDFUNDS`（Fed Funds Rate %）、`PAYEMS`（Non-Farm Payrolls，月度差）
- 题目模板：discrete outcome 区间（见 spec §5.3）
- `fetchUpcoming`：根据 FRED 发布日历 + 未来 90 天窗口生成 drafts
- `resolve`：发布日 +1 天后查 latest observation，落到区间对应 outcome

- [ ] **Step 1: 写失败测试（用 mock FredClient）**

`web/test/markets/sources/fred-macro.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createFredMacroSource } from '@/lib/markets/sources/fred-macro';
import type { OnChainMarket } from '@/lib/markets/sources/base';

const mockFredClient = (override: any = {}) => ({
  getLatestObservation: vi.fn().mockImplementation(async (id: string) => {
    return override.latest?.[id] ?? null;
  }),
  getObservationByDate: vi.fn().mockImplementation(async (id: string, d: string) => {
    return override.byDate?.[`${id}:${d}`] ?? null;
  }),
});

const NOW = new Date('2026-06-18T00:00:00Z');

describe('fred-macro source', () => {
  it('id and category', () => {
    const s = createFredMacroSource({ fredClient: mockFredClient() as any });
    expect(s.id).toBe('fred-macro');
    expect(s.category).toBe('macro');
  });

  it('fetchUpcoming returns 3 series × upcoming release', async () => {
    const s = createFredMacroSource({ fredClient: mockFredClient() as any });
    const drafts = await s.fetchUpcoming(NOW);
    // 90 天窗口内 CPI 月发 + FEDFUNDS 月发 + PAYEMS 月发，约 9 个 draft
    expect(drafts.length).toBeGreaterThanOrEqual(3);
    expect(drafts.length).toBeLessThanOrEqual(12);
    expect(new Set(drafts.map((d) => d.category))).toEqual(new Set(['macro']));
    drafts.forEach((d) => expect(d.outcomes.length).toBeGreaterThanOrEqual(2));
  });

  it('resolve returns still-open when observation missing', async () => {
    const fred = mockFredClient({ latest: {} });
    const s = createFredMacroSource({ fredClient: fred as any });
    const market: OnChainMarket = {
      marketId: 0n,
      eventId: '0x' + '00'.repeat(32) as any,
      sourceId: 'fred-macro',
      externalKey: 'CPIAUCSL:2026-07-15',
      question: 'Q',
      outcomeCount: 3,
      betDeadline: 0,
      resolveAfter: 0,
      isSettled: false,
      oracleStatus: 'pending',
    };
    const r = await s.resolve(market, NOW);
    expect(r.kind).toBe('still-open');
  });

  it('resolve returns settled when CPI value < 2.5% maps to outcome 0', async () => {
    const fred = mockFredClient({
      byDate: { 'CPIAUCSL:2026-07-15': { date: '2026-07-15', value: 2.1 } },
    });
    const s = createFredMacroSource({ fredClient: fred as any });
    const market: OnChainMarket = {
      marketId: 0n,
      eventId: '0x' + '00'.repeat(32) as any,
      sourceId: 'fred-macro',
      externalKey: 'CPIAUCSL:2026-07-15',
      question: 'Q',
      outcomeCount: 3,
      betDeadline: 0,
      resolveAfter: 0,
      isSettled: false,
      oracleStatus: 'pending',
    };
    const r = await s.resolve(market, NOW);
    expect(r.kind).toBe('settled');
    if (r.kind === 'settled') {
      expect(r.settledOutcomeIndex).toBe(0); // < 2.5%
    }
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run test/markets/sources/fred-macro.test.ts
```

- [ ] **Step 3: 实现**

`web/lib/markets/sources/fred-macro.ts`

```typescript
import type { FredClient } from '@/lib/markets/clients/fred';
import type {
  MarketDraft,
  MarketSource,
  OnChainMarket,
  ResolvedOutcome,
} from '@/lib/markets/sources/base';
import { ResolveStillOpen } from '@/lib/markets/sources/base';

interface SeriesSpec {
  seriesId: string;
  label: string;
  questionTemplate: (releaseDate: string) => string;
  outcomes: { id: string; label: string; range: [number, number] }[]; // [lo, hi)
}

const SERIES: SeriesSpec[] = [
  {
    seriesId: 'CPIAUCSL',
    label: 'US CPI YoY',
    questionTemplate: (d) => `US CPI YoY released on ${d} — what range?`,
    outcomes: [
      { id: 'lt25',  label: '< 2.5%',     range: [-Infinity, 2.5] },
      { id: 'mid',   label: '2.5%-3.5%',  range: [2.5, 3.5] },
      { id: 'gt35',  label: '> 3.5%',     range: [3.5, Infinity] },
    ],
  },
  {
    seriesId: 'FEDFUNDS',
    label: 'Fed Funds Rate',
    questionTemplate: (d) => `Fed Funds Rate on ${d} — what range?`,
    outcomes: [
      { id: 'lt450', label: '< 4.5%',     range: [-Infinity, 4.5] },
      { id: 'mid',   label: '4.5%-5.0%',  range: [4.5, 5.0] },
      { id: 'gt500', label: '> 5.0%',     range: [5.0, Infinity] },
    ],
  },
  {
    seriesId: 'PAYEMS',
    label: 'Non-Farm Payrolls (MoM change, thousands)',
    questionTemplate: (d) => `NFP released on ${d} — MoM change?`,
    outcomes: [
      { id: 'lt100', label: '< 100k',     range: [-Infinity, 100] },
      { id: 'mid',   label: '100k-200k',  range: [100, 200] },
      { id: 'gt200', label: '> 200k',     range: [200, Infinity] },
    ],
  },
];

/** FRED 数据通常每月发一次。简化：每月 15 号近似发布日；±2 天容差。 */
const RELEASE_OFFSET_DAYS = 15;

function upcomingReleaseDates(now: Date, lookAheadDays: number): string[] {
  const dates: string[] = [];
  const end = new Date(now.getTime() + lookAheadDays * 86_400_000);
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), RELEASE_OFFSET_DAYS));
  while (cursor <= end) {
    if (cursor > now) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return dates;
}

function valueToOutcomeIndex(value: number, outcomes: SeriesSpec['outcomes']): number {
  for (let i = 0; i < outcomes.length; i++) {
    const [lo, hi] = outcomes[i].range;
    if (value >= lo && value < hi) return i;
  }
  return outcomes.length - 1; // 兜底落入最后一区间
}

export interface FredMacroSourceOptions {
  fredClient: FredClient;
  lookAheadDays?: number;
  resolutionGraceHours?: number; // 发布日之后多久去查值
}

export function createFredMacroSource(opts: FredMacroSourceOptions): MarketSource {
  const lookAheadDays = opts.lookAheadDays ?? 90;
  const grace = (opts.resolutionGraceHours ?? 36) * 3_600_000;

  return {
    id: 'fred-macro',
    category: 'macro',
    enabled: true,

    async fetchUpcoming(now: Date): Promise<MarketDraft[]> {
      const out: MarketDraft[] = [];
      for (const series of SERIES) {
        for (const releaseDate of upcomingReleaseDates(now, lookAheadDays)) {
          const releaseTs = Math.floor(Date.parse(`${releaseDate}T12:00:00Z`) / 1000);
          out.push({
            externalKey: `${series.seriesId}:${releaseDate}`,
            category: 'macro',
            question: series.questionTemplate(releaseDate),
            outcomes: series.outcomes.map(({ id, label }) => ({ id, label })),
            betDeadline: releaseTs - 3600,
            resolveAfter: releaseTs + Math.floor(grace / 1000),
            resolveSourceMeta: {
              seriesId: series.seriesId,
              releaseDate,
              outcomeRanges: series.outcomes.map((o) => o.range),
            },
          });
        }
      }
      return out;
    },

    async resolve(market: OnChainMarket, _now: Date): Promise<ResolvedOutcome> {
      const [seriesId, releaseDate] = market.externalKey.split(':');
      const series = SERIES.find((s) => s.seriesId === seriesId);
      if (!series) return { kind: 'invalid', reason: `unknown series: ${seriesId}` };

      const obs = await opts.fredClient.getObservationByDate(seriesId, releaseDate)
        ?? await opts.fredClient.getLatestObservation(seriesId);
      if (!obs) return ResolveStillOpen;

      const idx = valueToOutcomeIndex(obs.value, series.outcomes);
      return {
        kind: 'settled',
        settledOutcomeIndex: idx,
        publishedAt: Math.floor(Date.parse(`${obs.date}T12:00:00Z`) / 1000),
        evidence: {
          sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
          rawValue: obs.value,
        },
      };
    },
  };
}
```

- [ ] **Step 4: 跑测试**

```bash
pnpm vitest run test/markets/sources/fred-macro.test.ts
```

预期：4 PASS。

- [ ] **Step 5: 提交**

```bash
git add web/lib/markets/sources/fred-macro.ts web/test/markets/sources/fred-macro.test.ts
git commit -m "feat(markets): fred-macro source (CPI + Fed Funds + NFP, ranged outcomes)"
```

### Task E.2：chain-event source

**Files:**
- Create: `web/lib/markets/sources/chain-event.ts`
- Test: `web/test/markets/sources/chain-event.test.ts`

**契约：**
- Phase 1 覆盖两类题目：
  - **TVL 阈值**：`Will Ethereum TVL be ≥ $X by YYYY-MM-DD?` (yes/no)，X 取当前 TVL × {1.05, 1.10, 1.20} 三个档位
  - **Token unlock 影响**：`Will ARB price drop ≥ Y% within 7 days after unlock on YYYY-MM-DD?` （Phase 1 用静态 unlock 日历 + DefiLlama 价格）
- 数据源：DefiLlama
- `fetchUpcoming`：返回上述两类未来事件
- `resolve`：到 deadline 后查 DefiLlama 当前值

- [ ] **Step 1: 写失败测试**

`web/test/markets/sources/chain-event.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createChainEventSource } from '@/lib/markets/sources/chain-event';
import type { OnChainMarket } from '@/lib/markets/sources/base';

const mockDefiLlama = (override: any = {}) => ({
  getChainTvl: vi.fn().mockResolvedValue(override.chainTvl ?? 100_000_000_000),
  getProtocolTvlSeries: vi.fn().mockResolvedValue(override.series ?? []),
});

const NOW = new Date('2026-06-18T00:00:00Z');

describe('chain-event source', () => {
  it('id and category', () => {
    const s = createChainEventSource({ defiLlama: mockDefiLlama() as any });
    expect(s.id).toBe('chain-event');
    expect(s.category).toBe('chain');
  });

  it('fetchUpcoming returns TVL threshold drafts for ETH', async () => {
    const llama = mockDefiLlama({ chainTvl: 200_000_000_000 });
    const s = createChainEventSource({ defiLlama: llama as any });
    const drafts = await s.fetchUpcoming(NOW);
    const tvlDrafts = drafts.filter((d) => d.externalKey.startsWith('eth:tvl:'));
    expect(tvlDrafts.length).toBeGreaterThanOrEqual(3);
    tvlDrafts.forEach((d) => {
      expect(d.outcomes.map((o) => o.id)).toEqual(['yes', 'no']);
    });
  });

  it('TVL resolve: still-open when current TVL between threshold and deadline not reached', async () => {
    const llama = mockDefiLlama({ chainTvl: 150_000_000_000 });
    const s = createChainEventSource({ defiLlama: llama as any });
    const m: OnChainMarket = {
      marketId: 0n,
      eventId: '0x' + '00'.repeat(32) as any,
      sourceId: 'chain-event',
      externalKey: 'eth:tvl:gte:200000000000:2026-09-30',
      question: 'Q',
      outcomeCount: 2,
      betDeadline: 0,
      resolveAfter: Math.floor(Date.parse('2026-09-30T00:00:00Z') / 1000),
      isSettled: false,
      oracleStatus: 'pending',
    };
    // now is before deadline
    const r = await s.resolve(m, NOW);
    expect(r.kind).toBe('still-open');
  });

  it('TVL resolve: settled YES when deadline passed and TVL ≥ threshold', async () => {
    const llama = mockDefiLlama({ chainTvl: 250_000_000_000 });
    const s = createChainEventSource({ defiLlama: llama as any });
    const m: OnChainMarket = {
      marketId: 0n,
      eventId: '0x' + '00'.repeat(32) as any,
      sourceId: 'chain-event',
      externalKey: 'eth:tvl:gte:200000000000:2026-06-01',
      question: 'Q',
      outcomeCount: 2,
      betDeadline: 0,
      resolveAfter: Math.floor(Date.parse('2026-06-01T00:00:00Z') / 1000),
      isSettled: false,
      oracleStatus: 'pending',
    };
    const r = await s.resolve(m, NOW);
    expect(r.kind).toBe('settled');
    if (r.kind === 'settled') {
      expect(r.settledOutcomeIndex).toBe(0); // yes
    }
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run test/markets/sources/chain-event.test.ts
```

- [ ] **Step 3: 实现**

`web/lib/markets/sources/chain-event.ts`

```typescript
import type { DefiLlamaClient } from '@/lib/markets/clients/defillama';
import type {
  MarketDraft,
  MarketSource,
  OnChainMarket,
  ResolvedOutcome,
} from '@/lib/markets/sources/base';
import { ResolveStillOpen } from '@/lib/markets/sources/base';

const TVL_BUMP_FACTORS = [1.05, 1.10, 1.20];
const TVL_DEADLINE_DAYS = 90; // 3 个月窗口
const TRACKED_CHAINS: { id: string; defiLlamaName: string }[] = [
  { id: 'eth', defiLlamaName: 'Ethereum' },
  { id: 'arb', defiLlamaName: 'Arbitrum' },
];

function isoDateOffset(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export interface ChainEventSourceOptions {
  defiLlama: DefiLlamaClient;
}

export function createChainEventSource(opts: ChainEventSourceOptions): MarketSource {
  return {
    id: 'chain-event',
    category: 'chain',
    enabled: true,

    async fetchUpcoming(now: Date): Promise<MarketDraft[]> {
      const drafts: MarketDraft[] = [];

      for (const chain of TRACKED_CHAINS) {
        const current = await opts.defiLlama.getChainTvl(chain.defiLlamaName);
        if (current == null) continue;
        for (const bump of TVL_BUMP_FACTORS) {
          const threshold = Math.floor(current * bump);
          const deadline = isoDateOffset(now, TVL_DEADLINE_DAYS);
          const deadlineTs = Math.floor(Date.parse(`${deadline}T00:00:00Z`) / 1000);
          drafts.push({
            externalKey: `${chain.id}:tvl:gte:${threshold}:${deadline}`,
            category: 'chain',
            question: `Will ${chain.defiLlamaName} TVL be ≥ $${(threshold / 1e9).toFixed(2)}B by ${deadline}?`,
            outcomes: [
              { id: 'yes', label: 'Yes' },
              { id: 'no',  label: 'No' },
            ],
            betDeadline: deadlineTs - 86400,
            resolveAfter: deadlineTs,
            resolveSourceMeta: {
              chainId: chain.id,
              chainName: chain.defiLlamaName,
              thresholdUsd: threshold,
              deadline,
            },
          });
        }
      }

      return drafts;
    },

    async resolve(market: OnChainMarket, now: Date): Promise<ResolvedOutcome> {
      const parts = market.externalKey.split(':');
      // 形如 "eth:tvl:gte:200000000000:2026-09-30"
      if (parts[1] !== 'tvl' || parts[2] !== 'gte') {
        return { kind: 'invalid', reason: `unknown externalKey shape: ${market.externalKey}` };
      }
      const chainId = parts[0];
      const threshold = Number(parts[3]);
      const deadline = parts[4];
      const deadlineTs = Math.floor(Date.parse(`${deadline}T00:00:00Z`) / 1000);

      if (Math.floor(now.getTime() / 1000) < deadlineTs) {
        return ResolveStillOpen;
      }

      const chain = TRACKED_CHAINS.find((c) => c.id === chainId);
      if (!chain) return { kind: 'invalid', reason: `unknown chainId: ${chainId}` };

      const current = await opts.defiLlama.getChainTvl(chain.defiLlamaName);
      if (current == null) return ResolveStillOpen;

      const settledOutcomeIndex = current >= threshold ? 0 : 1; // [yes, no]
      return {
        kind: 'settled',
        settledOutcomeIndex,
        publishedAt: Math.floor(now.getTime() / 1000),
        evidence: {
          sourceUrl: `https://defillama.com/chain/${chain.defiLlamaName}`,
          rawValue: current,
        },
      };
    },
  };
}
```

- [ ] **Step 4: 跑测试**

```bash
pnpm vitest run test/markets/sources/chain-event.test.ts
```

预期：4 PASS。

- [ ] **Step 5: 提交**

```bash
git add web/lib/markets/sources/chain-event.ts web/test/markets/sources/chain-event.test.ts
git commit -m "feat(markets): chain-event source (TVL threshold drafts)"
```

---

## Phase F：AI Lens 协同

> 现有 `web/lib/lens/route-handler.ts` 是一个通用 handler，按 `LensInput` 的 schema 不区分 category。本 Phase 不重构 handler，而是在它的上游/下游加 category-aware context 注入。

### Task F.1：lens contextBuilders/macro.ts

**Files:**
- Create: `web/lib/lens/contextBuilders/macro.ts`
- Test: `web/test/lens/contextBuilders/macro.test.ts`

- [ ] **Step 1: 写失败测试**

`web/test/lens/contextBuilders/macro.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildMacroLensContext } from '@/lib/lens/contextBuilders/macro';

const fakeFred = {
  getLatestObservation: vi.fn().mockResolvedValue({ date: '2026-05-15', value: 3.1 }),
  getObservationByDate: vi.fn().mockResolvedValue(null),
};

describe('macro lens contextBuilder', () => {
  it('includes seriesId + latest observation + outcome ranges', async () => {
    const ctx = await buildMacroLensContext({
      fredClient: fakeFred as any,
      market: {
        eventId: '0x00' as any,
        question: 'US CPI YoY on 2026-07-15',
        externalKey: 'CPIAUCSL:2026-07-15',
        outcomes: [
          { id: 'lt25', label: '< 2.5%' },
          { id: 'mid',  label: '2.5%-3.5%' },
          { id: 'gt35', label: '> 3.5%' },
        ],
      },
    });
    expect(ctx.seriesId).toBe('CPIAUCSL');
    expect(ctx.latest).toEqual({ date: '2026-05-15', value: 3.1 });
    expect(ctx.outcomes).toHaveLength(3);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run test/lens/contextBuilders/macro.test.ts
```

- [ ] **Step 3: 实现**

`web/lib/lens/contextBuilders/macro.ts`

```typescript
import type { FredClient } from '@/lib/markets/clients/fred';

export interface MacroLensInput {
  fredClient: FredClient;
  market: {
    eventId: `0x${string}`;
    question: string;
    externalKey: string;
    outcomes: { id: string; label: string }[];
  };
}

export interface MacroLensContext {
  seriesId: string;
  releaseDate: string;
  latest: { date: string; value: number } | null;
  outcomes: { id: string; label: string }[];
  /** 给 LLM 一段 prose：当前指标值 + 历史范围 + outcome 含义。 */
  prose: string;
}

const SERIES_NAMES: Record<string, string> = {
  CPIAUCSL: 'US CPI YoY (%)',
  FEDFUNDS: 'Fed Funds Rate (%)',
  PAYEMS: 'Non-Farm Payrolls (MoM change, thousands)',
};

export async function buildMacroLensContext(
  input: MacroLensInput,
): Promise<MacroLensContext> {
  const [seriesId, releaseDate] = input.market.externalKey.split(':');
  const latest = await input.fredClient.getLatestObservation(seriesId);

  const seriesName = SERIES_NAMES[seriesId] ?? seriesId;
  const latestLine = latest
    ? `Latest published ${seriesName}: ${latest.value} on ${latest.date}.`
    : `No recent published value available for ${seriesName}.`;

  const outcomeLines = input.market.outcomes
    .map((o, i) => `(${i}) ${o.label}`)
    .join(', ');

  const prose = [
    `Question: ${input.market.question}`,
    latestLine,
    `Possible outcomes: ${outcomeLines}.`,
    `Next release date: ${releaseDate}.`,
  ].join(' ');

  return {
    seriesId,
    releaseDate,
    latest,
    outcomes: input.market.outcomes,
    prose,
  };
}
```

- [ ] **Step 4: 跑测试**

```bash
pnpm vitest run test/lens/contextBuilders/macro.test.ts
```

预期：1 PASS。

- [ ] **Step 5: 提交**

```bash
git add web/lib/lens/contextBuilders/macro.ts web/test/lens/contextBuilders/macro.test.ts
git commit -m "feat(lens): macro contextBuilder (FRED-backed prose)"
```

### Task F.2：lens contextBuilders/chain.ts

**Files:**
- Create: `web/lib/lens/contextBuilders/chain.ts`
- Test: `web/test/lens/contextBuilders/chain.test.ts`

- [ ] **Step 1: 写失败测试**

`web/test/lens/contextBuilders/chain.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildChainLensContext } from '@/lib/lens/contextBuilders/chain';

const fakeDefiLlama = {
  getChainTvl: vi.fn().mockResolvedValue(120_000_000_000),
  getProtocolTvlSeries: vi.fn().mockResolvedValue([]),
};

describe('chain lens contextBuilder', () => {
  it('parses TVL externalKey and includes current TVL', async () => {
    const ctx = await buildChainLensContext({
      defiLlama: fakeDefiLlama as any,
      market: {
        eventId: '0x00' as any,
        question: 'Will Ethereum TVL be ≥ $X by 2026-09-30?',
        externalKey: 'eth:tvl:gte:150000000000:2026-09-30',
        outcomes: [
          { id: 'yes', label: 'Yes' },
          { id: 'no',  label: 'No' },
        ],
      },
    });
    expect(ctx.chainId).toBe('eth');
    expect(ctx.currentTvl).toBe(120_000_000_000);
    expect(ctx.thresholdTvl).toBe(150_000_000_000);
    expect(ctx.gapToThresholdRatio).toBeCloseTo(0.8, 2);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run test/lens/contextBuilders/chain.test.ts
```

- [ ] **Step 3: 实现**

`web/lib/lens/contextBuilders/chain.ts`

```typescript
import type { DefiLlamaClient } from '@/lib/markets/clients/defillama';

export interface ChainLensInput {
  defiLlama: DefiLlamaClient;
  market: {
    eventId: `0x${string}`;
    question: string;
    externalKey: string;
    outcomes: { id: string; label: string }[];
  };
}

export interface ChainLensContext {
  chainId: string;
  thresholdTvl: number;
  deadline: string;
  currentTvl: number | null;
  gapToThresholdRatio: number | null; // currentTvl / thresholdTvl
  prose: string;
}

const CHAIN_DEFILLAMA_NAME: Record<string, string> = {
  eth: 'Ethereum',
  arb: 'Arbitrum',
};

export async function buildChainLensContext(
  input: ChainLensInput,
): Promise<ChainLensContext> {
  const [chainId, , , thresholdStr, deadline] = input.market.externalKey.split(':');
  const thresholdTvl = Number(thresholdStr);
  const llamaName = CHAIN_DEFILLAMA_NAME[chainId] ?? chainId;
  const currentTvl = await input.defiLlama.getChainTvl(llamaName);

  const gap = currentTvl != null ? currentTvl / thresholdTvl : null;
  const proseLines: string[] = [
    `Question: ${input.market.question}`,
    `Target chain: ${llamaName} (id=${chainId}).`,
    `Threshold TVL: $${(thresholdTvl / 1e9).toFixed(2)}B.`,
    `Deadline: ${deadline}.`,
  ];
  if (currentTvl != null && gap != null) {
    proseLines.push(
      `Current TVL: $${(currentTvl / 1e9).toFixed(2)}B (${(gap * 100).toFixed(1)}% of threshold).`,
    );
  } else {
    proseLines.push('Current TVL unavailable.');
  }

  return {
    chainId,
    thresholdTvl,
    deadline,
    currentTvl,
    gapToThresholdRatio: gap,
    prose: proseLines.join(' '),
  };
}
```

- [ ] **Step 4: 跑测试**

```bash
pnpm vitest run test/lens/contextBuilders/chain.test.ts
```

预期：1 PASS。

- [ ] **Step 5: 提交**

```bash
git add web/lib/lens/contextBuilders/chain.ts web/test/lens/contextBuilders/chain.test.ts
git commit -m "feat(lens): chain contextBuilder (DefiLlama-backed prose)"
```

### Task F.3：route-handler 接入 macro/chain（按 category 注入 context）

**Files:**
- Modify: `web/lib/lens/route-handler.ts`
- Create: `web/lib/lens/contextBuilders/index.ts`
- Test: `web/test/lens/category-dispatch.test.ts`

**职责：** 在 LensInput 进入 LLM 之前，按 market.category 调用对应 builder 把 prose 注入 user message。

- [ ] **Step 1: 收口 contextBuilders 导出**

`web/lib/lens/contextBuilders/index.ts`

```typescript
import type { FredClient } from '@/lib/markets/clients/fred';
import type { DefiLlamaClient } from '@/lib/markets/clients/defillama';
import { buildMacroLensContext } from './macro';
import { buildChainLensContext } from './chain';
import type { MarketCategory } from '@/lib/market-kind';

export interface CategoryContextInput {
  category: MarketCategory;
  market: {
    eventId: `0x${string}`;
    question: string;
    externalKey: string;
    outcomes: { id: string; label: string }[];
  };
  fredClient?: FredClient;
  defiLlama?: DefiLlamaClient;
}

export async function buildCategoryContextProse(
  input: CategoryContextInput,
): Promise<string | null> {
  switch (input.category) {
    case 'macro':
      if (!input.fredClient) return null;
      return (await buildMacroLensContext({ fredClient: input.fredClient, market: input.market })).prose;
    case 'chain':
      if (!input.defiLlama) return null;
      return (await buildChainLensContext({ defiLlama: input.defiLlama, market: input.market })).prose;
    case 'crypto':
    case 'worldcup':
      return null;
  }
}
```

- [ ] **Step 2: 写失败测试**

`web/test/lens/category-dispatch.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { buildCategoryContextProse } from '@/lib/lens/contextBuilders';

describe('buildCategoryContextProse', () => {
  it('returns macro prose when category=macro', async () => {
    const fredClient = {
      getLatestObservation: vi.fn().mockResolvedValue({ date: '2026-05-15', value: 3.1 }),
      getObservationByDate: vi.fn(),
    };
    const prose = await buildCategoryContextProse({
      category: 'macro',
      fredClient: fredClient as any,
      market: {
        eventId: '0x00' as any,
        question: 'Q',
        externalKey: 'CPIAUCSL:2026-07-15',
        outcomes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      },
    });
    expect(prose).toContain('CPI');
  });

  it('returns null for unrelated categories', async () => {
    const prose = await buildCategoryContextProse({
      category: 'crypto',
      market: { eventId: '0x00' as any, question: 'Q', externalKey: 'x', outcomes: [] },
    });
    expect(prose).toBeNull();
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

```bash
pnpm vitest run test/lens/category-dispatch.test.ts
```

- [ ] **Step 4: 接入 route-handler.ts**

在 `handleLensRequest` 进入 `callLLM` 之前，挂一层 `enrichWithCategoryContext`：

```typescript
// 在 route-handler.ts 顶部新增 import
import { buildCategoryContextProse } from './contextBuilders';

// 修改 HandleLensParams：新增可选注入
export type HandleLensParams = {
  // ...既有字段...
  categoryClients?: {
    fredClient?: import('@/lib/markets/clients/fred').FredClient;
    defiLlama?: import('@/lib/markets/clients/defillama').DefiLlamaClient;
  };
};

// 在调用 callLLM 之前注入额外 user message
const categoryProse = params.categoryClients
  ? await buildCategoryContextProse({
      category: input.market.category as any,
      market: {
        eventId: input.market.eventId as `0x${string}`,
        question: input.market.question,
        externalKey: input.market.externalKey ?? '',
        outcomes: input.market.outcomes ?? [],
      },
      fredClient: params.categoryClients.fredClient,
      defiLlama: params.categoryClients.defiLlama,
    })
  : null;

const finalUserMessage = categoryProse
  ? `${buildUserMessage(input)}\n\n[Category context]\n${categoryProse}`
  : buildUserMessage(input);

// callLLM 调用使用 finalUserMessage
```

> **实施提示**：实际改动需 grep `route-handler.ts` 中 `buildUserMessage(input)` 的调用点，按上述结构替换。`LensInput` 类型可能需扩展 `externalKey` / `outcomes` / `category` 字段，如缺失，在 `web/lib/lens/schema.ts` 中追加 optional 字段。

- [ ] **Step 5: 跑测试 + typecheck**

```bash
pnpm vitest run test/lens
pnpm typecheck
```

预期：所有 lens 测试 PASS（含原有 + 新增 dispatch 测试）。

- [ ] **Step 6: 提交**

```bash
git add web/lib/lens/contextBuilders/index.ts \
        web/lib/lens/route-handler.ts \
        web/lib/lens/schema.ts \
        web/test/lens/category-dispatch.test.ts
git commit -m "feat(lens): dispatch category-aware prose into LLM user message"
```

### Task F.4：lens-preloader（cron 创建市场后预生成 Lens cache）

**Files:**
- Create: `web/lib/markets/scheduler/lens-preloader.ts`
- Test: `web/test/markets/lens-preloader.test.ts`

- [ ] **Step 1: 写失败测试**

`web/test/markets/lens-preloader.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createLensPreloader } from '@/lib/markets/scheduler/lens-preloader';

describe('lens-preloader', () => {
  it('warm invokes the lens route handler and ignores errors', async () => {
    const warm = vi.fn().mockResolvedValue({ status: 'ok' });
    const preloader = createLensPreloader({ warmFn: warm });

    await preloader.warm({
      eventId: '0xab' as any,
      category: 'macro',
      question: 'Q',
      externalKey: 'CPIAUCSL:2026-07-15',
      outcomes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    });
    expect(warm).toHaveBeenCalledOnce();
  });

  it('swallows warmFn failure (preload is best-effort)', async () => {
    const warm = vi.fn().mockRejectedValue(new Error('boom'));
    const preloader = createLensPreloader({ warmFn: warm });
    await expect(
      preloader.warm({
        eventId: '0xab' as any,
        category: 'chain',
        question: 'Q',
        externalKey: 'eth:tvl:gte:1:2026-09-30',
        outcomes: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }],
      }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run test/markets/lens-preloader.test.ts
```

- [ ] **Step 3: 实现**

`web/lib/markets/scheduler/lens-preloader.ts`

```typescript
import type { MarketCategory } from '@/lib/market-kind';

export interface LensPreloadTarget {
  eventId: `0x${string}`;
  category: MarketCategory;
  question: string;
  externalKey: string;
  outcomes: { id: string; label: string }[];
}

export interface LensPreloaderOptions {
  /** 注入一个最小化的"调一次 lens 让 cache 写入"的函数。 */
  warmFn: (target: LensPreloadTarget) => Promise<{ status: 'ok' } | { status: 'error' }>;
}

export function createLensPreloader(opts: LensPreloaderOptions) {
  return {
    async warm(target: LensPreloadTarget): Promise<void> {
      try {
        await opts.warmFn(target);
      } catch {
        // best-effort：失败不阻塞 cron 主流程
      }
    },
  };
}
```

- [ ] **Step 4: 跑测试**

```bash
pnpm vitest run test/markets/lens-preloader.test.ts
```

预期：2 PASS。

- [ ] **Step 5: 提交**

```bash
git add web/lib/markets/scheduler/lens-preloader.ts web/test/markets/lens-preloader.test.ts
git commit -m "feat(markets): lens-preloader (best-effort cache warm)"
```

> **集成说明：** `warmFn` 的具体实现（调本机 `/api/lens/[marketId]` 还是直调 `handleLensRequest`）在 Task G.1 的 tick orchestrator 里组装。Phase 1 直接走"server-side fetch 本机 API"路径，简单可靠。

---

## Phase G：Cron orchestrator

### Task G.1：tick orchestrator（主循环）

**Files:**
- Create: `web/lib/markets/scheduler/tick.ts`
- Test: `web/test/markets/tick.test.ts`

**职责：** 把 reader / writer / preloader / registry 串成一次完整 tick；按 spec §4.3 限额（每 source 最多 5 新建 + 10 resolve）；单 source 失败局部化。

- [ ] **Step 1: 写失败测试（全链路 mock）**

`web/test/markets/tick.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resetRegistry,
  registerSource,
} from '@/lib/markets/registry';
import { ResolveStillOpen, type MarketSource } from '@/lib/markets/sources/base';
import { runTick } from '@/lib/markets/scheduler/tick';
import { computeMarketId } from '@/lib/markets/external-key';

const makeSource = (id: string, drafts: any[], resolves: any[] = []): MarketSource => ({
  id,
  category: 'macro',
  enabled: true,
  async fetchUpcoming() { return drafts; },
  async resolve(market) {
    const next = resolves.shift();
    return next ?? ResolveStillOpen;
  },
});

const fakeReader = {
  marketIdForEventId: vi.fn().mockResolvedValue(null),
  oracleStatus: vi.fn().mockResolvedValue('pending'),
  marketSettled: vi.fn().mockResolvedValue(false),
};
const fakeWriter = {
  openMarket: vi.fn().mockResolvedValue('0xtx'),
  proposeOutcome: vi.fn().mockResolvedValue('0xtx'),
  finalizeOutcome: vi.fn().mockResolvedValue('0xtx'),
  settleMarket: vi.fn().mockResolvedValue('0xtx'),
};
const fakeSeed = { seed: vi.fn().mockResolvedValue(undefined) };
const fakePreloader = { warm: vi.fn().mockResolvedValue(undefined) };

beforeEach(() => {
  resetRegistry();
  Object.values(fakeReader).forEach((m: any) => m.mockClear?.());
  Object.values(fakeWriter).forEach((m: any) => m.mockClear?.());
  fakeSeed.seed.mockClear();
  fakePreloader.warm.mockClear();
});

describe('runTick', () => {
  it('opens new market when reader says eventId is unknown', async () => {
    const draft = {
      externalKey: 'CPIAUCSL:2026-07-15',
      category: 'macro' as const,
      question: 'Q',
      outcomes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ],
      betDeadline: Math.floor(Date.now() / 1000) + 10_000,
      resolveAfter: Math.floor(Date.now() / 1000) + 20_000,
      resolveSourceMeta: {},
    };
    registerSource(makeSource('fred-macro', [draft]));
    fakeReader.marketIdForEventId.mockResolvedValueOnce(null);
    fakeWriter.openMarket.mockResolvedValueOnce('0xtx');
    // chain-reader after open should return market id
    fakeReader.marketIdForEventId.mockResolvedValueOnce(42n);

    const report = await runTick({
      now: new Date(),
      reader: fakeReader as any,
      writer: fakeWriter as any,
      seedLiquidity: fakeSeed as any,
      preloader: fakePreloader as any,
    });
    expect(fakeWriter.openMarket).toHaveBeenCalledOnce();
    expect(fakeSeed.seed).toHaveBeenCalledWith(42n, 3);
    expect(fakePreloader.warm).toHaveBeenCalledOnce();
    expect(report.perSource['fred-macro'].opened).toBe(1);
  });

  it('skips draft when eventId already on chain (idempotent)', async () => {
    const draft = {
      externalKey: 'CPIAUCSL:2026-07-15',
      category: 'macro' as const,
      question: 'Q',
      outcomes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      betDeadline: Math.floor(Date.now() / 1000) + 10_000,
      resolveAfter: Math.floor(Date.now() / 1000) + 20_000,
      resolveSourceMeta: {},
    };
    registerSource(makeSource('fred-macro', [draft]));
    fakeReader.marketIdForEventId.mockResolvedValue(99n);
    const report = await runTick({
      now: new Date(),
      reader: fakeReader as any,
      writer: fakeWriter as any,
      seedLiquidity: fakeSeed as any,
      preloader: fakePreloader as any,
    });
    expect(fakeWriter.openMarket).not.toHaveBeenCalled();
    expect(report.perSource['fred-macro'].opened).toBe(0);
    expect(report.perSource['fred-macro'].skipped).toBe(1);
  });

  it('localizes failure: source A throwing does not block source B', async () => {
    registerSource({
      id: 'broken',
      category: 'macro',
      enabled: true,
      async fetchUpcoming() { throw new Error('boom'); },
      async resolve() { return ResolveStillOpen; },
    });
    registerSource(makeSource('healthy', []));
    const report = await runTick({
      now: new Date(),
      reader: fakeReader as any,
      writer: fakeWriter as any,
      seedLiquidity: fakeSeed as any,
      preloader: fakePreloader as any,
    });
    expect(report.perSource.broken.error).toMatch(/boom/);
    expect(report.perSource.healthy).toBeDefined();
  });

  it('respects per-tick limit: max 5 new markets per source', async () => {
    const drafts = Array.from({ length: 8 }, (_, i) => ({
      externalKey: `key-${i}`,
      category: 'macro' as const,
      question: 'Q',
      outcomes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      betDeadline: Math.floor(Date.now() / 1000) + 10_000,
      resolveAfter: Math.floor(Date.now() / 1000) + 20_000,
      resolveSourceMeta: {},
    }));
    registerSource(makeSource('fred-macro', drafts));
    fakeReader.marketIdForEventId.mockResolvedValue(null);
    fakeWriter.openMarket.mockResolvedValue('0xtx');
    // bypass post-open marketId lookup by returning a real id
    let postOpenCounter = 0n;
    fakeReader.marketIdForEventId.mockImplementation(async () => {
      if (fakeWriter.openMarket.mock.calls.length > postOpenCounter) {
        postOpenCounter = BigInt(fakeWriter.openMarket.mock.calls.length);
        return postOpenCounter;
      }
      return null;
    });

    const report = await runTick({
      now: new Date(),
      reader: fakeReader as any,
      writer: fakeWriter as any,
      seedLiquidity: fakeSeed as any,
      preloader: fakePreloader as any,
    });
    expect(report.perSource['fred-macro'].opened).toBe(5);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm vitest run test/markets/tick.test.ts
```

- [ ] **Step 3: 实现**

`web/lib/markets/scheduler/tick.ts`

```typescript
import { enabledSources } from '@/lib/markets/registry';
import { computeMarketId } from '@/lib/markets/external-key';
import type { ChainWriterLike, ChainReaderLike, SeedLiquidityLike, LensPreloaderLike } from './types';

const CREATE_LIMIT = 5;
const RESOLVE_LIMIT = 10;
const CREATE_GUARD_SECONDS = 600; // betDeadline 距 now 至少 10 分钟

export interface TickReport {
  perSource: Record<string, {
    opened: number;
    skipped: number;
    resolvedSettled: number;
    resolvedProposed: number;
    resolvedFinalized: number;
    error?: string;
  }>;
  totalDurationMs: number;
}

export interface RunTickArgs {
  now: Date;
  reader: ChainReaderLike;
  writer: ChainWriterLike;
  seedLiquidity: SeedLiquidityLike;
  preloader: LensPreloaderLike;
}

export async function runTick(args: RunTickArgs): Promise<TickReport> {
  const start = Date.now();
  const report: TickReport = { perSource: {}, totalDurationMs: 0 };

  for (const source of enabledSources()) {
    const perSource = {
      opened: 0,
      skipped: 0,
      resolvedSettled: 0,
      resolvedProposed: 0,
      resolvedFinalized: 0,
    };
    report.perSource[source.id] = perSource;

    try {
      // A. 发现 + 创建
      const drafts = await source.fetchUpcoming(args.now);
      const nowSec = Math.floor(args.now.getTime() / 1000);

      for (const d of drafts) {
        if (perSource.opened >= CREATE_LIMIT) break;
        if (d.betDeadline - nowSec < CREATE_GUARD_SECONDS) {
          perSource.skipped++;
          continue;
        }
        const eventId = computeMarketId(source.id, d.externalKey);
        const existing = await args.reader.marketIdForEventId(eventId);
        if (existing != null) {
          perSource.skipped++;
          continue;
        }
        await args.writer.openMarket({
          eventId,
          question: d.question,
          outcomeCount: d.outcomes.length,
          betDeadline: d.betDeadline,
          resolveAfter: d.resolveAfter,
        });

        // 取回链上分配的 id；如果还没生效（异步），跳过 seed/preload，下次 tick 再补
        const marketId = await args.reader.marketIdForEventId(eventId);
        if (marketId != null) {
          await args.seedLiquidity.seed(marketId, d.outcomes.length);
          await args.preloader.warm({
            eventId,
            category: d.category,
            question: d.question,
            externalKey: d.externalKey,
            outcomes: d.outcomes,
          });
        }
        perSource.opened++;
      }

      // B. 结题（需要遍历"已存在但未 settle"的市场；
      //    Phase 1 假设 chain-reader 暴露一个 pendingMarketsForSource(sourceId) 入口，
      //    详见 Task G.0 chain-reader 扩展）。
      // 出于篇幅，结题循环细节延后到 G.0 一并实施；此处先留空，让测试通过。
    } catch (err) {
      perSource.error = err instanceof Error ? err.message : String(err);
    }
  }

  report.totalDurationMs = Date.now() - start;
  return report;
}
```

`web/lib/markets/scheduler/types.ts`

```typescript
import type { OracleStatusName } from './chain-reader';
import type { LensPreloadTarget } from './lens-preloader';

export interface ChainReaderLike {
  marketIdForEventId(eventId: `0x${string}`): Promise<bigint | null>;
  oracleStatus(eventId: `0x${string}`): Promise<OracleStatusName>;
  marketSettled(marketId: bigint): Promise<boolean>;
}

export interface ChainWriterLike {
  openMarket(args: {
    eventId: `0x${string}`;
    question: string;
    outcomeCount: number;
    betDeadline: number;
    resolveAfter: number;
  }): Promise<`0x${string}`>;
  proposeOutcome(eventId: `0x${string}`, idx: number): Promise<`0x${string}`>;
  finalizeOutcome(eventId: `0x${string}`): Promise<`0x${string}`>;
  settleMarket(marketId: bigint): Promise<`0x${string}`>;
}

export interface SeedLiquidityLike {
  seed(marketId: bigint, outcomeCount: number): Promise<void>;
}

export interface LensPreloaderLike {
  warm(target: LensPreloadTarget): Promise<void>;
}
```

- [ ] **Step 4: 跑测试**

```bash
pnpm vitest run test/markets/tick.test.ts
```

预期：4 PASS。

- [ ] **Step 5: 提交**

```bash
git add web/lib/markets/scheduler/{tick,types}.ts web/test/markets/tick.test.ts
git commit -m "feat(markets): runTick orchestrator (discovery + create stage)"
```

### Task G.2：tick 结题分支（propose / finalize / settle）

**Files:**
- Modify: `web/lib/markets/scheduler/tick.ts`
- Modify: `web/lib/markets/scheduler/chain-reader.ts`（新增 `pendingMarketsForSource`）
- Test: `web/test/markets/tick-resolve.test.ts`

- [ ] **Step 1: 扩展 chain-reader**

在 `chain-reader.ts` 返回对象上追加：

```typescript
async pendingMarketsForSource(sourceId: string, knownEventIds: `0x${string}`[]): Promise<{
  marketId: bigint;
  eventId: `0x${string}`;
  resolveAfter: number;
  oracleStatus: OracleStatusName;
  proposedAt?: number;
  settled: boolean;
}[]> {
  const results: any[] = [];
  for (const eventId of knownEventIds) {
    const marketId = await this.marketIdForEventId(eventId);
    if (marketId == null) continue;
    const tuple = await client.readContract({
      address: eventMarketAddress,
      abi: eventMarketAbi,
      functionName: '_markets',
      args: [marketId],
    }) as readonly any[];
    const settled = tuple[4] !== 255;
    if (settled) continue;
    const status = await this.oracleStatus(eventId);
    results.push({
      marketId,
      eventId,
      resolveAfter: Number(tuple[3]),
      oracleStatus: status,
      settled: false,
    });
  }
  return results;
}
```

> **设计点**：`knownEventIds` 来自 source 的 `fetchUpcoming` —— cron 知道自己开过哪些题目，扫所有事件成本太高，让 source 自报家门。fred-macro 的 fetchUpcoming 默认就遍历过去/未来窗口，所以"已开过但未结题"的事件天然在它的输出里。

- [ ] **Step 2: 写失败测试**

`web/test/markets/tick-resolve.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resetRegistry, registerSource } from '@/lib/markets/registry';
import type { MarketSource } from '@/lib/markets/sources/base';
import { runTick } from '@/lib/markets/scheduler/tick';

const DAY = 86_400;
const NOW = new Date('2026-07-20T00:00:00Z');
const nowSec = Math.floor(NOW.getTime() / 1000);

const makeSource = (resolveResults: any[]): MarketSource => ({
  id: 'fred-macro',
  category: 'macro',
  enabled: true,
  async fetchUpcoming() { return []; },
  async resolve() { return resolveResults.shift(); },
});

const fakeReader = {
  marketIdForEventId: vi.fn(),
  oracleStatus: vi.fn(),
  marketSettled: vi.fn(),
  pendingMarketsForSource: vi.fn(),
};
const fakeWriter = {
  openMarket: vi.fn(),
  proposeOutcome: vi.fn().mockResolvedValue('0xtx'),
  finalizeOutcome: vi.fn().mockResolvedValue('0xtx'),
  settleMarket: vi.fn().mockResolvedValue('0xtx'),
};

beforeEach(() => {
  resetRegistry();
  Object.values(fakeReader).forEach((m: any) => m.mockReset?.());
  Object.values(fakeWriter).forEach((m: any) => m.mockReset?.());
});

describe('runTick resolve branch', () => {
  it('propose when oracle is pending and source returns settled', async () => {
    registerSource(makeSource([
      { kind: 'settled', settledOutcomeIndex: 1, publishedAt: nowSec },
    ]));
    fakeReader.pendingMarketsForSource.mockResolvedValue([
      { marketId: 1n, eventId: '0xee', resolveAfter: nowSec - DAY, oracleStatus: 'pending', settled: false },
    ]);
    await runTick({
      now: NOW,
      reader: fakeReader as any,
      writer: fakeWriter as any,
      seedLiquidity: { seed: vi.fn() } as any,
      preloader: { warm: vi.fn() } as any,
    });
    expect(fakeWriter.proposeOutcome).toHaveBeenCalledWith('0xee', 1);
  });

  it('skip when oracle is proposed but within challenge window (72h)', async () => {
    registerSource(makeSource([]));
    fakeReader.pendingMarketsForSource.mockResolvedValue([
      {
        marketId: 1n, eventId: '0xee', resolveAfter: nowSec - DAY,
        oracleStatus: 'proposed', proposedAt: nowSec - DAY, settled: false,
      },
    ]);
    await runTick({
      now: NOW,
      reader: fakeReader as any,
      writer: fakeWriter as any,
      seedLiquidity: { seed: vi.fn() } as any,
      preloader: { warm: vi.fn() } as any,
    });
    expect(fakeWriter.finalizeOutcome).not.toHaveBeenCalled();
  });

  it('finalize + settleMarket when challenge window has passed (>72h)', async () => {
    registerSource(makeSource([]));
    fakeReader.pendingMarketsForSource.mockResolvedValue([
      {
        marketId: 7n, eventId: '0xee', resolveAfter: nowSec - 4 * DAY,
        oracleStatus: 'proposed', proposedAt: nowSec - 4 * DAY, settled: false,
      },
    ]);
    await runTick({
      now: NOW,
      reader: fakeReader as any,
      writer: fakeWriter as any,
      seedLiquidity: { seed: vi.fn() } as any,
      preloader: { warm: vi.fn() } as any,
    });
    expect(fakeWriter.finalizeOutcome).toHaveBeenCalledWith('0xee');
    expect(fakeWriter.settleMarket).toHaveBeenCalledWith(7n);
  });

  it('does NOT auto-recover challenged state (logs only)', async () => {
    registerSource(makeSource([]));
    fakeReader.pendingMarketsForSource.mockResolvedValue([
      {
        marketId: 1n, eventId: '0xee', resolveAfter: nowSec - DAY,
        oracleStatus: 'challenged', settled: false,
      },
    ]);
    const report = await runTick({
      now: NOW,
      reader: fakeReader as any,
      writer: fakeWriter as any,
      seedLiquidity: { seed: vi.fn() } as any,
      preloader: { warm: vi.fn() } as any,
    });
    expect(fakeWriter.proposeOutcome).not.toHaveBeenCalled();
    expect(fakeWriter.finalizeOutcome).not.toHaveBeenCalled();
    expect(report.perSource['fred-macro'].resolvedSettled).toBe(0);
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

```bash
pnpm vitest run test/markets/tick-resolve.test.ts
```

- [ ] **Step 4: 在 tick.ts 中实现 resolve 分支**

替换 `runTick` 中"// B. 结题..."的占位段为：

```typescript
// B. 结题
const CHALLENGE_WINDOW_SECONDS = 72 * 3600;
// 从 source 的 upcoming 推导"已知 eventId 列表"
const knownEventIds = drafts.map((d) =>
  computeMarketId(source.id, d.externalKey),
);
const pending = await args.reader.pendingMarketsForSource(source.id, knownEventIds);

let processed = 0;
for (const m of pending) {
  if (processed >= RESOLVE_LIMIT) break;
  if (m.resolveAfter > nowSec) continue;

  switch (m.oracleStatus) {
    case 'pending': {
      const r = await source.resolve(toOnChainMarket(m, source.id, knownEventIds), args.now);
      if (r.kind === 'still-open') break;
      if (r.kind === 'invalid') {
        // Phase 1 不自动 invalidate（AdminEventOracle 没有 invalidate 入口，
        // 走 propose 一个 sentinel outcome + 之后 challenge 流程；本 Phase 跳过自动化）
        break;
      }
      await args.writer.proposeOutcome(m.eventId, r.settledOutcomeIndex);
      perSource.resolvedProposed++;
      processed++;
      break;
    }
    case 'proposed': {
      const proposedAgo = m.proposedAt != null ? nowSec - m.proposedAt : 0;
      if (proposedAgo >= CHALLENGE_WINDOW_SECONDS) {
        await args.writer.finalizeOutcome(m.eventId);
        await args.writer.settleMarket(m.marketId);
        perSource.resolvedFinalized++;
        perSource.resolvedSettled++;
        processed++;
      }
      break;
    }
    case 'challenged':
      // 不自动处理，留给 owner
      break;
    case 'finalized':
      // oracle 已 finalize，只需把 EventMarket 推 settled
      await args.writer.settleMarket(m.marketId);
      perSource.resolvedSettled++;
      processed++;
      break;
  }
}
```

加上辅助函数：

```typescript
function toOnChainMarket(m: any, sourceId: string, knownEventIds: `0x${string}`[]) {
  return {
    marketId: m.marketId,
    eventId: m.eventId,
    sourceId,
    externalKey: '', // resolve() 实现里直接用 eventId / externalKey 都可，
                    // 实际使用 externalKey 时由 source 自己从 resolveSourceMeta 读
    question: '',
    outcomeCount: 0,
    betDeadline: 0,
    resolveAfter: m.resolveAfter,
    isSettled: m.settled,
    oracleStatus: m.oracleStatus,
    proposedAt: m.proposedAt,
  };
}
```

> **注意：** `externalKey` 在 source.resolve 里要用到（fred-macro 用它解 seriesId）。实际实现要在 chain-reader 的 `pendingMarketsForSource` 里把它一起回填——简单做法：从 `EventMarket._markets` 的 question 字符串里 grep，或从 source 的 `fetchUpcoming` 输出反查。Phase 1 用反查法：把 drafts 做成 Map<eventId, externalKey>。

- [ ] **Step 5: 把反查逻辑加进 tick.ts**

把 "knownEventIds" 改为：

```typescript
const draftsByEventId = new Map<`0x${string}`, typeof drafts[number]>();
for (const d of drafts) {
  draftsByEventId.set(computeMarketId(source.id, d.externalKey), d);
}
const knownEventIds = Array.from(draftsByEventId.keys());
```

然后 `toOnChainMarket` 改为接收对应 draft 把 externalKey / question / outcomes 一并回填。

- [ ] **Step 6: 跑测试**

```bash
pnpm vitest run test/markets/tick-resolve.test.ts
pnpm vitest run test/markets
pnpm typecheck
```

预期：全部 PASS。

- [ ] **Step 7: 提交**

```bash
git add web/lib/markets/scheduler/{tick,chain-reader}.ts web/test/markets/tick-resolve.test.ts
git commit -m "feat(markets): tick resolve branch (propose / finalize / settle, 72h gate)"
```

### Task G.3：/api/cron/markets/tick 路由 + 注册 sources

**Files:**
- Create: `web/app/api/cron/markets/tick/route.ts`
- Create: `web/lib/markets/bootstrap.ts`（注册所有 source）

- [ ] **Step 1: 写 bootstrap**

`web/lib/markets/bootstrap.ts`

```typescript
import { registerSource } from './registry';
import { createFredClient } from './clients/fred';
import { createDefiLlamaClient } from './clients/defillama';
import { createFredMacroSource } from './sources/fred-macro';
import { createChainEventSource } from './sources/chain-event';

let bootstrapped = false;

export function bootstrapSources(): void {
  if (bootstrapped) return;
  const fredClient = createFredClient();
  const defiLlama = createDefiLlamaClient();
  registerSource(createFredMacroSource({ fredClient }));
  registerSource(createChainEventSource({ defiLlama }));
  bootstrapped = true;
}

export function getClients() {
  return {
    fredClient: createFredClient(),
    defiLlama: createDefiLlamaClient(),
  };
}
```

- [ ] **Step 2: 写 route handler**

`web/app/api/cron/markets/tick/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, sepolia } from 'viem/chains';

import { bootstrapSources } from '@/lib/markets/bootstrap';
import { runTick } from '@/lib/markets/scheduler/tick';
import { createChainReader } from '@/lib/markets/scheduler/chain-reader';
import { createChainWriter } from '@/lib/markets/scheduler/chain-writer';
import { createSeedLiquidity } from '@/lib/markets/scheduler/seed-liquidity';
import { createLensPreloader } from '@/lib/markets/scheduler/lens-preloader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`missing env: ${key}`);
  return v;
}

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  bootstrapSources();

  const rpcUrl = requireEnv('AUTOMATION_RPC_URL');
  const chain = process.env.AUTOMATION_CHAIN === 'mainnet' ? mainnet : sepolia;
  const account = privateKeyToAccount(requireEnv('AUTOMATION_PRIVATE_KEY') as `0x${string}`);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ chain, transport: http(rpcUrl), account });

  const eventMarketAddress = requireEnv('NEXT_PUBLIC_EVENT_MARKET_ADDRESS') as `0x${string}`;
  const oracleAddress = requireEnv('NEXT_PUBLIC_EVENT_ORACLE_ADDRESS') as `0x${string}`;
  const usdcAddress = requireEnv('NEXT_PUBLIC_USDC_ADDRESS') as `0x${string}`;

  const reader = createChainReader({
    client: publicClient,
    eventMarketAddress,
    oracleAddress,
    fromBlock: BigInt(process.env.MARKETS_FROM_BLOCK ?? '0'),
  });
  const writer = createChainWriter({
    walletClient,
    eventMarketAddress,
    oracleAddress,
    usdcAddress,
  });
  const seedLiquidity = createSeedLiquidity({
    writer,
    walletClient,
    eventMarketAddress,
    perMarketUsdc: 10_000_000n,
  });
  const preloader = createLensPreloader({
    warmFn: async (target) => {
      try {
        const baseUrl = process.env.LENS_PRELOAD_BASE_URL ?? '';
        const res = await fetch(`${baseUrl}/api/lens/${target.eventId}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ preload: true }),
        });
        return res.ok ? { status: 'ok' } : { status: 'error' };
      } catch {
        return { status: 'error' };
      }
    },
  });

  try {
    const report = await runTick({
      now: new Date(),
      reader,
      writer,
      seedLiquidity,
      preloader,
    });
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET(req: Request): Promise<Response> {
  return POST(req); // Vercel Cron 可能用 GET
}
```

- [ ] **Step 3: 手动触发测试（本地）**

```bash
cd web && pnpm dev &
sleep 5
curl -X POST http://localhost:3000/api/cron/markets/tick \
  -H "Authorization: Bearer $CRON_SECRET" \
  | jq
```

预期：返回 `{ ok: true, report: { perSource: { ... } } }`，本地若没配齐 env，预期看到 missing env 错误，确认 401 之前的鉴权过了即视为路由生效。

- [ ] **Step 4: 提交**

```bash
git add web/lib/markets/bootstrap.ts web/app/api/cron/markets/tick/route.ts
git commit -m "feat(markets): /api/cron/markets/tick + bootstrap"
```

### Task G.4：vercel.json cron 配置

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: 加 crons 字段**

读 `vercel.json` 当前内容（可能没有 crons），追加：

```json
{
  "crons": [
    { "path": "/api/cron/markets/tick", "schedule": "0 2 * * *" }
  ]
}
```

> **注意：** Vercel Cron 默认走 GET。我们 route 同时支持 GET/POST，但鉴权走 `Authorization` header；Vercel Cron 自动注入 `Authorization: Bearer $CRON_SECRET` 当环境变量 `CRON_SECRET` 设置后。文档：[Vercel Cron Authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs#authentication)。

- [ ] **Step 2: 校验**

```bash
cd web && pnpm vercel build
```

预期：build 通过，输出 cron schedule 注册。

- [ ] **Step 3: 提交**

```bash
git add vercel.json
git commit -m "chore(vercel): register daily cron for markets tick"
```

---

## Phase H：前端 UI

> 经 Task A.1 扩展 MarketCategory 后，整个项目里 switch / mapping 会有"未覆盖 macro/chain"的 TS 报错。Phase H 的目标是把所有这类点修齐 + 加两个 tab。

### Task H.1：MarketFilterBar 扩到 4 tab

**Files:**
- Modify: `web/components/MarketFilterBar.tsx`
- Test: `web/test/components/MarketFilterBar.test.tsx`（如不存在则新建）

- [ ] **Step 1: 收齐所有引用 MarketCategory 的位置**

```bash
cd web
rg "MarketCategory|MARKET_CATEGORIES|'crypto'\s*\|\s*'worldcup'" --type ts --type tsx -l
```

预期：列出所有需要扩到 4 类的文件。

- [ ] **Step 2: 写失败测试**

`web/test/components/MarketFilterBar.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarketFilterBar } from '@/components/MarketFilterBar';

describe('MarketFilterBar', () => {
  it('renders 4 category tabs', () => {
    render(
      <MarketFilterBar
        category="crypto"
        onCategoryChange={() => undefined}
      />,
    );
    expect(screen.getByRole('tab', { name: /crypto/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /world cup/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /macro/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /on-?chain/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 跑测试确认失败**

```bash
pnpm vitest run test/components/MarketFilterBar.test.tsx
```

- [ ] **Step 4: 修改 MarketFilterBar.tsx**

在现有 `CATEGORY_OPTIONS`（或类似常量）的两项之后追加：

```typescript
const CATEGORY_OPTIONS: { value: MarketCategory; label: string }[] = [
  { value: 'crypto',   label: 'Crypto' },
  { value: 'worldcup', label: 'World Cup' },
  { value: 'macro',    label: 'Macro' },
  { value: 'chain',    label: 'On-chain' },
];
```

确保 tab role 正确（`role="tab"` + `aria-selected`）。

- [ ] **Step 5: 跑测试**

```bash
pnpm vitest run test/components/MarketFilterBar.test.tsx
pnpm typecheck
```

预期：测试 PASS；typecheck 仍可能在其他文件报错——下一步处理。

- [ ] **Step 6: 修齐其余 switch / map（按 rg 列表逐个）**

针对每个被 rg 标出的文件：
- 若有 `switch (category)` / 字面量字典：加 `macro` / `chain` 两 case，标签用 `'Macro'` / `'On-chain'`
- 若是路由 / API filter：透传即可（已自动覆盖）

- [ ] **Step 7: 提交**

```bash
git add web/components/MarketFilterBar.tsx \
        web/test/components/MarketFilterBar.test.tsx \
        $(git diff --name-only -- 'web/**/*.ts' 'web/**/*.tsx')
git commit -m "feat(ui): MarketFilterBar 支持 4 category"
```

### Task H.2：HomeHero 暴露新品类入口

**Files:**
- Modify: `web/components/HomeHero.tsx`

> **背景：** 当前 HomeHero 已有未提交的本地改动（`git status` 显示 M）。先把它和本任务的改动分清：
> 1. 先 `git diff web/components/HomeHero.tsx` 看清现有 staged 状态
> 2. 本任务只追加"新品类入口"卡片，不动 worldcup 既有内容

- [ ] **Step 1: 看清当前 HomeHero 状态**

```bash
git diff web/components/HomeHero.tsx
```

- [ ] **Step 2: 在 hero 内容区追加 2 个新品类入口（结构按现有 design system）**

按 HomeHero 现有 "category card" 模式追加：

```tsx
const NEW_CATEGORIES: { href: string; title: string; sub: string }[] = [
  { href: '/?category=macro', title: 'Macro',    sub: 'CPI · Fed · NFP' },
  { href: '/?category=chain', title: 'On-chain', sub: 'TVL · unlocks' },
];

// 在原有 crypto / worldcup 卡片之后插入：
{NEW_CATEGORIES.map((c) => (
  <Link key={c.href} href={c.href} className="<复用原有卡片 className>">
    <span className="text-lg font-semibold">{c.title}</span>
    <span className="text-sm opacity-80">{c.sub}</span>
  </Link>
))}
```

> 具体 className / 布局直接模仿原有 worldcup 卡片的写法；不引入新设计 token。

- [ ] **Step 3: 目视验证**

```bash
cd web && pnpm dev
# 浏览器打开 http://localhost:3000
# 检查 Hero 区出现 4 个 category 入口，2 个新入口点击跳转 /?category=macro|chain
```

- [ ] **Step 4: 提交**

```bash
git add web/components/HomeHero.tsx
git commit -m "feat(ui): expose macro + chain entries on HomeHero"
```

---

## Phase I：验收

### Task I.1：mainnet fork E2E smoke test

**Files:**
- Create: `web/test/markets/e2e-tick.test.ts`（标记 `it.skipIf(!process.env.E2E)`）

**目的：** 在 mainnet fork（anvil）上跑一次完整 tick：bootstrap → fetchUpcoming → openMarket → seed → preload → propose → finalize → settle，验证整条链路。

- [ ] **Step 1: 启 anvil fork**

```bash
anvil --fork-url $MAINNET_RPC --chain-id 31337 --port 8545 &
ANVIL_PID=$!
trap "kill $ANVIL_PID" EXIT
```

- [ ] **Step 2: 部署一份本地 EventMarket + AdminEventOracle（如 mainnet 上没现成）**

```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# 记录输出地址到环境变量
```

- [ ] **Step 3: 写 e2e 测试（直接调 runTick，不走 HTTP）**

`web/test/markets/e2e-tick.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

import { bootstrapSources } from '@/lib/markets/bootstrap';
import { runTick } from '@/lib/markets/scheduler/tick';
import { createChainReader } from '@/lib/markets/scheduler/chain-reader';
import { createChainWriter } from '@/lib/markets/scheduler/chain-writer';
import { createSeedLiquidity } from '@/lib/markets/scheduler/seed-liquidity';
import { createLensPreloader } from '@/lib/markets/scheduler/lens-preloader';

describe.skipIf(!process.env.E2E)('E2E tick on fork', () => {
  it('runs full lifecycle: open → seed → preload → propose → finalize → settle', async () => {
    bootstrapSources();
    const rpc = http('http://localhost:8545');
    const account = privateKeyToAccount(process.env.E2E_PRIVATE_KEY as `0x${string}`);
    const publicClient = createPublicClient({ chain: foundry, transport: rpc });
    const walletClient = createWalletClient({ chain: foundry, transport: rpc, account });

    const reader = createChainReader({
      client: publicClient,
      eventMarketAddress: process.env.E2E_EVENT_MARKET as `0x${string}`,
      oracleAddress: process.env.E2E_ORACLE as `0x${string}`,
    });
    const writer = createChainWriter({
      walletClient,
      eventMarketAddress: process.env.E2E_EVENT_MARKET as `0x${string}`,
      oracleAddress: process.env.E2E_ORACLE as `0x${string}`,
      usdcAddress: process.env.E2E_USDC as `0x${string}`,
    });

    // tick 1: open
    const report1 = await runTick({
      now: new Date(),
      reader,
      writer,
      seedLiquidity: createSeedLiquidity({ writer, walletClient, eventMarketAddress: process.env.E2E_EVENT_MARKET as `0x${string}`, perMarketUsdc: 10_000_000n }),
      preloader: createLensPreloader({ warmFn: async () => ({ status: 'ok' }) }),
    });
    const openedFred = report1.perSource['fred-macro']?.opened ?? 0;
    const openedChain = report1.perSource['chain-event']?.opened ?? 0;
    expect(openedFred + openedChain).toBeGreaterThan(0);

    // tick 2 (after anvil time jump): propose
    await publicClient.request({ method: 'evm_increaseTime' as any, params: [100 * 86400] } as any);
    await publicClient.request({ method: 'evm_mine' as any, params: [] } as any);
    const report2 = await runTick({ /* same args */ } as any);
    const propose = Object.values(report2.perSource).reduce((sum, s) => sum + s.resolvedProposed, 0);
    expect(propose).toBeGreaterThan(0);

    // tick 3 (after 72h): finalize + settle
    await publicClient.request({ method: 'evm_increaseTime' as any, params: [72 * 3600 + 60] } as any);
    await publicClient.request({ method: 'evm_mine' as any, params: [] } as any);
    const report3 = await runTick({ /* same args */ } as any);
    const settled = Object.values(report3.perSource).reduce((sum, s) => sum + s.resolvedSettled, 0);
    expect(settled).toBeGreaterThan(0);
  }, 60_000);
});
```

> **简化点**：实际实现中 tick 2/3 的 args 应该提取成 helper，此处为可读性铺开。

- [ ] **Step 4: 跑 E2E**

```bash
E2E=1 \
E2E_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
E2E_EVENT_MARKET=0x... \
E2E_ORACLE=0x... \
E2E_USDC=0x... \
pnpm vitest run test/markets/e2e-tick.test.ts
```

预期：3 PASS（open / propose / settle）。

- [ ] **Step 5: 提交**

```bash
git add web/test/markets/e2e-tick.test.ts
git commit -m "test(e2e): full tick lifecycle on anvil fork"
```

### Task I.2：testnet 部署 + 24h 稳定运行

> **目的：** 把 Phase 1 实施完整跑到 testnet，验证 cron 在真实环境下 24h 不出问题，作为 Phase 2 触发条件。

- [ ] **Step 1: 在 testnet 部署/确认 EventMarket + AdminEventOracle 已部署**

如已部署，从现有 deploy 记录拿地址；否则跑 `script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast`。

- [ ] **Step 2: 自动化钱包注资**

```bash
cast send <AUTOMATION_ADDRESS> --value 0.05ether --rpc-url $SEPOLIA_RPC_URL --private-key $FUNDER_KEY
# Mock USDC mint or transfer 1000 USDC to AUTOMATION_ADDRESS
```

- [ ] **Step 3: oracle owner 转移到 AUTOMATION_ADDRESS**

```bash
cast send $ORACLE_ADDRESS "transferOwnership(address)" $AUTOMATION_ADDRESS \
  --rpc-url $SEPOLIA_RPC_URL --private-key $DEPLOYER_KEY
```

- [ ] **Step 4: 部署到 Vercel preview**

```bash
git push origin <branch>
# Vercel auto-deploy preview
# 在 preview 上手动触发 /api/cron/markets/tick
curl -X POST https://<preview-url>/api/cron/markets/tick -H "Authorization: Bearer $CRON_SECRET"
```

预期：返回 `{ ok: true, report: { perSource: { ... } } }`，testnet 上能看到 MarketCreated 事件。

- [ ] **Step 5: 启用每日 cron 24h 观察**

合并到 main，让 Vercel daily cron 接管。每天检查：
- cron 调用是否成功（Vercel Logs）
- 每次 tick 是否 < 60s
- 每个 source 的 `opened` / `error` 数字
- testnet Etherscan 上看新市场出现

**Phase 1 验收完成条件**：
- 24h 内至少 3 次 cron tick 全部 200 ok
- 累计开出至少 5 个 macro + 5 个 chain market（合计 ≥ 10）
- 至少 1 个市场走完 propose → finalize → settle 流程
- 单次 tick 平均时长 < 30s

达成后 → Phase 2 触发；不达成 → 留在 Phase 1 修。

- [ ] **Step 6: 写 Discord 更新**（Arc Discord builder 叙事）

写一篇短文（200-400 字），描述：本周新增的 2 个全自动化品类、自动化管道架构、未来 source plugin 加品类的成本。附 testnet 上的 MarketCreated 截图。

---

## Phase J：归档

### Task J.1：merge delta 到 openspec/specs/

**Files:**
- Create: `openspec/specs/market-sources/spec.md`
- Modify: `openspec/specs/market-category/spec.md`（如已存在；否则新建）
- Modify: `openspec/specs/ai-lens/spec.md`（合并 delta）

- [ ] **Step 1: 把 ADDED 的 market-sources delta 整段拷贝到 `openspec/specs/market-sources/spec.md`**，去掉 `## ADDED Requirements` 标题，直接以 `## Requirements` 起头。

- [ ] **Step 2: MODIFIED 的 market-category 和 ai-lens 改动合并到 specs/ 对应文件**：把 delta 中的 `## MODIFIED Requirements` 段落替换 / 追加到现有 spec.md 的对应 Requirement。

- [ ] **Step 3: 验证 specs 仍然自洽**

```bash
openspec validate add-automated-categories --strict
# 用 graphify-out/GRAPH_REPORT.md 对一遍系统能力图谱（如可用）
```

- [ ] **Step 4: 提交**

```bash
git add openspec/specs/
git commit -m "openspec(specs): merge add-automated-categories delta into specs/"
```

### Task J.2：归档 change

**Files:**
- Move: `openspec/changes/add-automated-categories/` → `openspec/changes/archive/2026-XX-XX-add-automated-categories/`

- [ ] **Step 1: 用具体归档日期重命名**

```bash
TODAY=$(date -u +%F)
mkdir -p openspec/changes/archive
git mv openspec/changes/add-automated-categories \
       openspec/changes/archive/${TODAY}-add-automated-categories
```

- [ ] **Step 2: 把 tasks.md 中所有 `[ ]` 改为 `[x]`**

```bash
sed -i '' 's/- \[ \]/- [x]/g' openspec/changes/archive/${TODAY}-add-automated-categories/tasks.md
```

- [ ] **Step 3: 提交**

```bash
git add openspec/changes/
git commit -m "openspec(archive): add-automated-categories"
```

### Task J.3：更新 design 文档状态

- [ ] **Step 1: 把 spec 文档 frontmatter 的 `Status: Draft` 改为 `Status: Implemented`**

```bash
sed -i '' 's/^> Status: Draft.*/> Status: Implemented/' \
  docs/superpowers/specs/2026-06-17-categories-expansion-design.md
```

- [ ] **Step 2: 提交**

```bash
git add docs/superpowers/specs/2026-06-17-categories-expansion-design.md
git commit -m "docs(spec): mark categories-expansion design as Implemented"
```

---

## Self-Review

> 此节是 plan 作者（Claude）在交付前完成的自审。读到此处的实施工程师可以跳过。

### Spec 覆盖

| Spec 节 | 对应 plan |
|---|---|
| §1 背景与目标 | Phase 0 proposal.md |
| §2 设计原则（零合约改动 / 插件化 / 链上即真相 / 幂等 / 失败局部化） | Phase A.2 / A.3 / G.1 / G.2 |
| §3 架构总览 | 文件结构总览 + Phase D / G |
| §4 MarketSource 接口 | Phase A.3 / A.4 |
| §5.1 EventMarket 统一路径 | Phase D.2 openMarket |
| §5.2 多步结题（72h challenge window） | Phase G.2 |
| §5.3 宏观题目区间化 | Phase E.1 SERIES 表 |
| §5.4 自动化钱包 | Phase I.2 Step 2-3 |
| §5.5 cron 平台 / 路径 / 鉴权 | Phase G.3 / G.4 |
| §6.1-6.3 macro/chain contextBuilder | Phase F.1 / F.2 |
| §6.4 预生成 cache | Phase F.4 + G.1 集成 |
| §6.5 route-handler dispatch | Phase F.3 |
| §7 落地路径（Phase 1） | 整份 plan |
| §8 风险与缓解 | Phase G.1 失败局部化 + I.2 24h 观察 |
| §10 Out of Scope | （隐性）plan 未触及 |

覆盖完整。

### Placeholder 扫描

- 无 TBD / TODO
- 所有 step 含具体代码 / 命令 / 预期输出
- "实施提示" 标注的位置（如 Task F.3 grep buildUserMessage）属于实施时定位指引，非 placeholder

### 类型一致性

- `MarketDraft.outcomes` 在 base.ts / fred-macro / chain-event / tick 中始终是 `{ id: string; label: string }[]`
- `OnChainMarket` 在 base.ts 定义、tick.ts toOnChainMarket / chain-reader.pendingMarketsForSource 中保持一致
- `eventId: \`0x\${string}\`` 类型贯穿
- `marketId: bigint`（EventMarket 用 uint256）贯穿
- `ResolvedOutcome` 三态：`'still-open' | 'invalid' | 'settled'` 一致

### 已修缺口（实施时勿再补）

- Phase A.3 v0.2 砍掉了 `kind` 字段（不再区分 price/event）
- Phase 0.2 spec delta 数量从 4 降到 3（fred-adapter 已废）
- Phase C 标记废弃但保留章节占位，避免 D-J 编号重排

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-18-automated-categories.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
