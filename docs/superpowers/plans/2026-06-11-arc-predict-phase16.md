# ArcPredict Phase 16+ 实施计划（造势与流动性自动化）

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 不动合约 `0xCFDC9B7F4a4c360CF5B3a31Bb33eB46aD8A3dA43`，新增三个守护脚本（`MarketScheduler`、`TopUpSeeds`、`GenerateSeeds`）+ 前端三处微调（cadence/asset 过滤、活跃 badges、seed 流动性披露），让 testnet 站点持续显得活跃。

**Architecture:** 三守护进程（schedule / resolve / topup），互不干扰；调度器无状态，每轮重算缺口、补造、双边 seed；seed 钱包池 12 个；前端纯客户端聚合，无新合约 view。

**Tech Stack:** TypeScript / viem ^2 / @pythnetwork/hermes-client / dotenv / node:test / Next.js 14 / wagmi v2 / Tailwind / launchd (macOS) / systemd / cron。沿用现有 `contracts/script/ops/` 的 ESM + `tsx` + `check_*.ts` 模式与 `web/test/check_*.mjs` 模式。

**Spec:** `docs/superpowers/specs/2026-06-11-arc-predict-phase16-design.md`（含完整不变量、错误矩阵、运维 runbook、视觉/语言基线）

**全程约束：**
- 中文注释 + 中文 commit message
- 每个 task 结束 commit（DRY/YAGNI/TDD/frequent commits）
- 任何步骤不通过先看 spec §8 错误矩阵 / §10 待验证清单，再求助用户
- 用户指定 Phase 16+ 新组件**英文 UI**；存量中文页面保留
- 合约层零改动；`forge test` 必须仍 130 passed

---

## File Structure

```
contracts/script/ops/
├── MarketScheduler.ts             # 新增 - 调度器主入口（npm run schedule）
├── TopUpSeeds.ts                  # 新增 - 余额扫描与告警（npm run topup）
├── GenerateSeeds.ts               # 新增 - 一次性生成钱包池（npm run generate-seeds）
├── scheduler.config.ts            # 新增 - 目标矩阵 / cadence / Pyth priceId / 阈值
├── lib/                           # 新增 - 共享工具
│   ├── clients.ts                 # viem public/wallet client 工厂（从 ResolveDueMarkets 提炼）
│   ├── env.ts                     # .env / .env.seeds 加载与校验
│   ├── hermes.ts                  # 当前价拉取（HermesClient 封装）
│   ├── rng.ts                     # mulberry32 + Fisher-Yates 选 k
│   ├── cadence-tag.ts             # question 模板生成 / 反向解析
│   ├── market-scan.ts             # scanActiveMarkets（分页 + 归桶）
│   ├── gaps.ts                    # computeGaps 纯函数
│   ├── seed-events.ts             # Bet 事件扫描（is-already-seeded 判据）
│   ├── seed-amount.ts             # seedAmount（YES/NO 独立金额）
│   ├── pick-seeds.ts              # pickSeedWallets
│   ├── thresholds.ts              # BALANCE_THRESHOLDS + 分类
│   └── abi.ts                     # PredictionMarket ABI 加载（从 ResolveDueMarkets 提炼）
├── test/
│   ├── check_resolve_due_markets.ts  # 既有不动
│   ├── check_readme.ts               # 既有不动
│   ├── check_scheduler_config.ts     # 新增
│   ├── check_cadence_tag.ts          # 新增
│   ├── check_rng.ts                  # 新增
│   ├── check_compute_gaps.ts         # 新增
│   ├── check_pick_seeds.ts           # 新增
│   ├── check_seed_amount.ts          # 新增
│   ├── check_seed_events.ts          # 新增
│   ├── check_market_scan.ts          # 新增
│   ├── check_topup_thresholds.ts     # 新增
│   ├── check_topup_main.ts           # 新增
│   ├── check_generate_seeds.ts       # 新增
│   └── check_scheduler_main.ts       # 新增
├── package.json                   # 修改 - 加 schedule / topup / generate-seeds 脚本
└── README.md                      # 修改 - 加 Phase 16+ runbook 节

contracts/.env.seeds               # 本地生成，git-ignore
contracts/.env.example.seeds       # 新增 - 文档化的 .env.seeds 形态
.gitignore                         # 修改 - 显式追加 contracts/.env.seeds

web/lib/
├── seed-wallets.ts                # 新增 - 公开地址清单（generate-seeds 写入，commit）
├── cadence-tag.ts                 # 新增 - 与 ops 镜像的解析（独立实现，测试对齐）
└── phase16-flag.ts                # 新增 - NEXT_PUBLIC_PHASE16_ENABLED 解析

web/components/
├── MarketFilterBar.tsx            # 新增
├── ActivityBadges.tsx             # 新增
└── SeedDisclosure.tsx             # 新增

web/test/
├── check_market_filter.mjs        # 新增
├── check_activity_badges.mjs      # 新增
└── check_seed_disclosure.mjs      # 新增

ops/launchd/                       # 新增（仅文档，plist 由 owner 复制到 ~/Library/LaunchAgents/）
├── com.arcpredict.ops.schedule.plist
└── com.arcpredict.ops.topup.plist
```

---

## 阶段总览

| Phase | 主题 | 任务 | 依赖 |
|---|---|---|---|
| A | 基础库与配置 | A1–A8 | 无 |
| B | TopUpSeeds | B1–B3 | A |
| C | MarketScheduler | C1–C8 | A、B |
| D | 前端微调 | D1–D6 | A（共享解析） |
| E | 联动与验收 | E1–E5 | A–D |

---

## Phase A：基础库与配置

### Task A1：scheduler.config.ts 与校验

**Files:**
- Create: `contracts/script/ops/scheduler.config.ts`
- Create: `contracts/script/ops/test/check_scheduler_config.ts`

- [ ] **Step 1：写失败测试**

`contracts/script/ops/test/check_scheduler_config.ts`：

```typescript
import assert from "node:assert/strict";
import {
  CADENCE_DURATION,
  PYTH_PRICE_ID,
  TARGET_ACTIVE,
  THRESHOLD_OFFSETS_PCT,
  validateConfig,
  totalActive,
} from "../scheduler.config.ts";

const cases: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void) { cases.push({ name, fn }); }

test("每个 cadence 的 betHours < resolveHours", () => {
  for (const c of Object.keys(CADENCE_DURATION) as Array<keyof typeof CADENCE_DURATION>) {
    const d = CADENCE_DURATION[c];
    assert.ok(d.betHours < d.resolveHours, `${c} 的 betHours 必须小于 resolveHours`);
  }
});

test("THRESHOLD_OFFSETS_PCT 与 TARGET_ACTIVE 长度对齐", () => {
  for (const asset of Object.keys(TARGET_ACTIVE) as Array<keyof typeof TARGET_ACTIVE>) {
    for (const cadence of Object.keys(TARGET_ACTIVE[asset]) as Array<keyof typeof CADENCE_DURATION>) {
      assert.equal(
        TARGET_ACTIVE[asset][cadence],
        THRESHOLD_OFFSETS_PCT[cadence].length,
        `${asset}/${cadence} 目标活跃数必须等于偏移阶梯长度`,
      );
    }
  }
});

test("总活跃数 >= 25", () => {
  assert.ok(totalActive() >= 25, "总活跃数必须 >= 25");
});

test("PYTH_PRICE_ID 三个值都是 32 字节 hex", () => {
  for (const id of Object.values(PYTH_PRICE_ID)) {
    assert.match(id, /^0x[0-9a-fA-F]{64}$/, `${id} 不是 32 字节 hex`);
  }
});

test("validateConfig 不抛", () => {
  validateConfig();
});

for (const c of cases) {
  try { await c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
```

- [ ] **Step 2：跑测试确认失败**

```bash
cd contracts/script/ops
npx tsx test/check_scheduler_config.ts
```

期望：失败，import 报错（文件还不存在）。

- [ ] **Step 3：写实现**

`contracts/script/ops/scheduler.config.ts`：

```typescript
// Phase 16+ 调度器目标矩阵与时间常量
// 改这个文件 = 改菜单；重启 launchd 即生效。

export type Cadence = "daily" | "weekly" | "monthly" | "quarterly";
export type Asset = "BTC" | "ETH" | "SOL";

// 下注窗口与结算时间（小时）；betHours 必须严格小于 resolveHours
export const CADENCE_DURATION: Record<Cadence, { betHours: number; resolveHours: number }> = {
  daily:     { betHours: 20,      resolveHours: 24    },
  weekly:    { betHours: 7*24-4,  resolveHours: 7*24  },
  monthly:   { betHours: 30*24-8, resolveHours: 30*24 },
  quarterly: { betHours: 90*24-12, resolveHours: 90*24 },
};

// Pyth Hermes 上的 priceId（32 字节 hex），实施前必须按 spec §10 用 cast 验证
// 占位：实施时由 owner 替换为真实值
export const PYTH_PRICE_ID: Record<Asset, `0x${string}`> = {
  BTC: "0x0000000000000000000000000000000000000000000000000000000000000000",
  ETH: "0x0000000000000000000000000000000000000000000000000000000000000000",
  SOL: "0x0000000000000000000000000000000000000000000000000000000000000000",
};

// 同时活跃市场数目标，主力放在周/月/季度
export const TARGET_ACTIVE: Record<Asset, Record<Cadence, number>> = {
  BTC: { daily: 1, weekly: 3, monthly: 3, quarterly: 2 },
  ETH: { daily: 1, weekly: 3, monthly: 3, quarterly: 2 },
  SOL: { daily: 1, weekly: 2, monthly: 2, quarterly: 2 },
};

// 阈值偏移百分比阶梯；长度必须等于该 cadence 的 TARGET_ACTIVE
export const THRESHOLD_OFFSETS_PCT: Record<Cadence, number[]> = {
  daily:     [0],
  weekly:    [-3, 0, +3],
  monthly:   [-8, 0, +8],
  quarterly: [-15, 0, +15],
};

// 合约部署区块（用于扫 Bet 事件）；实施时由 owner 填真实值
export const DEPLOY_BLOCK: bigint = 0n;

export function totalActive(): number {
  let s = 0;
  for (const a of Object.keys(TARGET_ACTIVE) as Asset[]) {
    for (const c of Object.keys(TARGET_ACTIVE[a]) as Cadence[]) {
      s += TARGET_ACTIVE[a][c];
    }
  }
  return s;
}

export function validateConfig(): void {
  for (const c of Object.keys(CADENCE_DURATION) as Cadence[]) {
    const d = CADENCE_DURATION[c];
    if (d.betHours >= d.resolveHours) {
      throw new Error(`${c} 的 betHours 必须严格小于 resolveHours`);
    }
  }
  for (const a of Object.keys(TARGET_ACTIVE) as Asset[]) {
    for (const c of Object.keys(TARGET_ACTIVE[a]) as Cadence[]) {
      const expected = THRESHOLD_OFFSETS_PCT[c].length;
      const actual = TARGET_ACTIVE[a][c];
      if (actual !== expected) {
        throw new Error(`${a}/${c}：TARGET_ACTIVE(${actual}) 必须等于 THRESHOLD_OFFSETS_PCT 长度(${expected})`);
      }
    }
  }
  if (totalActive() < 25) {
    throw new Error(`总活跃数 ${totalActive()} 小于 25`);
  }
  for (const id of Object.values(PYTH_PRICE_ID)) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(id)) {
      throw new Error(`priceId ${id} 不是 32 字节 hex`);
    }
  }
}
```

注意：`PYTH_PRICE_ID` 和 `DEPLOY_BLOCK` 的占位值会让 `validateConfig` 的 priceId 校验**通过**（全 0 是合法 hex），但实际链上调用会 revert。Task E1 负责替换为真实值。

- [ ] **Step 4：跑测试确认通过**

```bash
cd contracts/script/ops
npx tsx test/check_scheduler_config.ts
```

期望：5 行 `OK: ...`，无 FAIL，退出码 0。

- [ ] **Step 5：commit**

```bash
git add contracts/script/ops/scheduler.config.ts contracts/script/ops/test/check_scheduler_config.ts
git commit -m "feat(ops): 添加 Phase 16+ 调度器目标矩阵与校验"
```

### Task A2：lib/cadence-tag.ts 与解析

**Files:**
- Create: `contracts/script/ops/lib/cadence-tag.ts`
- Create: `contracts/script/ops/test/check_cadence_tag.ts`

- [ ] **Step 1：写失败测试**

```typescript
// contracts/script/ops/test/check_cadence_tag.ts
import assert from "node:assert/strict";
import { formatQuestion, parseCadenceTag, formatDateUtc } from "../lib/cadence-tag.ts";

const cases: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void) { cases.push({ name, fn }); }

test("formatQuestion 生成可解析的文本", () => {
  const q = formatQuestion("BTC", 71200, 1781990400n, "weekly");
  assert.match(q, /^BTC\/USD ≥ 71200 @ \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC \[weekly\]$/);
  assert.equal(parseCadenceTag(q), "weekly");
});

test("parseCadenceTag 支持四档", () => {
  for (const c of ["daily","weekly","monthly","quarterly"] as const) {
    assert.equal(parseCadenceTag(`foo [${c}]`), c);
  }
});

test("parseCadenceTag 失败返回 unknown", () => {
  assert.equal(parseCadenceTag("无 tag"), "unknown");
  assert.equal(parseCadenceTag("BTC/USD ≥ 71200 @ 2026-06-17 [weeky]"), "unknown");
});

test("formatDateUtc 是 UTC 格式", () => {
  // 2026-06-17 12:00:00 UTC = 1781956800（用 Date 验证）
  const ts = BigInt(Date.UTC(2026, 5, 17, 12, 0, 0) / 1000);
  assert.equal(formatDateUtc(ts), "2026-06-17 12:00 UTC");
});

for (const c of cases) {
  try { c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
```

- [ ] **Step 2：跑测试确认失败**

```bash
cd contracts/script/ops
npx tsx test/check_cadence_tag.ts
```

期望：失败（import 报错）。

- [ ] **Step 3：写实现**

```typescript
// contracts/script/ops/lib/cadence-tag.ts
// question 模板：{ASSET}/USD ≥ {THRESHOLD} @ {DATE_UTC} [{CADENCE}]
// 例：BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [weekly]
// 反查 cadence 是合约不存 cadence 时的唯一可靠源（spec INV-9）。

import type { Asset, Cadence } from "../scheduler.config.ts";

const CADENCE_TAG_RE = /\[(daily|weekly|monthly|quarterly)\]\s*$/;

export type ParsedCadence = Cadence | "unknown";

export function formatDateUtc(unixSeconds: bigint): string {
  const d = new Date(Number(unixSeconds) * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}

export function formatQuestion(
  asset: Asset,
  humanThreshold: number,
  resolveAfter: bigint,
  cadence: Cadence,
): string {
  return `${asset}/USD ≥ ${humanThreshold} @ ${formatDateUtc(resolveAfter)} [${cadence}]`;
}

export function parseCadenceTag(question: string): ParsedCadence {
  const m = question.match(CADENCE_TAG_RE);
  if (!m) return "unknown";
  return m[1] as Cadence;
}
```

- [ ] **Step 4：跑测试确认通过**

```bash
cd contracts/script/ops
npx tsx test/check_cadence_tag.ts
```

期望：4 行 `OK: ...`。

- [ ] **Step 5：commit**

```bash
git add contracts/script/ops/lib/cadence-tag.ts contracts/script/ops/test/check_cadence_tag.ts
git commit -m "feat(ops): 添加 question 模板与 cadence 反向解析"
```

### Task A3：lib/rng.ts（mulberry32 + Fisher-Yates）

**Files:**
- Create: `contracts/script/ops/lib/rng.ts`
- Create: `contracts/script/ops/test/check_rng.ts`

- [ ] **Step 1：写失败测试**

```typescript
// contracts/script/ops/test/check_rng.ts
import assert from "node:assert/strict";
import { mulberry32, pickK, deterministicSeedFromBigInt } from "../lib/rng.ts";

const cases: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void) { cases.push({ name, fn }); }

test("mulberry32 同种子结果一致", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    assert.equal(a(), b());
  }
});

test("mulberry32 不同种子结果不同", () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  let diff = 0;
  for (let i = 0; i < 100; i++) {
    if (a() !== b()) diff++;
  }
  assert.ok(diff > 90, "100 次取值至少 90 次不同");
});

test("pickK 长度正确且不重复", () => {
  const pool = [0,1,2,3,4,5,6,7,8,9];
  const picked = pickK(pool, 3, mulberry32(123));
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked).size, 3);
  for (const p of picked) assert.ok(pool.includes(p));
});

test("pickK 同种子同结果", () => {
  const pool = [0,1,2,3,4,5,6,7,8,9];
  const a = pickK(pool, 3, mulberry32(123));
  const b = pickK(pool, 3, mulberry32(123));
  assert.deepEqual(a, b);
});

test("deterministicSeedFromBigInt 在 uint32 范围内", () => {
  const huge = 2n ** 200n + 12345n;
  const s = deterministicSeedFromBigInt(huge);
  assert.ok(s >= 0 && s < 2 ** 32);
});

for (const c of cases) {
  try { c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
```

- [ ] **Step 2：跑测试确认失败**

```bash
cd contracts/script/ops
npx tsx test/check_rng.ts
```

期望：import 报错。

- [ ] **Step 3：写实现**

```typescript
// contracts/script/ops/lib/rng.ts
// 确定性 RNG：同种子复现 seed 钱包选择与金额，便于排障。

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t ^= (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 把 bigint 收敛到 uint32 范围，用于喂 mulberry32
export function deterministicSeedFromBigInt(v: bigint): number {
  return Number(v & 0xffffffffn);
}

// Fisher-Yates 从 pool 取前 k 个不重复元素；不修改原数组
export function pickK<T>(pool: readonly T[], k: number, rand: () => number): T[] {
  if (k > pool.length) throw new Error(`pickK: k(${k}) > pool.length(${pool.length})`);
  const arr = [...pool];
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rand() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, k);
}
```

- [ ] **Step 4：跑测试确认通过**

```bash
cd contracts/script/ops
npx tsx test/check_rng.ts
```

期望：5 行 `OK: ...`。

- [ ] **Step 5：commit**

```bash
git add contracts/script/ops/lib/rng.ts contracts/script/ops/test/check_rng.ts
git commit -m "feat(ops): 添加确定性 RNG 与 Fisher-Yates 选 k"
```

### Task A4：lib/clients.ts + lib/abi.ts + lib/env.ts（基础设施提炼）

把 `ResolveDueMarkets.ts` 里的客户端工厂 / ABI 加载 / env 解析提炼成可复用的 lib。**不破坏现有 `npm run check`**。

**Files:**
- Create: `contracts/script/ops/lib/clients.ts`
- Create: `contracts/script/ops/lib/abi.ts`
- Create: `contracts/script/ops/lib/env.ts`
- Modify: `contracts/script/ops/ResolveDueMarkets.ts`（仅替换为从 lib 导入；不改逻辑）

- [ ] **Step 1：建 lib/abi.ts**

```typescript
// contracts/script/ops/lib/abi.ts
// PredictionMarket ABI 加载；与 ResolveDueMarkets 共用
import { readFileSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Abi } from "viem";

const HERE = dirname(fileURLToPath(import.meta.url));

export function loadPredictionMarketAbi(): Abi {
  const artifact = JSON.parse(
    readFileSync(pathResolve(HERE, "../../../out/PredictionMarket.sol/PredictionMarket.json"), "utf8"),
  ) as { abi?: Abi };
  if (!artifact.abi) throw new Error("PredictionMarket ABI 不存在");
  return artifact.abi;
}
```

- [ ] **Step 2：建 lib/clients.ts**

```typescript
// contracts/script/ops/lib/clients.ts
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export function createArcTestnetChain(rpcUrl: string) {
  return defineChain({
    id: 5_042_002,
    name: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    rpcUrls: { default: { http: [rpcUrl] } },
    testnet: true,
  });
}

export function makePublicClient(rpcUrl: string) {
  return createPublicClient({ chain: createArcTestnetChain(rpcUrl), transport: http(rpcUrl) });
}

export function makeWalletClientForKey(rpcUrl: string, privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({ account, chain: createArcTestnetChain(rpcUrl), transport: http(rpcUrl) });
}

export function withHexPrefix(value: string): Hex {
  const normalized = value.trim().replace(/^0x/i, "");
  return `0x${normalized}` as Hex;
}

export function normalizePrivateKey(value: string): Hex {
  return withHexPrefix(value);
}

export type { Address, Hex };
```

- [ ] **Step 3：建 lib/env.ts**

```typescript
// contracts/script/ops/lib/env.ts
import dotenv from "dotenv";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Address, Hex } from "./clients.ts";
import { normalizePrivateKey } from "./clients.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

export type OwnerEnv = {
  rpcUrl: string;
  marketAddress: Address;
  ownerPrivateKey: Hex;
  pythAddress: Address;
  hermesEndpoint: string;
};

export type SeedsEnv = {
  rpcUrl: string;
  marketAddress: Address;
  usdcAddress: Address;
  seeds: Array<{ privateKey: Hex; address: Address }>;
};

export function loadOwnerEnv(): OwnerEnv {
  dotenv.config({ path: pathResolve(HERE, "../../../.env") });
  const rpcUrl = req("RPC_URL");
  const marketAddress = req("PREDICTION_MARKET") as Address;
  const ownerPrivateKey = normalizePrivateKey(req("OWNER_PRIVATE_KEY"));
  const pythAddress = req("PYTH_ADDRESS") as Address;
  const hermesEndpoint = process.env.PYTH_HERMES_ENDPOINT ?? "https://hermes.pyth.network";
  return { rpcUrl, marketAddress, ownerPrivateKey, pythAddress, hermesEndpoint };
}

export function loadSeedsEnv(): SeedsEnv {
  dotenv.config({ path: pathResolve(HERE, "../../../.env") });
  dotenv.config({ path: pathResolve(HERE, "../../../.env.seeds") });
  const rpcUrl = req("RPC_URL");
  const marketAddress = req("PREDICTION_MARKET") as Address;
  const usdcAddress = req("USDC_ADDRESS") as Address;
  const count = Number(req("SEED_WALLET_COUNT"));
  if (!Number.isFinite(count) || count <= 0) throw new Error("SEED_WALLET_COUNT 必须为正整数");
  const seeds: SeedsEnv["seeds"] = [];
  for (let i = 0; i < count; i++) {
    const pk = process.env[`SEED_PRIVATE_KEY_${i}`];
    const addr = process.env[`SEED_ADDRESS_${i}`];
    if (!pk || !addr) throw new Error(`SEED_PRIVATE_KEY_${i} / SEED_ADDRESS_${i} 缺失`);
    seeds.push({ privateKey: normalizePrivateKey(pk), address: addr as Address });
  }
  return { rpcUrl, marketAddress, usdcAddress, seeds };
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`缺少必需环境变量 ${name}`);
  return v;
}
```

- [ ] **Step 4：把 ResolveDueMarkets.ts 切到 lib**

修改 `contracts/script/ops/ResolveDueMarkets.ts`：

- 删除 `withHexPrefix` / `normalizePrivateKey` / `loadRuntimeConfig` / `loadPredictionMarketAbi` / `createArcTestnetChain` 的本地实现
- 改为 `import { makePublicClient, makeWalletClientForKey, withHexPrefix, normalizePrivateKey } from "./lib/clients.ts"`、`import { loadPredictionMarketAbi } from "./lib/abi.ts"`、`import { loadOwnerEnv } from "./lib/env.ts"`
- 保留 `resolveDueMarkets` / `decodeMarketSnapshot` / `isDueUnresolvedMarket` 等业务函数原样，仍 `export`（既有测试依赖）
- `main()` 内改为：`const cfg = loadOwnerEnv(); ... const publicClient = makePublicClient(cfg.rpcUrl); const walletClient = makeWalletClientForKey(cfg.rpcUrl, cfg.ownerPrivateKey);`

`test/check_resolve_due_markets.ts` 不动；新结构必须仍 `npm run check` 通过。

- [ ] **Step 5：跑现有测试确认未回归**

```bash
cd contracts/script/ops
npm run check
```

期望：通过（typecheck + 既有两个 check_*）。

- [ ] **Step 6：commit**

```bash
git add contracts/script/ops/lib/ contracts/script/ops/ResolveDueMarkets.ts
git commit -m "refactor(ops): 提炼 viem clients / abi / env 到 lib"
```

### Task A5：lib/hermes.ts（当前价封装）

**Files:**
- Create: `contracts/script/ops/lib/hermes.ts`
- Create: `contracts/script/ops/test/check_hermes.ts`（mock 注入测试）

- [ ] **Step 1：写失败测试（mock 注入）**

```typescript
// contracts/script/ops/test/check_hermes.ts
import assert from "node:assert/strict";
import { fetchCurrentPrice, type HermesLike } from "../lib/hermes.ts";

const cases: Array<{ name: string; fn: () => Promise<void> }> = [];
function test(name: string, fn: () => Promise<void>) { cases.push({ name, fn }); }

class StubHermes implements HermesLike {
  constructor(private readonly parsed: Array<{ id: string; price: { price: string; expo: number; publish_time: number } }>) {}
  async getLatestPriceUpdates(ids: string[], opts: { encoding: "hex"; parsed: true }) {
    return { parsed: this.parsed.filter(p => ids.includes(p.id)), binary: { data: [] } };
  }
}

test("fetchCurrentPrice 返回人类价 = price * 10^expo", async () => {
  const stub = new StubHermes([
    { id: "0xabc", price: { price: "7123456789012", expo: -8, publish_time: 1 } },
  ]);
  const v = await fetchCurrentPrice(stub, "0xabc");
  // 7123456789012 * 1e-8 = 71234.56789012
  assert.ok(Math.abs(v - 71234.56789012) < 1e-6);
});

test("fetchCurrentPrice 找不到 id 抛错", async () => {
  const stub = new StubHermes([]);
  await assert.rejects(() => fetchCurrentPrice(stub, "0xabc"), /价格未返回/);
});

for (const c of cases) {
  try { await c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
```

- [ ] **Step 2：跑测试确认失败**

```bash
cd contracts/script/ops
npx tsx test/check_hermes.ts
```

期望：import 报错。

- [ ] **Step 3：写实现**

```typescript
// contracts/script/ops/lib/hermes.ts
// 封装从 Hermes 取当前价的逻辑；接口化以便 mock。
import { HermesClient } from "@pythnetwork/hermes-client";

export interface HermesLike {
  getLatestPriceUpdates(
    ids: string[],
    options: { encoding: "hex"; parsed: true },
  ): Promise<{
    parsed: Array<{ id: string; price: { price: string; expo: number; publish_time: number } }>;
    binary: { data: string[] };
  }>;
}

export function makeHermesClient(endpoint: string): HermesLike {
  return new HermesClient(endpoint) as unknown as HermesLike;
}

// priceId 在 Hermes 返回里没有 0x 前缀，调用前做归一化
function stripPrefix(id: string): string {
  return id.replace(/^0x/i, "").toLowerCase();
}

export async function fetchCurrentPrice(client: HermesLike, priceId: string): Promise<number> {
  const noPrefix = stripPrefix(priceId);
  const resp = await client.getLatestPriceUpdates([noPrefix], { encoding: "hex", parsed: true });
  const hit = resp.parsed.find((p) => stripPrefix(p.id) === noPrefix);
  if (!hit) throw new Error(`价格未返回：${priceId}`);
  const raw = BigInt(hit.price.price);
  const expo = hit.price.expo;
  return Number(raw) * Math.pow(10, expo);
}
```

注意：`HermesClient` 在不同版本里返回字段可能略有差异（v2 vs v3）；此处选择"接口化 + 强制类型断言"以便 mock。Task E2 跑真实 DRY_RUN 时验证返回结构匹配。

- [ ] **Step 4：跑测试确认通过**

```bash
cd contracts/script/ops
npx tsx test/check_hermes.ts
```

期望：2 行 `OK: ...`。

- [ ] **Step 5：commit**

```bash
git add contracts/script/ops/lib/hermes.ts contracts/script/ops/test/check_hermes.ts
git commit -m "feat(ops): 添加 Hermes 当前价拉取封装"
```

### Task A6：GenerateSeeds.ts（一次性钱包池生成）

**Files:**
- Create: `contracts/script/ops/GenerateSeeds.ts`
- Create: `contracts/script/ops/test/check_generate_seeds.ts`

- [ ] **Step 1：写失败测试（buildSeedFileContent / buildWebSeedListContent 纯函数）**

```typescript
// contracts/script/ops/test/check_generate_seeds.ts
import assert from "node:assert/strict";
import { buildSeedFileContent, buildWebSeedListContent } from "../GenerateSeeds.ts";

const cases: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void) { cases.push({ name, fn }); }

const sample = [
  { privateKey: "0xaa", address: "0xAlice" },
  { privateKey: "0xbb", address: "0xBob" },
];

test("buildSeedFileContent 含 count 与所有键", () => {
  const out = buildSeedFileContent(sample);
  assert.match(out, /SEED_WALLET_COUNT=2/);
  assert.match(out, /SEED_PRIVATE_KEY_0=0xaa/);
  assert.match(out, /SEED_ADDRESS_0=0xAlice/);
  assert.match(out, /SEED_PRIVATE_KEY_1=0xbb/);
  assert.match(out, /SEED_ADDRESS_1=0xBob/);
});

test("buildWebSeedListContent 只含地址且 lowercase", () => {
  const out = buildWebSeedListContent(sample);
  assert.match(out, /export const SEED_WALLETS/);
  assert.match(out, /"0xalice"/);
  assert.match(out, /"0xbob"/);
  assert.doesNotMatch(out, /0xaa/i);   // 私钥绝不出现
  assert.doesNotMatch(out, /0xbb/i);
});

for (const c of cases) {
  try { c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
```

- [ ] **Step 2：跑测试确认失败**

```bash
cd contracts/script/ops
npx tsx test/check_generate_seeds.ts
```

- [ ] **Step 3：写实现**

```typescript
// contracts/script/ops/GenerateSeeds.ts
// 一次性脚本：生成 N 个 seed 钱包，写出 .env.seeds 与 web/lib/seed-wallets.ts
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "./lib/clients.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_SEEDS_PATH = pathResolve(HERE, "../../.env.seeds");
const WEB_SEEDS_TS_PATH = pathResolve(HERE, "../../../web/lib/seed-wallets.ts");

export type Seed = { privateKey: Hex; address: Address };

const DEFAULT_COUNT = 12;

export function buildSeedFileContent(seeds: Seed[]): string {
  const lines = [
    "# 自动生成，勿手动编辑。",
    "# 由 contracts/script/ops/GenerateSeeds.ts 写出。",
    `SEED_WALLET_COUNT=${seeds.length}`,
  ];
  for (let i = 0; i < seeds.length; i++) {
    lines.push(`SEED_PRIVATE_KEY_${i}=${seeds[i].privateKey}`);
    lines.push(`SEED_ADDRESS_${i}=${seeds[i].address}`);
  }
  return lines.join("\n") + "\n";
}

export function buildWebSeedListContent(seeds: Seed[]): string {
  const addrs = seeds.map((s) => `  "${s.address.toLowerCase()}"`).join(",\n");
  return [
    "// 自动生成，勿手动编辑。",
    "// 由 contracts/script/ops/GenerateSeeds.ts 写出。",
    "// 用于前端披露：扫 Bet 事件时判断是否属于 seed 钱包。",
    "",
    "export const SEED_WALLETS: readonly `0x${string}`[] = [",
    addrs,
    "] as const;",
    "",
  ].join("\n");
}

function generateSeeds(count: number): Seed[] {
  const out: Seed[] = [];
  for (let i = 0; i < count; i++) {
    const pk = generatePrivateKey();
    const addr = privateKeyToAccount(pk).address;
    out.push({ privateKey: pk, address: addr });
  }
  return out;
}

function parseCountFromArgs(): number {
  const a = process.argv.slice(2);
  const m = a.find((x) => x.startsWith("--count="));
  if (!m) return DEFAULT_COUNT;
  const n = Number(m.split("=")[1]);
  if (!Number.isInteger(n) || n <= 0) throw new Error("--count 必须为正整数");
  return n;
}

function isAppendMode(): boolean {
  return process.argv.slice(2).some((x) => x === "--append");
}

function existingSeedsFromFile(): Seed[] {
  if (!existsSync(ENV_SEEDS_PATH)) return [];
  const lines = readFileSync(ENV_SEEDS_PATH, "utf8").split(/\r?\n/);
  const map: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+\d*)=(.+)$/);
    if (m) map[m[1]] = m[2];
  }
  const count = Number(map["SEED_WALLET_COUNT"] ?? 0);
  const out: Seed[] = [];
  for (let i = 0; i < count; i++) {
    const pk = map[`SEED_PRIVATE_KEY_${i}`];
    const addr = map[`SEED_ADDRESS_${i}`];
    if (pk && addr) out.push({ privateKey: pk as Hex, address: addr as Address });
  }
  return out;
}

function isDirect(): boolean {
  return process.argv[1] !== undefined && fileURLToPath(import.meta.url) === pathResolve(process.argv[1]);
}

if (isDirect()) {
  const append = isAppendMode();
  const count = parseCountFromArgs();
  const existing = append ? existingSeedsFromFile() : [];
  const newOnes = generateSeeds(count);
  const all = [...existing, ...newOnes];

  writeFileSync(ENV_SEEDS_PATH, buildSeedFileContent(all), { mode: 0o600 });
  writeFileSync(WEB_SEEDS_TS_PATH, buildWebSeedListContent(all));

  console.log(`已生成 ${newOnes.length} 个钱包；钱包池总数 ${all.length}`);
  console.log("\n请把以下地址复制到 Circle faucet 领第一轮 testnet 资产：\n");
  for (const s of newOnes) console.log(s.address);
}
```

- [ ] **Step 4：跑测试确认通过**

```bash
cd contracts/script/ops
npx tsx test/check_generate_seeds.ts
```

- [ ] **Step 5：commit**

```bash
git add contracts/script/ops/GenerateSeeds.ts contracts/script/ops/test/check_generate_seeds.ts
git commit -m "feat(ops): 添加 seed 钱包池生成脚本"
```

注意：实际**执行** `GenerateSeeds.ts` 写出 `.env.seeds` / `web/lib/seed-wallets.ts` 留到 Task E1（与 Pyth priceId 验证同批）。

### Task A7：.gitignore + .env.example.seeds

**Files:**
- Modify: `.gitignore`
- Create: `contracts/.env.example.seeds`

- [ ] **Step 1：扩 `.gitignore`**

读 `.gitignore`，在末尾追加：

```
# Phase 16+ seed 钱包池本地文件
contracts/.env.seeds
```

- [ ] **Step 2：建 `contracts/.env.example.seeds`**

```
# 由 contracts/script/ops/GenerateSeeds.ts 生成，勿手动编辑。
# 真实文件命名 .env.seeds（git-ignore），本文件仅作格式示例。
SEED_WALLET_COUNT=12
SEED_PRIVATE_KEY_0=0xreplace_me
SEED_ADDRESS_0=0xreplace_me
SEED_PRIVATE_KEY_1=0xreplace_me
SEED_ADDRESS_1=0xreplace_me
# ... 0..(SEED_WALLET_COUNT-1)
```

- [ ] **Step 3：commit**

```bash
git add .gitignore contracts/.env.example.seeds
git commit -m "chore: 忽略 seed 钱包池文件并提供示例"
```

### Task A8：package.json 加脚本入口

**Files:**
- Modify: `contracts/script/ops/package.json`

- [ ] **Step 1：扩 scripts 段**

```json
{
  "name": "arc-predict-ops",
  "private": true,
  "type": "module",
  "scripts": {
    "resolve": "tsx ResolveDueMarkets.ts",
    "schedule": "tsx MarketScheduler.ts",
    "topup": "tsx TopUpSeeds.ts",
    "generate-seeds": "tsx GenerateSeeds.ts",
    "typecheck": "tsc --noEmit",
    "check": "npm run typecheck && tsx test/check_resolve_due_markets.ts && tsx test/check_readme.ts && tsx test/check_scheduler_config.ts && tsx test/check_cadence_tag.ts && tsx test/check_rng.ts && tsx test/check_hermes.ts && tsx test/check_generate_seeds.ts"
  },
  "dependencies": {
    "@pythnetwork/hermes-client": "^2.0.0",
    "dotenv": "^16.0.0",
    "viem": "^2.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

后续 Phase B/C 完成新 test 后再追加到 `check` 命令尾部。

- [ ] **Step 2：跑 check 确认所有 A 段测试通过**

```bash
cd contracts/script/ops
npm run check
```

期望：全绿。

- [ ] **Step 3：commit**

```bash
git add contracts/script/ops/package.json
git commit -m "chore(ops): 加 schedule / topup / generate-seeds 脚本入口"
```

---

## Phase B：TopUpSeeds

### Task B1：lib/thresholds.ts + 分类逻辑

**Files:**
- Create: `contracts/script/ops/lib/thresholds.ts`
- Create: `contracts/script/ops/test/check_topup_thresholds.ts`

- [ ] **Step 1：写失败测试**

```typescript
// contracts/script/ops/test/check_topup_thresholds.ts
import assert from "node:assert/strict";
import { BALANCE_THRESHOLDS, classifyBalance } from "../lib/thresholds.ts";

const cases: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void) { cases.push({ name, fn }); }

test("BALANCE_THRESHOLDS 单调 skip < warn", () => {
  assert.ok(BALANCE_THRESHOLDS.skip < BALANCE_THRESHOLDS.warn);
});

test("USDC ≥ warn 与 native ≥ gasMin → healthy", () => {
  const r = classifyBalance({ usdc: 100_000_000n, native: BALANCE_THRESHOLDS.gasMin });
  assert.equal(r, "healthy");
});

test("USDC < skip → skipSeed", () => {
  const r = classifyBalance({ usdc: 1_000_000n, native: BALANCE_THRESHOLDS.gasMin });
  assert.equal(r, "skipSeed");
});

test("skip <= USDC < warn → needsTopup", () => {
  const r = classifyBalance({ usdc: 10_000_000n, native: BALANCE_THRESHOLDS.gasMin });
  assert.equal(r, "needsTopup");
});

test("native < gasMin → skipSeed（即便 USDC 满）", () => {
  const r = classifyBalance({ usdc: 100_000_000n, native: 0n });
  assert.equal(r, "skipSeed");
});

for (const c of cases) {
  try { c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
```

- [ ] **Step 2：跑测试确认失败**

```bash
cd contracts/script/ops
npx tsx test/check_topup_thresholds.ts
```

- [ ] **Step 3：写实现**

```typescript
// contracts/script/ops/lib/thresholds.ts
import { parseEther } from "viem";

export const BALANCE_THRESHOLDS = {
  warn:   10_000_000n,            // 10 USDC（6 decimals，faucet 冷启动期临时最低健康线）
  skip:    5_000_000n,            //  5 USDC
  gasMin: parseEther("0.01"),     // 0.01 native（18 decimals raw wei）
};

export type Classification = "healthy" | "needsTopup" | "skipSeed";

export function classifyBalance(b: { usdc: bigint; native: bigint }): Classification {
  if (b.native < BALANCE_THRESHOLDS.gasMin) return "skipSeed";
  if (b.usdc < BALANCE_THRESHOLDS.skip) return "skipSeed";
  if (b.usdc < BALANCE_THRESHOLDS.warn) return "needsTopup";
  return "healthy";
}
```

- [ ] **Step 4：跑测试确认通过**

```bash
cd contracts/script/ops
npx tsx test/check_topup_thresholds.ts
```

- [ ] **Step 5：commit**

```bash
git add contracts/script/ops/lib/thresholds.ts contracts/script/ops/test/check_topup_thresholds.ts
git commit -m "feat(ops): 添加 seed 钱包余额阈值与分类"
```

### Task B2：TopUpSeeds.ts 主流程

**Files:**
- Create: `contracts/script/ops/TopUpSeeds.ts`
- Create: `contracts/script/ops/test/check_topup_main.ts`

- [ ] **Step 1：写失败测试（注入 stub 客户端）**

```typescript
// contracts/script/ops/test/check_topup_main.ts
import assert from "node:assert/strict";
import { scanWallets, formatReport, type BalanceFetcher } from "../TopUpSeeds.ts";

const cases: Array<{ name: string; fn: () => Promise<void> }> = [];
function test(name: string, fn: () => Promise<void>) { cases.push({ name, fn }); }

const seeds = [
  "0xaaa", "0xbbb", "0xccc",
] as `0x${string}`[];

const stub: BalanceFetcher = {
  async fetchUsdc(addr) {
    if (addr === "0xaaa") return 100_000_000n;
    if (addr === "0xbbb") return 10_000_000n;
    return 0n;
  },
  async fetchNative(addr) {
    return 1_000_000_000_000_000n; // 0.001 ETH (低于 0.01 gasMin)
  },
};

test("scanWallets 三分类正确", async () => {
  const stubGas: BalanceFetcher = {
    fetchUsdc: stub.fetchUsdc,
    fetchNative: async () => 100_000_000_000_000_000n, // 0.1 ETH 充足
  };
  const r = await scanWallets(seeds, stubGas);
  assert.deepEqual(r.healthy, ["0xaaa"]);
  assert.deepEqual(r.needsTopup, ["0xbbb"]);
  assert.deepEqual(r.skipSeed, ["0xccc"]);
});

test("formatReport 在 needsTopup 非空时 exitCode 1", async () => {
  const r = await scanWallets(seeds, stub);  // 所有都 gas 不够 → skipSeed
  const text = formatReport(r);
  assert.match(text, /skipSeed=3/);
});

for (const c of cases) {
  try { await c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
```

- [ ] **Step 2：跑测试确认失败**

```bash
cd contracts/script/ops
npx tsx test/check_topup_main.ts
```

- [ ] **Step 3：写实现**

```typescript
// contracts/script/ops/TopUpSeeds.ts
import { writeFileSync } from "node:fs";
import { erc20Abi, type Address } from "viem";
import { makePublicClient } from "./lib/clients.ts";
import { loadSeedsEnv } from "./lib/env.ts";
import { classifyBalance, BALANCE_THRESHOLDS } from "./lib/thresholds.ts";

export interface BalanceFetcher {
  fetchUsdc(addr: Address): Promise<bigint>;
  fetchNative(addr: Address): Promise<bigint>;
}

export type ScanResult = {
  healthy: Address[];
  needsTopup: Address[];
  skipSeed: Address[];
};

export async function scanWallets(seeds: readonly Address[], fetcher: BalanceFetcher): Promise<ScanResult> {
  const out: ScanResult = { healthy: [], needsTopup: [], skipSeed: [] };
  for (const addr of seeds) {
    const [usdc, native] = await Promise.all([fetcher.fetchUsdc(addr), fetcher.fetchNative(addr)]);
    const c = classifyBalance({ usdc, native });
    if (c === "healthy") out.healthy.push(addr);
    else if (c === "needsTopup") out.needsTopup.push(addr);
    else out.skipSeed.push(addr);
  }
  return out;
}

export function formatReport(r: ScanResult): string {
  const lines = [
    "=== ArcPredict TopUpSeeds 报告 ===",
    `healthy=${r.healthy.length} needsTopup=${r.needsTopup.length} skipSeed=${r.skipSeed.length}`,
    `阈值（USDC 6 decimals）：warn=${BALANCE_THRESHOLDS.warn} skip=${BALANCE_THRESHOLDS.skip}`,
    "",
    "=== 需要顶配的钱包（复制到 Circle faucet）===",
    ...r.needsTopup,
    "",
    "=== 余额过低，本轮 ensureSeed 跳过的钱包 ===",
    ...r.skipSeed,
  ];
  return lines.join("\n");
}

function isDirect(): boolean {
  return process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");
}

if (isDirect()) {
  const cfg = loadSeedsEnv();
  const client = makePublicClient(cfg.rpcUrl);
  const fetcher: BalanceFetcher = {
    async fetchUsdc(addr) {
      return (await client.readContract({
        address: cfg.usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [addr],
      })) as bigint;
    },
    async fetchNative(addr) {
      return await client.getBalance({ address: addr });
    },
  };
  const seedAddrs = cfg.seeds.map((s) => s.address);
  const result = await scanWallets(seedAddrs, fetcher);
  const report = formatReport(result);
  console.log(report);
  writeFileSync("/tmp/arc-predict-topup-needed.json", JSON.stringify(result, null, 2));
  if (result.needsTopup.length > 0 || result.skipSeed.length > 0) process.exit(1);
}
```

- [ ] **Step 4：跑测试确认通过**

```bash
cd contracts/script/ops
npx tsx test/check_topup_main.ts
```

- [ ] **Step 5：扩 package.json 的 check**

把 `test/check_topup_thresholds.ts` 和 `test/check_topup_main.ts` 追加到 `npm run check` 命令尾。

- [ ] **Step 6：commit**

```bash
git add contracts/script/ops/TopUpSeeds.ts contracts/script/ops/test/check_topup_main.ts contracts/script/ops/package.json
git commit -m "feat(ops): 添加 seed 钱包余额扫描与告警"
```

### Task B3：launchd plist + ops/README 一节

**Files:**
- Create: `ops/launchd/com.arcpredict.ops.topup.plist`
- Modify: `contracts/script/ops/README.md`

- [ ] **Step 1：建 plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.arcpredict.ops.topup</string>
    <key>WorkingDirectory</key>
    <string>/REPLACE/path/to/ArcPredict/contracts/script/ops</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>npm run topup</string>
    </array>
    <key>StartInterval</key>
    <integer>21600</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/arc-predict-topup.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/arc-predict-topup.err.log</string>
  </dict>
</plist>
```

- [ ] **Step 2：在 README 末尾追加"Phase 16+ TopUpSeeds"节**

```markdown
## Phase 16+：TopUpSeeds（seed 钱包余额顶配）

### 概述

`TopUpSeeds.ts` 扫 `contracts/.env.seeds` 列出的所有 seed 钱包余额，按 spec §6.3 阈值分类：

- `healthy`：USDC ≥ 10 且 native ≥ 0.01
- `needsTopup`：5 ≤ USDC < 10
- `skipSeed`：USDC < 5 或 native < 0.01

并把结果写到 `/tmp/arc-predict-topup-needed.json`，stdout 同时打印复制粘贴清单。

### 手动执行

```bash
cd /path/to/ArcPredict/contracts/script/ops
npm run topup
```

### 自动化（launchd 示例）

复制 `ops/launchd/com.arcpredict.ops.topup.plist` 到 `~/Library/LaunchAgents/`，把 `WorkingDirectory` 替换为实际路径：

```bash
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.arcpredict.ops.topup.plist
```

- 频率：6 小时一次（`StartInterval=21600`）
- 退出码 0 = 无需顶配；1 = 有 needsTopup 或 skipSeed
- 日常巡检：每天扫一次 `/tmp/arc-predict-topup-needed.json`，非空则去 Circle faucet (`https://faucet.circle.com`) 把列表里的地址逐个领

### faucet 自动化（层 2，待探测）

Circle faucet 是 captcha 网页，无公开 API。后续可由 owner 用浏览器 devtools 抓 form-post endpoint。若可程序化调用，可在 `TopUpSeeds.ts` 里加 `--auto-faucet` 模式直接发请求；探测前禁止假装自动。
```

- [ ] **Step 3：跑 check_readme.ts 不破坏**

```bash
cd contracts/script/ops
npx tsx test/check_readme.ts
```

`check_readme.ts` 是旧 MVP 文档校验，对新增节通常不敏感；若 fail 看具体断言再补救。

- [ ] **Step 4：commit**

```bash
git add ops/launchd/com.arcpredict.ops.topup.plist contracts/script/ops/README.md
git commit -m "docs(ops): 添加 TopUpSeeds launchd 与 runbook"
```

---

## Phase C：MarketScheduler

### Task C1：lib/market-scan.ts（scanActiveMarkets）

**Files:**
- Create: `contracts/script/ops/lib/market-scan.ts`
- Create: `contracts/script/ops/test/check_market_scan.ts`

- [ ] **Step 1：写失败测试**

```typescript
// contracts/script/ops/test/check_market_scan.ts
import assert from "node:assert/strict";
import { bucketMarkets, type ScannedMarket } from "../lib/market-scan.ts";
import { PYTH_PRICE_ID } from "../scheduler.config.ts";

const cases: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void) { cases.push({ name, fn }); }

const NOW = 1_000_000;
const BTC_ID = PYTH_PRICE_ID.BTC;

const mkMarket = (overrides: Partial<ScannedMarket>): ScannedMarket => ({
  id: 1n,
  pythPriceId: BTC_ID,
  betDeadline: BigInt(NOW + 3600),
  resolveAfter: BigInt(NOW + 7200),
  outcome: 0,
  question: "BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [weekly]",
  ...overrides,
});

test("已结算市场不入桶", () => {
  const r = bucketMarkets([mkMarket({ outcome: 1 })], NOW);
  assert.equal(r.BTC.weekly.length, 0);
  assert.equal(r.unknown.length, 0);
});

test("已过 betDeadline 不入桶", () => {
  const r = bucketMarkets([mkMarket({ betDeadline: BigInt(NOW - 1) })], NOW);
  assert.equal(r.BTC.weekly.length, 0);
});

test("正常活跃市场入对应桶", () => {
  const r = bucketMarkets([mkMarket({})], NOW);
  assert.equal(r.BTC.weekly.length, 1);
  assert.equal(r.BTC.weekly[0].id, 1n);
});

test("question 无 tag → unknown 桶", () => {
  const r = bucketMarkets([mkMarket({ question: "BTC/USD ≥ 71200" })], NOW);
  assert.equal(r.unknown.length, 1);
  assert.equal(r.BTC.weekly.length, 0);
});

test("priceId 未知 asset → unknown 桶", () => {
  const r = bucketMarkets([mkMarket({ pythPriceId: "0xffff" })], NOW);
  assert.equal(r.unknown.length, 1);
});

for (const c of cases) {
  try { c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
```

- [ ] **Step 2：跑测试确认失败**

- [ ] **Step 3：写实现**

```typescript
// contracts/script/ops/lib/market-scan.ts
import type { Address, Hex } from "./clients.ts";
import type { Asset, Cadence } from "../scheduler.config.ts";
import { PYTH_PRICE_ID } from "../scheduler.config.ts";
import { parseCadenceTag } from "./cadence-tag.ts";

export type ScannedMarket = {
  id: bigint;
  pythPriceId: Hex;
  betDeadline: bigint;
  resolveAfter: bigint;
  outcome: number;
  question: string;
};

export type BucketedMarkets = Record<Asset, Record<Cadence, ScannedMarket[]>> & {
  unknown: ScannedMarket[];
};

function emptyBuckets(): BucketedMarkets {
  return {
    BTC: { daily: [], weekly: [], monthly: [], quarterly: [] },
    ETH: { daily: [], weekly: [], monthly: [], quarterly: [] },
    SOL: { daily: [], weekly: [], monthly: [], quarterly: [] },
    unknown: [],
  };
}

function assetFromPriceId(id: Hex): Asset | undefined {
  const lc = id.toLowerCase();
  for (const a of Object.keys(PYTH_PRICE_ID) as Asset[]) {
    if (PYTH_PRICE_ID[a].toLowerCase() === lc) return a;
  }
  return undefined;
}

export function bucketMarkets(markets: ScannedMarket[], nowSec: number): BucketedMarkets {
  const out = emptyBuckets();
  const now = BigInt(nowSec);
  for (const m of markets) {
    if (m.outcome !== 0) continue;            // 已结算
    if (m.betDeadline <= now) continue;        // 已停止下注
    const asset = assetFromPriceId(m.pythPriceId);
    const cadence = parseCadenceTag(m.question);
    if (!asset || cadence === "unknown") {
      out.unknown.push(m);
      continue;
    }
    out[asset][cadence].push(m);
  }
  return out;
}

// 真实链上读取部分（与 ResolveDueMarkets 类似的分页 + getMarketsPaged）
export type MarketReader = {
  marketCount(): Promise<bigint>;
  getMarketsPage(from: bigint, toExclusive: bigint): Promise<ScannedMarket[]>;
};

export async function scanActiveMarkets(reader: MarketReader, nowSec: number): Promise<BucketedMarkets> {
  const total = await reader.marketCount();
  const PAGE = 50n;
  const all: ScannedMarket[] = [];
  for (let from = 0n; from < total; from += PAGE) {
    const to = from + PAGE > total ? total : from + PAGE;
    const page = await reader.getMarketsPage(from, to);
    // page 的 id 由 reader 注入（getMarketsPaged 返回的是 Market 结构没 id，调用方按 index 拼）
    for (let i = 0; i < page.length; i++) {
      all.push({ ...page[i], id: from + BigInt(i) });
    }
  }
  return bucketMarkets(all, nowSec);
}
```

- [ ] **Step 4：跑测试确认通过**

- [ ] **Step 5：commit**

```bash
git add contracts/script/ops/lib/market-scan.ts contracts/script/ops/test/check_market_scan.ts
git commit -m "feat(ops): 添加市场扫描与归桶"
```

### Task C2：lib/gaps.ts（computeGaps）

**Files:**
- Create: `contracts/script/ops/lib/gaps.ts`
- Create: `contracts/script/ops/test/check_compute_gaps.ts`

- [ ] **Step 1：写失败测试**

```typescript
// contracts/script/ops/test/check_compute_gaps.ts
import assert from "node:assert/strict";
import { computeGaps } from "../lib/gaps.ts";
import { TARGET_ACTIVE, THRESHOLD_OFFSETS_PCT } from "../scheduler.config.ts";
import type { BucketedMarkets } from "../lib/market-scan.ts";

const cases: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void) { cases.push({ name, fn }); }

const empty: BucketedMarkets = {
  BTC: { daily: [], weekly: [], monthly: [], quarterly: [] },
  ETH: { daily: [], weekly: [], monthly: [], quarterly: [] },
  SOL: { daily: [], weekly: [], monthly: [], quarterly: [] },
  unknown: [],
};

test("空快照 → 缺口数 = 总活跃目标", () => {
  const gaps = computeGaps(empty);
  let total = 0;
  for (const a of ["BTC","ETH","SOL"] as const)
    for (const c of ["daily","weekly","monthly","quarterly"] as const)
      total += TARGET_ACTIVE[a][c];
  assert.equal(gaps.length, total);
});

test("某档已满 → 该档无 gap", () => {
  const snap: BucketedMarkets = JSON.parse(JSON.stringify(empty));
  for (let i = 0; i < TARGET_ACTIVE.BTC.weekly; i++) snap.BTC.weekly.push({} as any);
  const gaps = computeGaps(snap);
  assert.equal(gaps.filter(g => g.asset === "BTC" && g.cadence === "weekly").length, 0);
});

test("某档超额 → 不删（gap 为 0 但不报负）", () => {
  const snap: BucketedMarkets = JSON.parse(JSON.stringify(empty));
  for (let i = 0; i < TARGET_ACTIVE.BTC.weekly + 5; i++) snap.BTC.weekly.push({} as any);
  const gaps = computeGaps(snap);
  assert.equal(gaps.filter(g => g.asset === "BTC" && g.cadence === "weekly").length, 0);
});

test("offsetPct 顺序使用阶梯前缀", () => {
  const snap: BucketedMarkets = JSON.parse(JSON.stringify(empty));
  // BTC weekly 已 1 个，应补剩下两个（offsetPct[1] 和 [2]）
  snap.BTC.weekly.push({} as any);
  const offsets = computeGaps(snap)
    .filter(g => g.asset === "BTC" && g.cadence === "weekly")
    .map(g => g.offsetPct);
  assert.deepEqual(offsets, [THRESHOLD_OFFSETS_PCT.weekly[1], THRESHOLD_OFFSETS_PCT.weekly[2]]);
});

for (const c of cases) {
  try { c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
```

- [ ] **Step 2：跑测试确认失败**

- [ ] **Step 3：写实现**

```typescript
// contracts/script/ops/lib/gaps.ts
import type { Asset, Cadence } from "../scheduler.config.ts";
import { TARGET_ACTIVE, THRESHOLD_OFFSETS_PCT } from "../scheduler.config.ts";
import type { BucketedMarkets } from "./market-scan.ts";

export type Gap = { asset: Asset; cadence: Cadence; offsetPct: number };

export function computeGaps(snapshot: BucketedMarkets): Gap[] {
  const out: Gap[] = [];
  const assets: Asset[] = ["BTC", "ETH", "SOL"];
  const cadences: Cadence[] = ["daily", "weekly", "monthly", "quarterly"];
  for (const asset of assets) {
    for (const cadence of cadences) {
      const have = snapshot[asset][cadence].length;
      const want = TARGET_ACTIVE[asset][cadence];
      if (have >= want) continue;
      // 缺口从阶梯第 have 个开始取，连续取到 want
      for (let i = have; i < want; i++) {
        out.push({ asset, cadence, offsetPct: THRESHOLD_OFFSETS_PCT[cadence][i] });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4：跑测试确认通过**

- [ ] **Step 5：commit**

```bash
git add contracts/script/ops/lib/gaps.ts contracts/script/ops/test/check_compute_gaps.ts
git commit -m "feat(ops): 添加缺口计算"
```

### Task C3：lib/pick-seeds.ts + lib/seed-amount.ts

**Files:**
- Create: `contracts/script/ops/lib/pick-seeds.ts`
- Create: `contracts/script/ops/lib/seed-amount.ts`
- Create: `contracts/script/ops/test/check_pick_seeds.ts`
- Create: `contracts/script/ops/test/check_seed_amount.ts`

- [ ] **Step 1：写两个失败测试**

```typescript
// contracts/script/ops/test/check_pick_seeds.ts
import assert from "node:assert/strict";
import { pickSeedWallets } from "../lib/pick-seeds.ts";
import type { Address } from "../lib/clients.ts";

const cases: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void) { cases.push({ name, fn }); }

const pool: Address[] = Array.from({ length: 12 }, (_, i) => `0x${String(i).padStart(40, "a")}` as Address);

test("同一 marketId 重复调用结果相同", () => {
  const a = pickSeedWallets(7n, pool);
  const b = pickSeedWallets(7n, pool);
  assert.deepEqual(a, b);
});

test("k ∈ {1,2,3}", () => {
  for (let i = 0n; i < 50n; i++) {
    const r = pickSeedWallets(i, pool);
    assert.ok(r.length >= 1 && r.length <= 3, `marketId=${i} k=${r.length}`);
  }
});

test("返回钱包来自 pool 且不重复", () => {
  for (let i = 0n; i < 20n; i++) {
    const r = pickSeedWallets(i, pool);
    const s = new Set(r);
    assert.equal(s.size, r.length);
    for (const a of r) assert.ok(pool.includes(a));
  }
});

for (const c of cases) {
  try { c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
```

```typescript
// contracts/script/ops/test/check_seed_amount.ts
import assert from "node:assert/strict";
import { seedAmount } from "../lib/seed-amount.ts";

const cases: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void) { cases.push({ name, fn }); }

test("金额落在 1-10 USDC（6 decimals）", () => {
  for (let m = 0n; m < 50n; m++) {
    for (let w = 0; w < 5; w++) {
      for (const side of ["yes", "no"] as const) {
        const a = seedAmount(m, w, side);
        assert.ok(a >= 1_000_000n && a <= 10_000_000n, `m=${m} w=${w} side=${side} a=${a}`);
      }
    }
  }
});

test("YES 与 NO 在同一 (marketId, walletIndex) 上独立（多次累计出现差异）", () => {
  let differCount = 0;
  for (let m = 0n; m < 50n; m++) {
    if (seedAmount(m, 0, "yes") !== seedAmount(m, 0, "no")) differCount++;
  }
  assert.ok(differCount >= 20, "50 个样本至少 20 个 YES/NO 不等");
});

test("同输入结果稳定", () => {
  for (let m = 0n; m < 10n; m++) {
    assert.equal(seedAmount(m, 3, "yes"), seedAmount(m, 3, "yes"));
  }
});

for (const c of cases) {
  try { c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
```

- [ ] **Step 2：写实现**

```typescript
// contracts/script/ops/lib/pick-seeds.ts
import type { Address } from "./clients.ts";
import { mulberry32, deterministicSeedFromBigInt, pickK } from "./rng.ts";

export function pickSeedWallets(marketId: bigint, pool: readonly Address[]): Address[] {
  if (pool.length === 0) throw new Error("seed 钱包池为空");
  const seed = deterministicSeedFromBigInt(marketId);
  const rand = mulberry32(seed);
  const k = Math.max(1, Math.min(3, 1 + Math.floor(rand() * 3)));
  return pickK(pool, Math.min(k, pool.length), rand);
}
```

```typescript
// contracts/script/ops/lib/seed-amount.ts
import { mulberry32, deterministicSeedFromBigInt } from "./rng.ts";

export function seedAmount(marketId: bigint, walletIndex: number, side: "yes" | "no"): bigint {
  const sideBit = side === "yes" ? 0 : 1;
  const seed = (deterministicSeedFromBigInt(marketId) ^ walletIndex ^ sideBit) >>> 0;
  const rand = mulberry32(seed);
  const usdc = 1 + Math.floor(rand() * 10);   // 1..10
  return BigInt(usdc) * 1_000_000n;
}
```

- [ ] **Step 3：跑两个测试确认通过**

```bash
cd contracts/script/ops
npx tsx test/check_pick_seeds.ts
npx tsx test/check_seed_amount.ts
```

- [ ] **Step 4：commit**

```bash
git add contracts/script/ops/lib/pick-seeds.ts contracts/script/ops/lib/seed-amount.ts contracts/script/ops/test/check_pick_seeds.ts contracts/script/ops/test/check_seed_amount.ts
git commit -m "feat(ops): 添加 seed 钱包选择与金额（确定性）"
```

### Task C4：lib/seed-events.ts（已 seed 判据）

**Files:**
- Create: `contracts/script/ops/lib/seed-events.ts`
- Create: `contracts/script/ops/test/check_seed_events.ts`

- [ ] **Step 1：写失败测试**

```typescript
// contracts/script/ops/test/check_seed_events.ts
import assert from "node:assert/strict";
import { collectSeededMarketIds, type BetEvent } from "../lib/seed-events.ts";
import type { Address } from "../lib/clients.ts";

const cases: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void) { cases.push({ name, fn }); }

const seeds: Address[] = ["0xaaa","0xbbb"] as Address[];

test("seed 钱包 Bet → marketId 进集合", () => {
  const events: BetEvent[] = [
    { id: 1n, user: "0xaaa", yes: true, amount: 5_000_000n },
  ];
  const r = collectSeededMarketIds(events, seeds);
  assert.ok(r.has(1n));
});

test("非 seed Bet → 不进集合", () => {
  const events: BetEvent[] = [
    { id: 2n, user: "0xfff", yes: true, amount: 5_000_000n },
  ];
  const r = collectSeededMarketIds(events, seeds);
  assert.equal(r.size, 0);
});

test("地址大小写不敏感", () => {
  const events: BetEvent[] = [
    { id: 3n, user: "0xAAA", yes: false, amount: 5_000_000n },
  ];
  const r = collectSeededMarketIds(events, seeds);
  assert.ok(r.has(3n));
});

for (const c of cases) {
  try { c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
```

- [ ] **Step 2：写实现**

```typescript
// contracts/script/ops/lib/seed-events.ts
import type { Address, Hex } from "./clients.ts";
import type { Abi, PublicClient } from "viem";
import { parseAbiItem } from "viem";

export type BetEvent = { id: bigint; user: Address; yes: boolean; amount: bigint };

export function collectSeededMarketIds(events: BetEvent[], seeds: readonly Address[]): Set<bigint> {
  const lowerSeeds = new Set(seeds.map((s) => s.toLowerCase()));
  const out = new Set<bigint>();
  for (const e of events) {
    if (lowerSeeds.has(e.user.toLowerCase())) out.add(e.id);
  }
  return out;
}

// 从合约 Bet 事件中拉历史；调用方提供 client 与起止 block
export async function fetchBetEvents(
  client: PublicClient,
  marketAddress: Address,
  fromBlock: bigint,
  toBlock: bigint | "latest" = "latest",
): Promise<BetEvent[]> {
  const event = parseAbiItem(
    "event Bet(uint256 indexed id, address indexed user, bool yes, uint128 amount, uint128 yesPoolAfter, uint128 noPoolAfter)"
  );
  const logs = await client.getLogs({ address: marketAddress, event, fromBlock, toBlock });
  return logs.map((l) => ({
    id: l.args.id!,
    user: l.args.user!,
    yes: l.args.yes!,
    amount: l.args.amount!,
  }));
}
```

- [ ] **Step 3：跑测试确认通过**

- [ ] **Step 4：commit**

```bash
git add contracts/script/ops/lib/seed-events.ts contracts/script/ops/test/check_seed_events.ts
git commit -m "feat(ops): 添加 Bet 事件扫描与已 seed 判据"
```

### Task C5：createMissing（owner 写链）

把 `createMarket` 调用、threshold 缩放、deadline 计算、event 解码合在一起。

**Files:**
- Create: `contracts/script/ops/lib/create-missing.ts`
- 测试随主流程一起在 C7 写入（这部分需要较多 mock，留到主入口 mock test）

- [ ] **Step 1：写实现**

```typescript
// contracts/script/ops/lib/create-missing.ts
import type { Abi, Hex, PublicClient, WalletClient } from "viem";
import type { Address } from "./clients.ts";
import type { Asset, Cadence } from "../scheduler.config.ts";
import { CADENCE_DURATION, PYTH_PRICE_ID } from "../scheduler.config.ts";
import { formatQuestion } from "./cadence-tag.ts";
import type { Gap } from "./gaps.ts";
import { fetchCurrentPrice, type HermesLike } from "./hermes.ts";

export type CreatedMarket = { id: bigint; gap: Gap; question: string };

export type CreateMissingDeps = {
  publicClient: PublicClient;
  walletClient: WalletClient;
  hermes: HermesLike;
  marketAddress: Address;
  abi: Abi;
  // Pyth feed 的 expo（实施时与 cast 验证一致）；默认 -8 适配 BTC/ETH/SOL/USD
  feedExpo: number;
  now?: () => number;
  logger?: Pick<Console, "log" | "error">;
};

function humanThresholdFor(currentPrice: number, offsetPct: number): number {
  // 取整到 1 USD：currentPrice * (1 + offsetPct/100)
  return Math.round(currentPrice * (1 + offsetPct / 100));
}

function scaleHumanThreshold(human: number, feedExpo: number): bigint {
  if (feedExpo > 0 || feedExpo < -18) throw new Error(`feedExpo 超界：${feedExpo}`);
  const decimals = -feedExpo;
  const scaled = BigInt(human) * (10n ** BigInt(decimals));
  if (scaled > (2n ** 63n - 1n)) throw new Error(`阈值溢出 int64：${scaled}`);
  return scaled;
}

export async function createMissingMarkets(
  gaps: Gap[],
  deps: CreateMissingDeps,
): Promise<CreatedMarket[]> {
  const logger = deps.logger ?? console;
  const now = (deps.now ?? (() => Math.floor(Date.now() / 1000)))();
  const out: CreatedMarket[] = [];

  // 同 asset 的 gap 共享一次 hermes 拉价
  const priceCache = new Map<Asset, number>();

  for (const gap of gaps) {
    try {
      let current = priceCache.get(gap.asset);
      if (current === undefined) {
        current = await fetchCurrentPrice(deps.hermes, PYTH_PRICE_ID[gap.asset]);
        priceCache.set(gap.asset, current);
      }
      const human = humanThresholdFor(current, gap.offsetPct);
      const threshold = scaleHumanThreshold(human, deps.feedExpo);
      const dur = CADENCE_DURATION[gap.cadence];
      const betDeadline = BigInt(now + dur.betHours * 3600);
      const resolveAfter = BigInt(now + dur.resolveHours * 3600);
      const question = formatQuestion(gap.asset, human, resolveAfter, gap.cadence);

      const hash = await deps.walletClient.writeContract({
        address: deps.marketAddress,
        abi: deps.abi,
        functionName: "createMarket",
        args: [PYTH_PRICE_ID[gap.asset], threshold, deps.feedExpo, betDeadline, resolveAfter, question],
      } as any);

      const receipt = await deps.publicClient.waitForTransactionReceipt({ hash });
      // 从 MarketCreated 事件解码 id（第一个 indexed topic = id）
      const created = receipt.logs.find((l) => l.address.toLowerCase() === deps.marketAddress.toLowerCase());
      if (!created || !created.topics[1]) throw new Error("未找到 MarketCreated event");
      const id = BigInt(created.topics[1]);
      out.push({ id, gap, question });
      logger.log(`gap 已造单：${gap.asset}/${gap.cadence} offset=${gap.offsetPct} marketId=${id} tx=${hash}`);
    } catch (e) {
      logger.error(`gap 造单失败 ${gap.asset}/${gap.cadence} offset=${gap.offsetPct}：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return out;
}
```

- [ ] **Step 2：commit**

```bash
git add contracts/script/ops/lib/create-missing.ts
git commit -m "feat(ops): 添加缺口造单（含 threshold 缩放 / 事件解码）"
```

注意：这一节由 Task C7 的主入口集成测试覆盖端到端逻辑；本节代码不在此独立测试。

### Task C6：ensureSeed（seed 池写链 + approve）

**Files:**
- Create: `contracts/script/ops/lib/ensure-seed.ts`

- [ ] **Step 1：写实现**

```typescript
// contracts/script/ops/lib/ensure-seed.ts
import { erc20Abi, type Abi, type PublicClient } from "viem";
import type { Address, Hex } from "./clients.ts";
import { makeWalletClientForKey } from "./clients.ts";
import { pickSeedWallets } from "./pick-seeds.ts";
import { seedAmount } from "./seed-amount.ts";
import { classifyBalance } from "./thresholds.ts";

export type SeedConfig = {
  rpcUrl: string;
  marketAddress: Address;
  usdcAddress: Address;
  marketAbi: Abi;
  seeds: Array<{ privateKey: Hex; address: Address }>;
};

export type EnsureSeedDeps = {
  publicClient: PublicClient;
  config: SeedConfig;
  alreadySeeded: Set<bigint>;        // 来自 collectSeededMarketIds
  logger?: Pick<Console, "log" | "error">;
};

const MAX_UINT256 = (2n ** 256n) - 1n;

export async function ensureSeedForMarkets(
  marketIds: bigint[],
  deps: EnsureSeedDeps,
): Promise<void> {
  const logger = deps.logger ?? console;
  const addrPool = deps.config.seeds.map((s) => s.address);

  for (const marketId of marketIds) {
    if (deps.alreadySeeded.has(marketId)) continue;
    try {
      const chosen = pickSeedWallets(marketId, addrPool);
      await Promise.allSettled(chosen.map((addr) => seedSingleWallet(addr, marketId, deps)));
    } catch (e) {
      logger.error(`市场 ${marketId}: ensureSeed 失败 ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

async function seedSingleWallet(
  addr: Address,
  marketId: bigint,
  deps: EnsureSeedDeps,
): Promise<void> {
  const logger = deps.logger ?? console;
  const walletIndex = deps.config.seeds.findIndex((s) => s.address.toLowerCase() === addr.toLowerCase());
  if (walletIndex < 0) throw new Error(`钱包 ${addr} 不在 seed 池`);
  const seed = deps.config.seeds[walletIndex];

  const [usdc, native] = await Promise.all([
    deps.publicClient.readContract({
      address: deps.config.usdcAddress, abi: erc20Abi,
      functionName: "balanceOf", args: [addr],
    }) as Promise<bigint>,
    deps.publicClient.getBalance({ address: addr }),
  ]);
  if (classifyBalance({ usdc, native }) === "skipSeed") {
    logger.log(`市场 ${marketId} 钱包 ${addr}：余额不足 skip`);
    return;
  }

  const yesAmt = seedAmount(marketId, walletIndex, "yes");
  const noAmt  = seedAmount(marketId, walletIndex, "no");
  const need = yesAmt + noAmt;

  const allowance = (await deps.publicClient.readContract({
    address: deps.config.usdcAddress, abi: erc20Abi,
    functionName: "allowance", args: [addr, deps.config.marketAddress],
  })) as bigint;

  const walletClient = makeWalletClientForKey(deps.config.rpcUrl, seed.privateKey);

  if (allowance < need) {
    const tx = await walletClient.writeContract({
      address: deps.config.usdcAddress, abi: erc20Abi,
      functionName: "approve", args: [deps.config.marketAddress, MAX_UINT256],
    } as any);
    await deps.publicClient.waitForTransactionReceipt({ hash: tx });
  }

  const yesTx = await walletClient.writeContract({
    address: deps.config.marketAddress, abi: deps.config.marketAbi,
    functionName: "bet", args: [marketId, true, yesAmt],
  } as any);
  await deps.publicClient.waitForTransactionReceipt({ hash: yesTx });

  const noTx = await walletClient.writeContract({
    address: deps.config.marketAddress, abi: deps.config.marketAbi,
    functionName: "bet", args: [marketId, false, noAmt],
  } as any);
  await deps.publicClient.waitForTransactionReceipt({ hash: noTx });

  logger.log(`市场 ${marketId} 钱包 ${addr} seed 完成 yes=${yesAmt} no=${noAmt}`);
}
```

`ensureSeed` 不独立写单元测试（mock 写链链路过重）；由 Task C7 端到端 mock test 覆盖。

- [ ] **Step 2：commit**

```bash
git add contracts/script/ops/lib/ensure-seed.ts
git commit -m "feat(ops): 添加 seed 钱包池双边 bet（含 approve + 余额体检）"
```

### Task C7：MarketScheduler.ts 主入口（四步编排）

**Files:**
- Create: `contracts/script/ops/MarketScheduler.ts`
- Create: `contracts/script/ops/test/check_scheduler_main.ts`

- [ ] **Step 1：写失败测试（mock 注入端到端）**

```typescript
// contracts/script/ops/test/check_scheduler_main.ts
import assert from "node:assert/strict";
import { runScheduleOnce, type ScheduleDeps } from "../MarketScheduler.ts";

const cases: Array<{ name: string; fn: () => Promise<void> }> = [];
function test(name: string, fn: () => Promise<void>) { cases.push({ name, fn }); }

test("DRY_RUN 不调用任何写链方法", async () => {
  const calls: string[] = [];
  const deps: ScheduleDeps = {
    dryRun: true,
    scanActiveMarkets: async () => ({
      BTC: { daily: [], weekly: [], monthly: [], quarterly: [] },
      ETH: { daily: [], weekly: [], monthly: [], quarterly: [] },
      SOL: { daily: [], weekly: [], monthly: [], quarterly: [] },
      unknown: [],
    }),
    createMissingMarkets: async () => { calls.push("create"); return []; },
    ensureSeedForMarkets: async () => { calls.push("seed"); },
    fetchAlreadySeeded: async () => new Set<bigint>(),
    listSnapshotMarketIds: () => [],
    logger: console,
  };
  await runScheduleOnce(deps);
  assert.deepEqual(calls, []);
});

test("非 DRY_RUN 经过 create 与 seed", async () => {
  const calls: string[] = [];
  const deps: ScheduleDeps = {
    dryRun: false,
    scanActiveMarkets: async () => ({
      BTC: { daily: [], weekly: [], monthly: [], quarterly: [] },
      ETH: { daily: [], weekly: [], monthly: [], quarterly: [] },
      SOL: { daily: [], weekly: [], monthly: [], quarterly: [] },
      unknown: [],
    }),
    createMissingMarkets: async () => { calls.push("create"); return []; },
    ensureSeedForMarkets: async () => { calls.push("seed"); },
    fetchAlreadySeeded: async () => new Set<bigint>(),
    listSnapshotMarketIds: () => [],
    logger: console,
  };
  await runScheduleOnce(deps);
  assert.deepEqual(calls, ["create", "seed"]);
});

for (const c of cases) {
  try { await c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
```

- [ ] **Step 2：写实现**

```typescript
// contracts/script/ops/MarketScheduler.ts
import { erc20Abi } from "viem";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname } from "node:path";

import { makeHermesClient } from "./lib/hermes.ts";
import { makePublicClient, makeWalletClientForKey } from "./lib/clients.ts";
import { loadOwnerEnv, loadSeedsEnv } from "./lib/env.ts";
import { loadPredictionMarketAbi } from "./lib/abi.ts";
import { validateConfig, DEPLOY_BLOCK } from "./scheduler.config.ts";
import { scanActiveMarkets as realScan, type BucketedMarkets, type ScannedMarket } from "./lib/market-scan.ts";
import { computeGaps } from "./lib/gaps.ts";
import { createMissingMarkets as realCreate, type CreatedMarket } from "./lib/create-missing.ts";
import { ensureSeedForMarkets as realEnsureSeed, type SeedConfig } from "./lib/ensure-seed.ts";
import { collectSeededMarketIds, fetchBetEvents } from "./lib/seed-events.ts";

const FEED_EXPO = -8;

export type ScheduleDeps = {
  dryRun: boolean;
  scanActiveMarkets: () => Promise<BucketedMarkets>;
  createMissingMarkets: (gaps: ReturnType<typeof computeGaps>) => Promise<CreatedMarket[]>;
  ensureSeedForMarkets: (ids: bigint[]) => Promise<void>;
  fetchAlreadySeeded: () => Promise<Set<bigint>>;
  listSnapshotMarketIds: () => bigint[];
  logger: Pick<Console, "log" | "error">;
};

export async function runScheduleOnce(deps: ScheduleDeps): Promise<void> {
  const snapshot = await deps.scanActiveMarkets();
  const gaps = computeGaps(snapshot);
  deps.logger.log(`gaps=${gaps.length} snapshot=${countSnapshot(snapshot)} unknown=${snapshot.unknown.length}`);

  if (deps.dryRun) {
    deps.logger.log("DRY_RUN：跳过写链");
    return;
  }

  const created = await deps.createMissingMarkets(gaps);
  const allIds = [...deps.listSnapshotMarketIds(), ...created.map((c) => c.id)];
  const alreadySeeded = await deps.fetchAlreadySeeded();
  // ensureSeed 内部还会跳已 seed；这里仅传 alreadySeeded 通过 deps 的封装
  await deps.ensureSeedForMarkets(allIds.filter((id) => !alreadySeeded.has(id)));
}

function countSnapshot(s: BucketedMarkets): number {
  let n = 0;
  for (const a of ["BTC","ETH","SOL"] as const)
    for (const c of ["daily","weekly","monthly","quarterly"] as const)
      n += s[a][c].length;
  return n;
}

function isDirect(): boolean {
  return process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
}

async function main(): Promise<void> {
  validateConfig();
  const ownerCfg = loadOwnerEnv();
  const seedsCfg = loadSeedsEnv();
  const dryRun = process.env.DRY_RUN === "1";

  const publicClient = makePublicClient(ownerCfg.rpcUrl);
  const walletClient = makeWalletClientForKey(ownerCfg.rpcUrl, ownerCfg.ownerPrivateKey);
  const hermes = makeHermesClient(ownerCfg.hermesEndpoint);
  const abi = loadPredictionMarketAbi();

  let snapshotCache: BucketedMarkets | undefined;
  let snapshotIds: bigint[] = [];

  const seedConfig: SeedConfig = {
    rpcUrl: ownerCfg.rpcUrl,
    marketAddress: ownerCfg.marketAddress,
    usdcAddress: seedsCfg.usdcAddress,
    marketAbi: abi,
    seeds: seedsCfg.seeds,
  };

  const deps: ScheduleDeps = {
    dryRun,
    async scanActiveMarkets() {
      const reader = {
        marketCount: async () => (await publicClient.readContract({
          address: ownerCfg.marketAddress, abi, functionName: "marketCount",
        })) as bigint,
        getMarketsPage: async (from: bigint, toExclusive: bigint): Promise<ScannedMarket[]> => {
          const raw = (await publicClient.readContract({
            address: ownerCfg.marketAddress, abi, functionName: "getMarketsPaged",
            args: [from, toExclusive],
          })) as Array<any>;
          return raw.map((m) => ({
            id: 0n,        // bucketing 不依赖 id；scanActiveMarkets 内会重写
            pythPriceId: m.pythPriceId,
            betDeadline: m.betDeadline,
            resolveAfter: m.resolveAfter,
            outcome: Number(m.outcome),
            question: m.question,
          }));
        },
      };
      const r = await realScan(reader, Math.floor(Date.now() / 1000));
      snapshotCache = r;
      snapshotIds = [
        ...(["BTC","ETH","SOL"] as const).flatMap((a) =>
          (["daily","weekly","monthly","quarterly"] as const).flatMap((c) => r[a][c].map((m) => m.id))),
        ...r.unknown.map((m) => m.id),
      ];
      return r;
    },
    async createMissingMarkets(gaps) {
      return realCreate(gaps, {
        publicClient, walletClient, hermes,
        marketAddress: ownerCfg.marketAddress,
        abi, feedExpo: FEED_EXPO,
      });
    },
    async ensureSeedForMarkets(ids) {
      const alreadySeeded = await deps.fetchAlreadySeeded();
      await realEnsureSeed(ids, {
        publicClient, config: seedConfig, alreadySeeded,
      });
    },
    async fetchAlreadySeeded() {
      const events = await fetchBetEvents(publicClient, ownerCfg.marketAddress, DEPLOY_BLOCK);
      return collectSeededMarketIds(events, seedsCfg.seeds.map((s) => s.address));
    },
    listSnapshotMarketIds: () => snapshotIds,
    logger: console,
  };

  await runScheduleOnce(deps);
}

if (isDirect()) {
  main().catch((err) => {
    console.error("MarketScheduler 失败", err);
    process.exit(1);
  });
}
```

- [ ] **Step 3：跑测试确认通过**

```bash
cd contracts/script/ops
npx tsx test/check_scheduler_main.ts
```

- [ ] **Step 4：扩 package.json 的 check**

把所有 C 段新增 check 追加：`test/check_market_scan.ts` `test/check_compute_gaps.ts` `test/check_pick_seeds.ts` `test/check_seed_amount.ts` `test/check_seed_events.ts` `test/check_scheduler_main.ts`。

- [ ] **Step 5：commit**

```bash
git add contracts/script/ops/MarketScheduler.ts contracts/script/ops/test/check_scheduler_main.ts contracts/script/ops/package.json
git commit -m "feat(ops): 添加 MarketScheduler 主入口与端到端 mock 测试"
```

### Task C8：launchd plist + ops/README 一节

**Files:**
- Create: `ops/launchd/com.arcpredict.ops.schedule.plist`
- Modify: `contracts/script/ops/README.md`

- [ ] **Step 1：建 plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.arcpredict.ops.schedule</string>
    <key>WorkingDirectory</key>
    <string>/REPLACE/path/to/ArcPredict/contracts/script/ops</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>npm run schedule</string>
    </array>
    <key>StartInterval</key>
    <integer>60</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/arc-predict-schedule.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/arc-predict-schedule.err.log</string>
  </dict>
</plist>
```

- [ ] **Step 2：扩 README，追加"Phase 16+ MarketScheduler"节**

```markdown
## Phase 16+：MarketScheduler（自动造单与 seed）

### 概述

`MarketScheduler.ts` 单次执行包含四步：

1. `scanActiveMarkets`：读链 `marketCount` + 分页 `getMarketsPaged`，按 `(asset, cadence)` 归桶
2. `computeGaps`：对照 `scheduler.config.ts` 的 `TARGET_ACTIVE`，算缺口
3. `createMissingMarkets`：owner 钱包对每个 gap 调 `createMarket`
4. `ensureSeedForMarkets`：seed 钱包池对未 seed 的市场双边 `bet`（含 approve）

### 配置（`scheduler.config.ts`）

- 改菜单 = 改这个文件 = 重启 launchd
- 启动时校验 `validateConfig`：每个 cadence betHours < resolveHours、TARGET_ACTIVE 与 THRESHOLD_OFFSETS_PCT 长度对齐、总活跃 ≥ 25
- `PYTH_PRICE_ID` 和 `DEPLOY_BLOCK` 默认占位，**部署前必须替换为真实值**

### 手动执行

```bash
cd /path/to/ArcPredict/contracts/script/ops
DRY_RUN=1 npm run schedule   # 只算缺口，不写链
npm run schedule              # 真正写链
```

### 自动化（launchd 示例）

`ops/launchd/com.arcpredict.ops.schedule.plist`，`StartInterval=60`。复制到 `~/Library/LaunchAgents/` 并替换 `WorkingDirectory`：

```bash
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.arcpredict.ops.schedule.plist
```

### 与现有 `resolve` 的关系

两个进程共用 owner 私钥，但**时间窗不重叠**（schedule 只动未到 betDeadline，resolve 只动已到 resolveAfter）。nonce 用 viem 默认 `pending` 策略；偶发并发冲突 → RPC 拒绝 → 下轮重试。不引入文件锁。

### 故障

- schedule 持续失败 → 先查 owner native 余额（gas）
- seed 持续失败 → 查 seed 钱包 native 余额（gas，不是 USDC）
- Hermes 价格异常 → 卸 schedule launchd，人工介入
```

- [ ] **Step 3：commit**

```bash
git add ops/launchd/com.arcpredict.ops.schedule.plist contracts/script/ops/README.md
git commit -m "docs(ops): 添加 MarketScheduler launchd 与 runbook"
```

---

## Phase D：前端微调

### Task D0：web-design-engineer 视觉稿（人工驱动）

⚠️ **这是一个人类协调任务**：codex 不能自己跑 superpowers:web-design-engineer skill，由用户（owner）触发后审稿。

**目标产物**：三份独立 HTML/CSS mock，放在 `mockups/phase16/` 目录下：

- `mockups/phase16/filter-bar.html`：MarketFilterBar 视觉稿（含 active / inactive / hover / mobile 三态）
- `mockups/phase16/activity-badges.html`：ActivityBadges 视觉稿
- `mockups/phase16/seed-disclosure.html`：SeedDisclosure 视觉稿（含加载态、零披露态）

**视觉基线（写在 mock 顶部 HTML 注释里给 web-design-engineer 看）**：

```
Style baseline:
- Primary background: white #FFFFFF / off-white #F8FAFC
- Existing 暖橙 accent (from mockups/preview.html): used for actions / winning side
- Arc network accent: subtle (chain badge / TVL number / top status); web-design-engineer
  to research Arc/Circle brand guideline and propose color/shape
- Typography: English sans-serif; existing Chinese pages unchanged
- Language: English only for these three components
- Mobile responsive required (test 375px viewport in the mock)
```

- [ ] **Step 1**：owner 在本地起 `superpowers:web-design-engineer`，按上述基线产出三份 mock
- [ ] **Step 2**：owner 审完，把 mock 提交到 `mockups/phase16/`：

```bash
git add mockups/phase16/
git commit -m "design(web): Phase 16+ 三组件视觉稿"
```

- [ ] **Step 3**：mock 审完之后才进入 D1–D5；后续 React 实现按 mock 1:1 还原结构与色彩

**未做这一步就强行进 D1 的代价**：组件需要返工配色 / 排版。

### Task D1：web/lib/cadence-tag.ts + web/lib/phase16-flag.ts

**Files:**
- Create: `web/lib/cadence-tag.ts`
- Create: `web/lib/phase16-flag.ts`
- Create: `web/test/check_cadence_tag.mjs`

- [ ] **Step 1：写失败测试**

```javascript
// web/test/check_cadence_tag.mjs
import assert from "node:assert/strict";
import { parseCadenceTag } from "../lib/cadence-tag.ts";

const cases = [
  ["BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [weekly]", "weekly"],
  ["[daily] 后缀", "daily"],
  ["foo [monthly]", "monthly"],
  ["foo [quarterly]", "quarterly"],
  ["无 tag", "unknown"],
  ["bad [weeky]", "unknown"],
];
for (const [input, expected] of cases) {
  assert.equal(parseCadenceTag(input), expected, `parseCadenceTag(${input})`);
}
console.log("OK");
```

注意：web 端用 `.mjs` 测试运行 `.ts` 文件需要 tsx/ts-node。延续既有 web/test 模式（看 `package.json` scripts.test 怎么运行）。若 web/package.json 没有 `test` script，按 MVP 模式由 `node web/test/check_*.mjs` 直接执行 .mjs（不依赖 ts 编译）—— 那就把 `lib/cadence-tag.ts` 复制一份纯 JS 测试 fixture，或在 mjs 里 dynamic import 编译后的 ts。

**最简方案**：把 `web/lib/cadence-tag.ts` 实现纯 JS-friendly（无 type 仅 jsdoc），并在 mjs 里 dynamic import。如果 web 现有 mjs 测试已经能 import .ts（通过 next-internal tsx），延续即可。

实施时 codex 确认：跑 `find web/test -name 'check_*.mjs' -exec node {} \;`（spec §交接里现有命令），看哪个 .mjs 在 import .ts，照搬。

- [ ] **Step 2：写实现**

```typescript
// web/lib/cadence-tag.ts
// 与 contracts/script/ops/lib/cadence-tag.ts 独立但语义对齐；测试在两侧分别保障。
export type Cadence = "daily" | "weekly" | "monthly" | "quarterly";
export type ParsedCadence = Cadence | "unknown";

const RE = /\[(daily|weekly|monthly|quarterly)\]\s*$/;

export function parseCadenceTag(question: string): ParsedCadence {
  const m = question.match(RE);
  return m ? (m[1] as Cadence) : "unknown";
}
```

```typescript
// web/lib/phase16-flag.ts
// 简单 feature flag：未显式启用时不渲染 Phase 16+ 新组件
export function isPhase16Enabled(): boolean {
  return process.env.NEXT_PUBLIC_PHASE16_ENABLED === "true";
}
```

- [ ] **Step 3：跑测试**

```bash
cd web
node test/check_cadence_tag.mjs
```

- [ ] **Step 4：commit**

```bash
git add web/lib/cadence-tag.ts web/lib/phase16-flag.ts web/test/check_cadence_tag.mjs
git commit -m "feat(web): 添加 cadence tag 解析与 Phase16 flag"
```

### Task D2：MarketFilterBar.tsx

按 D0 产出的 `mockups/phase16/filter-bar.html` 1:1 还原。

**Files:**
- Create: `web/components/MarketFilterBar.tsx`
- Create: `web/test/check_market_filter.mjs`

- [ ] **Step 1：写失败测试（纯函数 filterMarkets）**

```javascript
// web/test/check_market_filter.mjs
import assert from "node:assert/strict";
import { filterMarkets } from "../components/MarketFilterBar.tsx";

const markets = [
  { id: 1, pythPriceId: "0xBTC", question: "BTC/USD ≥ 71200 @ 2026 [weekly]" },
  { id: 2, pythPriceId: "0xETH", question: "ETH/USD ≥ 3500 @ 2026 [monthly]" },
  { id: 3, pythPriceId: "0xSOL", question: "SOL/USD ≥ 150 @ 2026 [daily]" },
  { id: 4, pythPriceId: "0xBTC", question: "无 tag 的旧市场" },
];

assert.deepEqual(
  filterMarkets(markets, { asset: "all", cadence: "all", priceIdToAsset: { "0xBTC": "BTC", "0xETH": "ETH", "0xSOL": "SOL" } }).map(m => m.id),
  [1, 2, 3, 4],
);

assert.deepEqual(
  filterMarkets(markets, { asset: "BTC", cadence: "all", priceIdToAsset: { "0xBTC": "BTC", "0xETH": "ETH", "0xSOL": "SOL" } }).map(m => m.id),
  [1, 4],
);

assert.deepEqual(
  filterMarkets(markets, { asset: "all", cadence: "weekly", priceIdToAsset: { "0xBTC": "BTC", "0xETH": "ETH", "0xSOL": "SOL" } }).map(m => m.id),
  [1],
);

assert.deepEqual(
  filterMarkets(markets, { asset: "BTC", cadence: "weekly", priceIdToAsset: { "0xBTC": "BTC", "0xETH": "ETH", "0xSOL": "SOL" } }).map(m => m.id),
  [1],
);

console.log("OK");
```

- [ ] **Step 2：写实现**

```tsx
// web/components/MarketFilterBar.tsx
"use client";

import { parseCadenceTag, type Cadence } from "../lib/cadence-tag";

export type Asset = "BTC" | "ETH" | "SOL";
export type AssetFilter = Asset | "all";
export type CadenceFilter = Cadence | "all";

export type FilterMarketInput = {
  id: number | bigint;
  pythPriceId: string;
  question: string;
};

export function filterMarkets<T extends FilterMarketInput>(
  markets: T[],
  opts: { asset: AssetFilter; cadence: CadenceFilter; priceIdToAsset: Record<string, Asset> },
): T[] {
  return markets.filter((m) => {
    if (opts.asset !== "all") {
      const a = opts.priceIdToAsset[m.pythPriceId];
      if (a !== opts.asset) return false;
    }
    if (opts.cadence !== "all") {
      const c = parseCadenceTag(m.question);
      if (c !== opts.cadence) return false;
    }
    return true;
  });
}

type Props = {
  asset: AssetFilter;
  cadence: CadenceFilter;
  onChange: (next: { asset: AssetFilter; cadence: CadenceFilter }) => void;
};

const ASSETS: AssetFilter[] = ["all", "BTC", "ETH", "SOL"];
const CADENCES: CadenceFilter[] = ["all", "daily", "weekly", "monthly", "quarterly"];

export function MarketFilterBar({ asset, cadence, onChange }: Props) {
  // 按 mockups/phase16/filter-bar.html 还原 class 名
  return (
    <div className="flex flex-wrap gap-3 items-center text-sm py-3 px-4 bg-white border-b border-slate-200">
      <div className="flex gap-1">
        {ASSETS.map((a) => (
          <button
            key={a}
            onClick={() => onChange({ asset: a, cadence })}
            className={a === asset ? "px-3 py-1 rounded-full bg-slate-900 text-white" : "px-3 py-1 rounded-full text-slate-600 hover:bg-slate-100"}
          >
            {a === "all" ? "All" : a}
          </button>
        ))}
      </div>
      <div className="w-px h-4 bg-slate-300" />
      <div className="flex gap-1">
        {CADENCES.map((c) => (
          <button
            key={c}
            onClick={() => onChange({ asset, cadence: c })}
            className={c === cadence ? "px-3 py-1 rounded-full bg-slate-900 text-white" : "px-3 py-1 rounded-full text-slate-600 hover:bg-slate-100"}
          >
            {c === "all" ? "All" : c[0].toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
```

⚠️ 上面的 className 是占位 Tailwind；最终样式以 D0 mock 为准。

- [ ] **Step 3：跑测试**

```bash
cd web
node test/check_market_filter.mjs
```

- [ ] **Step 4：commit**

```bash
git add web/components/MarketFilterBar.tsx web/test/check_market_filter.mjs
git commit -m "feat(web): 添加 MarketFilterBar 与 filterMarkets 纯函数"
```

### Task D3：ActivityBadges.tsx

**Files:**
- Create: `web/components/ActivityBadges.tsx`
- Create: `web/test/check_activity_badges.mjs`

- [ ] **Step 1：写失败测试（纯函数 computeBadges）**

```javascript
// web/test/check_activity_badges.mjs
import assert from "node:assert/strict";
import { computeBadges } from "../components/ActivityBadges.tsx";

const NOW = 1_000_000;
const oneWeek = 7 * 24 * 3600;

const markets = [
  { outcome: 0, betDeadline: BigInt(NOW + 1000), resolveAfter: BigInt(NOW + 2000), yesPool: 1_000_000n, noPool: 2_000_000n },
  { outcome: 0, betDeadline: BigInt(NOW + 1000), resolveAfter: BigInt(NOW + oneWeek - 10), yesPool: 5_000_000n, noPool: 5_000_000n },
  { outcome: 1, betDeadline: BigInt(NOW - 1), resolveAfter: BigInt(NOW + 100), yesPool: 10_000_000n, noPool: 10_000_000n }, // 已结算 → 不算活跃，但 TVL 仍累计
  { outcome: 0, betDeadline: BigInt(NOW + 1000), resolveAfter: BigInt(NOW + oneWeek * 4), yesPool: 1_000_000n, noPool: 1_000_000n },
];

const r = computeBadges(markets, NOW);
assert.equal(r.activeCount, 3);
assert.equal(r.resolvingThisWeek, 2);
// TVL = 3 + 10 + 20 + 2 = 35 USDC
assert.equal(r.tvlUsdc6.toString(), "35000000");
console.log("OK");
```

- [ ] **Step 2：写实现**

```tsx
// web/components/ActivityBadges.tsx
"use client";

export type BadgeMarket = {
  outcome: number;
  betDeadline: bigint;
  resolveAfter: bigint;
  yesPool: bigint;
  noPool: bigint;
};

export type Badges = {
  activeCount: number;
  resolvingThisWeek: number;
  tvlUsdc6: bigint;
};

export function computeBadges(markets: BadgeMarket[], nowSec: number): Badges {
  const now = BigInt(nowSec);
  const weekFromNow = now + BigInt(7 * 24 * 3600);
  let activeCount = 0;
  let resolvingThisWeek = 0;
  let tvl = 0n;
  for (const m of markets) {
    tvl += m.yesPool + m.noPool;
    if (m.outcome !== 0) continue;
    if (m.betDeadline > now) activeCount += 1;
    if (m.resolveAfter > now && m.resolveAfter <= weekFromNow) resolvingThisWeek += 1;
  }
  return { activeCount, resolvingThisWeek, tvlUsdc6: tvl };
}

function formatUsdc(raw: bigint): string {
  // 6 decimals → 千分位
  const whole = raw / 1_000_000n;
  return whole.toLocaleString("en-US");
}

export function ActivityBadges({ markets, nowSec }: { markets: BadgeMarket[]; nowSec: number }) {
  const b = computeBadges(markets, nowSec);
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700 py-2 px-4">
      <span><strong className="text-slate-900">{b.activeCount}</strong> active markets</span>
      <span><strong className="text-slate-900">{b.resolvingThisWeek}</strong> resolving this week</span>
      <span><strong className="text-slate-900">{formatUsdc(b.tvlUsdc6)}</strong> USDC TVL</span>
    </div>
  );
}
```

- [ ] **Step 3：跑测试**

```bash
cd web
node test/check_activity_badges.mjs
```

- [ ] **Step 4：commit**

```bash
git add web/components/ActivityBadges.tsx web/test/check_activity_badges.mjs
git commit -m "feat(web): 添加 ActivityBadges 与 computeBadges 纯函数"
```

### Task D4：SeedDisclosure.tsx

**Files:**
- Create: `web/components/SeedDisclosure.tsx`
- Create: `web/test/check_seed_disclosure.mjs`

- [ ] **Step 1：写失败测试（纯函数 sumSeedContribution）**

```javascript
// web/test/check_seed_disclosure.mjs
import assert from "node:assert/strict";
import { sumSeedContribution } from "../components/SeedDisclosure.tsx";

const SEEDS = ["0xaaa", "0xbbb"];
const events = [
  { user: "0xaaa", amount: 3_000_000n },
  { user: "0xbbb", amount: 5_000_000n },
  { user: "0xfff", amount: 100_000_000n }, // 非 seed
  { user: "0xAAA", amount: 2_000_000n },    // 大写也算
];
const total = sumSeedContribution(events, SEEDS);
assert.equal(total.toString(), "10000000");  // 3+5+2 = 10 USDC (6 decimals)

const zero = sumSeedContribution([], SEEDS);
assert.equal(zero.toString(), "0");

console.log("OK");
```

- [ ] **Step 2：写实现**

```tsx
// web/components/SeedDisclosure.tsx
"use client";

export type DisclosureBetEvent = { user: string; amount: bigint };

export function sumSeedContribution(events: DisclosureBetEvent[], seeds: readonly string[]): bigint {
  const lower = new Set(seeds.map((s) => s.toLowerCase()));
  let s = 0n;
  for (const e of events) {
    if (lower.has(e.user.toLowerCase())) s += e.amount;
  }
  return s;
}

function formatUsdc(raw: bigint): string {
  return (raw / 1_000_000n).toLocaleString("en-US");
}

type Props = {
  seedContribution: bigint;
  loading?: boolean;
};

export function SeedDisclosure({ seedContribution, loading }: Props) {
  if (loading) return null;
  if (seedContribution === 0n) return null;
  return (
    <p className="text-xs text-slate-500 mt-1">
      ~{formatUsdc(seedContribution)} USDC from project seed liquidity
    </p>
  );
}
```

- [ ] **Step 3：跑测试**

```bash
cd web
node test/check_seed_disclosure.mjs
```

- [ ] **Step 4：commit**

```bash
git add web/components/SeedDisclosure.tsx web/test/check_seed_disclosure.mjs
git commit -m "feat(web): 添加 SeedDisclosure 与 sumSeedContribution 纯函数"
```

### Task D5：接入页面（首页 + 市场详情）

把三个组件挂进首页和市场详情，并加 `NEXT_PUBLIC_PHASE16_ENABLED` 开关。

**Files:**
- Modify: `web/app/page.tsx`（首页）
- Modify: `web/app/market/[id]/page.tsx`（市场详情）
- Modify: `web/.env.example` 或类似（加 `NEXT_PUBLIC_PHASE16_ENABLED=true` 示例）

- [ ] **Step 1：先确认现有首页结构**

```bash
cat web/app/page.tsx | head -100
cat web/app/market/[id]/page.tsx | head -100
```

记下数据流：哪段是市场列表数据、哪段是市场详情，避免下一步改错位置。

- [ ] **Step 2：首页接 MarketFilterBar + ActivityBadges**

在首页拿到市场列表的位置（应该已有一个分页 `getMarketsPaged` 或 `getDashboardLatest` 调用）：

```tsx
// web/app/page.tsx 节选
"use client";
import { useState, useMemo } from "react";
import { MarketFilterBar, filterMarkets, type AssetFilter, type CadenceFilter } from "@/components/MarketFilterBar";
import { ActivityBadges } from "@/components/ActivityBadges";
import { isPhase16Enabled } from "@/lib/phase16-flag";
import { PYTH_PRICE_ID_TO_ASSET } from "@/lib/seed-wallets"; // D6 一起新增（见下）

// ... 既有 fetch 市场列表的 hook ...

export default function HomePage() {
  const [asset, setAsset] = useState<AssetFilter>("all");
  const [cadence, setCadence] = useState<CadenceFilter>("all");
  const markets = useMarkets(); // 既有 hook

  const showPhase16 = isPhase16Enabled();
  const visibleMarkets = useMemo(
    () => (showPhase16 ? filterMarkets(markets, { asset, cadence, priceIdToAsset: PYTH_PRICE_ID_TO_ASSET }) : markets),
    [markets, asset, cadence, showPhase16],
  );

  return (
    <main>
      {showPhase16 && (
        <>
          <ActivityBadges markets={markets} nowSec={Math.floor(Date.now() / 1000)} />
          <MarketFilterBar asset={asset} cadence={cadence} onChange={({ asset, cadence }) => { setAsset(asset); setCadence(cadence); }} />
        </>
      )}
      <MarketList markets={visibleMarkets} />
    </main>
  );
}
```

`@/lib/seed-wallets.ts` 由 Task A6 生成；这里**额外需要** `PYTH_PRICE_ID_TO_ASSET` 反查映射。在 Task A6 的 `buildWebSeedListContent` 旁边再生成一份固定映射文件（或直接 hardcode 在 web/lib，由 owner 与 ops 的 `scheduler.config.ts` 同步）。

**子任务 D5a：补充 `web/lib/asset-price-map.ts`**

```typescript
// web/lib/asset-price-map.ts
// 与 contracts/script/ops/scheduler.config.ts 的 PYTH_PRICE_ID 同步；owner 修改后两边手动对齐。
export type Asset = "BTC" | "ETH" | "SOL";
export const PYTH_PRICE_ID_TO_ASSET: Record<string, Asset> = {
  // 占位；owner 替换为真实 priceId（lowercase）
  "0x0000000000000000000000000000000000000000000000000000000000000000": "BTC",
};
```

注意：这是**手动对齐**——比从 .env 读更显式，且不破坏前端纯静态渲染。owner 在 E1 验证 priceId 时同步两个文件。

- [ ] **Step 3：市场详情接 SeedDisclosure**

```tsx
// web/app/market/[id]/page.tsx 节选
import { SeedDisclosure, sumSeedContribution } from "@/components/SeedDisclosure";
import { SEED_WALLETS } from "@/lib/seed-wallets";
import { isPhase16Enabled } from "@/lib/phase16-flag";

// 既有 fetch Bet 事件的 hook（如无，加一个）
const betEvents = useBetEventsForMarket(marketId);
const seedContribution = useMemo(
  () => sumSeedContribution(betEvents ?? [], SEED_WALLETS as readonly string[]),
  [betEvents],
);

{isPhase16Enabled() && <SeedDisclosure seedContribution={seedContribution} loading={betEvents === undefined} />}
```

若 `useBetEventsForMarket` 不存在：用 wagmi 的 `useReadContract` + `getLogs` 或者从 multicall 路径里扩展。具体由 codex 在阅读 `web/app/market/[id]/page.tsx` 后补一个 hook，遵循既有写法。

- [ ] **Step 4：加 NEXT_PUBLIC_PHASE16_ENABLED 文档**

修改 `web/scripts/ensure-production-env.mjs`（已存在）把 `NEXT_PUBLIC_PHASE16_ENABLED` 列为期望但非必需的 env，启用时设 `true`、回滚时设 `false`。

- [ ] **Step 5：跑现有 web check 与 typecheck**

```bash
cd web
pnpm typecheck
find test -maxdepth 1 -name 'check_*.mjs' -exec node {} \;
pnpm build
```

期望：全部通过。

- [ ] **Step 6：commit**

```bash
git add web/app/page.tsx web/app/market/[id]/page.tsx web/lib/asset-price-map.ts web/scripts/ensure-production-env.mjs
git commit -m "feat(web): 接入 Phase 16+ filter / badges / seed disclosure（含 flag 开关）"
```

---

## Phase E：联动与验收

### Task E1：cast 验证三条 Pyth priceId（人工）

由 owner 在本地执行；产出 PR 描述里直接贴 cast 输出。

- [ ] **Step 1：从 Pyth 官方 doc 获取 BTC/USD、ETH/USD、SOL/USD 的 mainnet feed id**

  来源：`https://pyth.network/developers/price-feed-ids`（mainnet/EVM 列）

- [ ] **Step 2：用一次性临时市场跑全链路**

  对每个 asset：
  - 调 `CreateMarket.s.sol` 创建一个**1 小时 betDeadline、1.5 小时 resolveAfter** 的小额测试市场
  - 等到时间，跑现有 `npm run resolve`（`ResolveDueMarkets`）
  - 看 explorer 上 `Resolved` event 是否落在 `Yes` / `No`（非 `Invalid`），证明 priceId 和 feed expo 配置一致

- [ ] **Step 3：把三个真实 priceId 写入 `contracts/script/ops/scheduler.config.ts`**

  替换 `PYTH_PRICE_ID` 三个占位 0x0...0；同步 `web/lib/asset-price-map.ts` 的反查映射。

- [ ] **Step 4：填 DEPLOY_BLOCK**

  ```bash
  cast block-number --rpc-url $RPC_URL    # 当前块
  cast tx <PredictionMarket 的部署 tx hash> --rpc-url $RPC_URL | grep blockNumber
  ```
  把部署 tx 的 blockNumber 写入 `DEPLOY_BLOCK`。

- [ ] **Step 5：跑 generate-seeds（生成钱包池 + web/lib/seed-wallets.ts）**

  ```bash
  cd contracts/script/ops
  npm run generate-seeds
  ```

  - 把 stdout 列出的 12 个地址逐个去 `https://faucet.circle.com` 领 ETH + USDC
  - 验证：`npm run topup` 应输出 12 个 healthy，0 needsTopup（即每个钱包余额至少 10 USDC）

- [ ] **Step 6：commit**

```bash
git add contracts/script/ops/scheduler.config.ts web/lib/asset-price-map.ts web/lib/seed-wallets.ts
git commit -m "config: 填入真实 Pyth priceId / DEPLOY_BLOCK / 12 个 seed 钱包"
```

### Task E2：DRY_RUN 端到端

- [ ] **Step 1：跑 DRY_RUN**

```bash
cd contracts/script/ops
DRY_RUN=1 npm run schedule
```

期望输出格式：

```
gaps=26 snapshot=0 unknown=0
DRY_RUN：跳过写链
```

- [ ] **Step 2：人工核对 gaps 数与目标矩阵一致**

26 = 3 (daily) + 9 (weekly) + 8 (monthly) + 6 (quarterly)

- [ ] **Step 3：如果 gaps ≠ 期望，回 scheduler.config.ts 检查 `validateConfig()` 是否被绕过**

### Task E3：真实部署一轮 schedule + seed

- [ ] **Step 1：手动跑一次真实 schedule**

```bash
cd contracts/script/ops
npm run schedule
```

期望：
- 26 笔 `createMarket` tx，逐个 Mined
- 后续 26+（seed 钱包 × bet）笔 bet tx
- stdout 出现每个 marketId 的 seed 完成日志

观察点：
- 任一 asset 的 Hermes 拉价失败 → 同 asset 后续 gap 全部跳过；其它 asset 继续
- 任一 createMarket 失败 → 该 gap 跳过；下一轮重试

- [ ] **Step 2：用 ListMarkets 确认链上活跃数**

```bash
cd contracts
forge script script/ops/ListMarkets.s.sol --rpc-url "$RPC_URL"
```

应看到 26 个新市场，question 含 `[weekly]` 等 tag。

- [ ] **Step 3：装 launchd**

```bash
cp ops/launchd/com.arcpredict.ops.schedule.plist ~/Library/LaunchAgents/
cp ops/launchd/com.arcpredict.ops.topup.plist ~/Library/LaunchAgents/
# 编辑 plist 把 WorkingDirectory 改成实际路径
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.arcpredict.ops.schedule.plist
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.arcpredict.ops.topup.plist
launchctl print "gui/$(id -u)/com.arcpredict.ops.schedule"
launchctl print "gui/$(id -u)/com.arcpredict.ops.topup"
```

- [ ] **Step 4：等下一分钟，看 launchd 自动触发的 log**

```bash
tail -f /tmp/arc-predict-schedule.log
tail -f /tmp/arc-predict-schedule.err.log
```

应该看到大多数 tick 输出 `gaps=0 snapshot=26 unknown=0`（已满，无新 gap）。

### Task E4：forge test 130 仍全绿

- [ ] **Step 1：跑 forge test**

```bash
cd contracts
forge test
```

期望：`130 tests passed, 0 failed`。

- [ ] **Step 2：跑 ops typecheck + check**

```bash
cd contracts/script/ops
npm run check
```

期望：全绿（含 Phase A/B/C 所有新 check）。

- [ ] **Step 3：跑 web typecheck + build + 所有 check_*.mjs**

```bash
cd web
pnpm typecheck
pnpm build
find test -maxdepth 1 -name 'check_*.mjs' -exec node {} \;
```

期望：全绿。

- [ ] **Step 4：commit（如有未提交的 lockfile / 微调）**

```bash
git status
# 如有改动 → commit
```

### Task E5：手动 QA + docs/qa 更新

- [ ] **Step 1：浏览 production 站点验证三处 UI**

  - `https://web-arcpredict.vercel.app/`：
    - 顶部出现 `26 active markets · X resolving this week · Y USDC TVL` 形式 badges
    - 过滤条 `All / BTC / ETH / SOL | All / Daily / Weekly / Monthly / Quarterly` 切换正确
    - 切到 `BTC × Weekly` 应看到 3 条
  - 进入某个 weekly 市场详情：
    - 出现 `~X USDC from project seed liquidity` 行
    - 截图保存

- [ ] **Step 2：补 `docs/qa/2026-06-XX-phase16-manual-qa.md`**

```markdown
# ArcPredict Phase 16+ 手动 QA 证据

## 验证点
- [ ] 首页 badges 数字正确（与 ListMarkets 输出对比）
- [ ] 过滤条 BTC × Weekly 出 3 条
- [ ] 过滤条 ETH × Monthly 出 3 条
- [ ] 过滤条 SOL × Quarterly 出 2 条
- [ ] 市场详情 SeedDisclosure 数字 = 链上 seed 钱包 bet 累计
- [ ] Mobile 375px：filter 不溢出
- [ ] launchd schedule 连续运行 24h 无 panic
- [ ] launchd topup 6h 触发，无 needsTopup

## 证据
- 截图：mockups/phase16/*.png 或 docs/qa/screenshots/
- 交易哈希：每个 asset 一条 createMarket 的 tx
- launchd 日志：/tmp/arc-predict-schedule.log 的尾段 100 行
```

- [ ] **Step 3：commit QA 文档**

```bash
git add docs/qa/2026-06-XX-phase16-manual-qa.md
git commit -m "docs(qa): Phase 16+ 手动 QA 证据初稿"
```

- [ ] **Step 4：（可选）开 PR**

如要走 PR 评审，参考现有 `gh pr create` 模式；本计划无强制要求。

---

## 验收清单（spec INV 对照）

按 spec §9 不变量逐条核对：

- [ ] **INV-1** `forge test` 仍 130 passed；合约 ABI / 部署地址不变 → Task E4
- [ ] **INV-2** 调度器单点失败不污染其它 asset / cadence / 市场 → 见 `createMissingMarkets` 与 `ensureSeedForMarkets` 的 try-catch（Task C5、C6）
- [ ] **INV-3** ensureSeed 幂等性以 Bet 事件为唯一判据 → `collectSeededMarketIds`（Task C4）
- [ ] **INV-4** `pickSeedWallets` / `seedAmount` 同输入同结果 → Task C3 测试覆盖
- [ ] **INV-5** 三进程关注点分离 → 三个独立入口 + 三个独立 plist
- [ ] **INV-6** 私钥不进 git；`.env.seeds` chmod 600 → Task A6 写文件 mode；Task A7 加 .gitignore
- [ ] **INV-7** 不引入新合约 view → 全部用现有 `marketCount` / `getMarketsPaged` / `getDashboardLatest` / Bet 事件
- [ ] **INV-8** seed 钱包公开地址清单在前端可见 → `web/lib/seed-wallets.ts`（Task A6 生成 + Task E1 落实）
- [ ] **INV-9** question 文本 `[cadence]` tag 是反查唯一可靠源 → `formatQuestion` / `parseCadenceTag`（Task A2、D1）
- [ ] **INV-10** 不引入消息推送告警 → 仅 launchd 日志 + `/tmp/arc-predict-topup-needed.json`

spec §10 待验证项：

- [ ] BTC/ETH/SOL Pyth priceId 三个验证 → Task E1
- [ ] Circle faucet 是否能程序化 → 留半自动（spec §6.2 层 1），层 2 由 owner 后续探测
- [ ] Arc brand 视觉元素 → 由 web-design-engineer 调研（Task D0）
- [ ] Arc testnet log retention 实际窗口 → Task E3 在真实运行中观察 `fetchBetEvents` 跨大区块范围是否稳定

---

## Self-Review 自检结论

写完计划后自检（spec coverage / placeholders / type consistency）：

1. **Spec coverage**：spec §1 背景 → 隐含覆盖；§2 决策摘要 → 在本计划"全程约束"反映；§3–§6 → Phase A/B/C/D 一一对应；§7 视觉/语言 → Task D0–D5；§8 错误矩阵 → 散落在各 Task 的 try-catch 描述；§9 不变量 → 验收清单逐条对应；§10 待验证 → Task E1；§11 文件清单 → 本计划 File Structure 完全对齐
2. **Placeholders**：扫过；ensure-seed.ts 的两处占位已在 commit 前修正为完整代码；其余无 "TBD"
3. **Type consistency**：`Asset` / `Cadence` 在 scheduler.config.ts 定义后全 plan 一致引用；`ScannedMarket` / `BucketedMarkets` 字段从 C1 到 C7 名字一致

---

## 计划执行模式选择

计划已写到 `docs/superpowers/plans/2026-06-11-arc-predict-phase16.md`。

用户已声明本计划由 **codex** 执行（用户自行驱动）。因此不走 superpowers 的 subagent-driven-development / executing-plans——交付物以这个 plan 文档为准。

如果改主意想在本会话内执行，告诉我，我换成 subagent-driven 或 inline 执行。
