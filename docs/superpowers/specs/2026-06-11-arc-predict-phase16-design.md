# ArcPredict Phase 16+ 设计文档（造势与流动性自动化）

> **日期**：2026-06-11
> **状态**：草案，待用户终审
> **与现有 spec 的关系**：本文件是 Phase 16+ 的**增量层**。合约真相源仍为 `docs/superpowers/specs/2026-06-07-arc-predict-design.md`，合约不动、地址不变（`0xCFDC9B7F4a4c360CF5B3a31Bb33eB46aD8A3dA43`）。
> **下一步**：用户审阅 → writing-plans 输出实现计划 → 交付 codex 实现

---

## 1. 背景与定位

### 1.1 项目目标

Phase 0–15 MVP 已完成、已部署、用户已确认功能正常。下一阶段的核心问题是：**testnet 站点缺乏"持续显得活着"的活动节奏**——访客随时进站点，希望看到正在进行、即将开奖、有人下注的市场。

Phase 16+ 的首要目标：让 testnet 站点持续显得活跃。所有自动化决策围绕这个目标展开。

### 1.2 不是什么

- ❌ 不改合约 ABI / 部署地址（任何形态变化都通过参数组合，不通过新市场类型）
- ❌ 不做"全模拟交易所"（不有 bot 跟价波动持续下注；造势只在创建市场时双边 seed 一次）
- ❌ 不引入后端 / 数据库 / SaaS observability（沿用现有"前端读链 + ops 脚本写链"形态）
- ❌ 不接入消息推送告警通道（owner 自己看 launchd 日志）

### 1.3 关键已知事实（沿用 v3）

| 项 | 值 |
|---|---|
| PredictionMarket 部署地址 | `0xCFDC9B7F4a4c360CF5B3a31Bb33eB46aD8A3dA43` |
| chainId | 5042002 |
| USDC ERC-20 facade | `0x3600000000000000000000000000000000000000`（6 decimals） |
| 现有 ops 守护 | `contracts/script/ops/ResolveDueMarkets.ts`（launchd / systemd / cron 已运行） |
| Vercel production | `https://web-arcpredict.vercel.app` |

---

## 2. 关键决策摘要

| 维度 | 决策 | 选择理由 |
|---|---|---|
| 首要目标 | testnet 持续显得活跃 | 用户明确选择 |
| 流动性策略 | 仅在新市场创建时由多 seed 钱包双边 seed | 诚实、零持续介入、零 bot 模拟 |
| 市场菜单 | BTC/ETH/SOL × Daily/Weekly/Monthly/Quarterly | 多资产、多周期，主力放在周/月/季度 |
| 合约变更 | 无（保持 0xCFDC…3dA43 不动） | 风险最小，所有变化通过参数 |
| 钱包池规模 | 10–15 个 seed 钱包 | 既"出自不同人"明显，又不过度运维 |
| faucet 自动化 | 半自动起步（脚本输出清单，owner 手动粘） | Circle faucet 是 captcha 网页，没有公开 API |
| 进程拓扑 | 三个守护进程（schedule / resolve / topup） | 关注点分离，互不污染日志 |
| 状态存储 | 完全无状态，每次从链 + 时间重算 | 重启安全、迁移安全、并发安全 |
| 前端语言 | Phase 16+ 新增组件英文；存量中文保留 | 用户指定；存量统一改造作 follow-up |
| 视觉风格 | Light / white 为主，融合 Arc 网络元素 | 用户指定；具体色值由 web-design-engineer 调研 |

---

## 3. § 1 架构

### 3.1 系统拓扑

```
┌────────────────────────────────────────────────────────┐
│  Vercel 前端（已存在，微调）                              │
│  • 首页加：按 cadence / asset 过滤；活跃数 badge          │
│  • 市场详情：显示 seed 流动性披露                         │
│  • 新增 UI 默认英文，light / white 风                    │
└──────────────┬─────────────────────────────────────────┘
               │ JSON-RPC over HTTPS
               ▼
┌────────────────────────────────────────────────────────┐
│  Arc Testnet（不动合约）                                 │
│  PredictionMarket @ 0xCFDC…3dA43                       │
│   • createMarket  ← owner 钱包调（调度器脚本）            │
│   • bet           ← seed 钱包池调（调度器脚本）+ 真人      │
│   • resolve       ← 现有 ResolveDueMarkets.ts            │
└──────────────▲──────────────▲──────────────────────────┘
               │              │
   ┌───────────┴───┐  ┌───────┴────────┐  ┌───────────────┐
   │ MarketScheduler│  │ResolveDueMarkets│  │  TopUpSeeds   │
   │  npm run       │  │ 已存在不动      │  │  npm run topup │
   │  schedule      │  │                │  │                │
   │ • 扫目录矩阵    │  │ launchd 30s    │  │ launchd 6h     │
   │ • 补缺造单      │  │                │  │ • 余额扫       │
   │ • 双边 seed     │  │                │  │ • faucet 调用  │
   │ launchd 1min   │  │                │  │ • 告警         │
   └───────────────┘  └────────────────┘  └───────────────┘
        Owner 私钥        Owner 私钥        Seed 私钥池
        contracts/.env    contracts/.env    contracts/.env.seeds
```

### 3.2 关键架构决策

1. **三个守护进程，三种节奏**
   - `schedule`：launchd 每 60 秒一次，大多数 tick 不做任何写交易（目标矩阵已平衡时只读 + 退出）
   - `resolve`：launchd 每 30 秒一次（沿用现有）
   - `topup`：launchd 每 6 小时一次（faucet 限流通常以小时计）

2. **无后端、无数据库**：所有状态读链。脚本完全无状态——每次启动重新算"该有多少 / 实际有多少 / 缺多少"，不维护 checkpoint 文件。意味着重启、迁移、并行误调用都是安全的。

3. **配置即代码**：目标矩阵（哪些 asset、哪些 cadence、各活跃多少、threshold 偏移阶梯）写在 `contracts/script/ops/scheduler.config.ts`，由 git 跟踪。改菜单 = 改一个 TS 文件 = 重启 launchd。不引入 admin 后台。

4. **owner 与 seed 钱包池隔离**：owner 只做 `createMarket` 和 `resolve`；seed 钱包池只做 `bet`。两套私钥放在两个文件，避免一个泄漏导致连锁影响。

5. **创建 + seed 是表达原子，但不是链上原子**：调度器先 `createMarket`，等 receipt 拿 marketId，再用 seed 钱包池下 2k 笔 bet。中间若有失败，下一轮调度器幂等补 seed（用"链上该市场是否已有 seed 钱包的 `Bet` 事件"作为去重键）。

### 3.3 范围与边界

| 维度 | 边界 |
|---|---|
| 不动 | 合约 ABI / 部署地址 / `ResolveDueMarkets.ts` 现有逻辑 / 130 forge test 必须全绿 |
| 可动 | `contracts/script/ops/` 新增脚本；`web/` 加少量 UI |
| 私钥存放 | 本地 `.env`（owner，已存在）+ 本地 `.env.seeds`（seed 池，新增），均 git-ignore，chmod 600 |
| 目标矩阵规模 | ≥ 25 同时活跃市场，主力周/月/季度；日级单 asset 各 1 个 |
| 钱包池规模 | 12 个 seed 钱包（10–15 中位） |
| 不做 | bot 真人化下注模拟；leaderboard 美化；自动 forceInvalid；i18n 切换；KMS/Vault；Slack/邮件告警 |

---

## 4. § 2 调度器 MarketScheduler

`contracts/script/ops/MarketScheduler.ts`，对外是一个 `npm run schedule` 命令，单次执行完即退出，由 launchd 每分钟拉起。每次执行体由四步组成。

### 4.1 配置：目标矩阵

```typescript
// contracts/script/ops/scheduler.config.ts
export type Cadence = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type Asset   = 'BTC' | 'ETH' | 'SOL';

export const CADENCE_DURATION: Record<Cadence, { betHours: number; resolveHours: number }> = {
  daily:     { betHours: 20,     resolveHours: 24    },  // 下注 20h，冷静 4h
  weekly:    { betHours: 7*24-4, resolveHours: 7*24  },
  monthly:   { betHours: 30*24-8, resolveHours: 30*24 },
  quarterly: { betHours: 90*24-12, resolveHours: 90*24 },
};

export const PYTH_PRICE_ID: Record<Asset, `0x${string}`> = {
  BTC: '0xe62...',  // 部署前用 cast 验证（见 §10 待验证清单）
  ETH: '0xff6...',
  SOL: '0xef0...',
};

// 同时活跃市场数目标 —— 主力周/月/季度，日级最少
export const TARGET_ACTIVE: Record<Asset, Record<Cadence, number>> = {
  BTC: { daily: 1, weekly: 3, monthly: 3, quarterly: 2 },
  ETH: { daily: 1, weekly: 3, monthly: 3, quarterly: 2 },
  SOL: { daily: 1, weekly: 2, monthly: 2, quarterly: 2 },
};
// 总计 = 3+9+8+6 = 26（≥ 25 目标活跃）

// 阈值阶梯：相对当前价的偏移（百分比），与活跃数等长
export const THRESHOLD_OFFSETS_PCT: Record<Cadence, number[]> = {
  daily:     [0],
  weekly:    [-3, 0, +3],
  monthly:   [-8, 0, +8],
  quarterly: [-15, 0, +15],
};
```

启动时校验：
- `TARGET_ACTIVE[a][c] === THRESHOLD_OFFSETS_PCT[c].length`
- Σ `TARGET_ACTIVE[a][c]` ≥ 25
- 每个 cadence `betHours < resolveHours`

### 4.2 四步流水线

```typescript
async function runOnce() {
  const snapshot = await scanActiveMarkets();      // 1. 只读
  const gaps     = computeGaps(snapshot);          // 2. 纯函数
  const created  = await createMissing(gaps);      // 3. owner 写链
  await ensureSeed(snapshot, created);             // 4. seed 池写链
}
```

**步骤 1 — `scanActiveMarkets`（只读）**

读 `marketCount`，分页 `getMarketsPaged`。把每个**未到 `betDeadline` 且 outcome == Unresolved** 的市场按 `(asset, cadence)` 归桶：
- asset 识别：用 `pythPriceId` 反查 `PYTH_PRICE_ID` 反向映射
- cadence 识别：用 `question` 文本里的 `[weekly]` 等 tag（详见 4.3）

**步骤 2 — `computeGaps`（纯函数）**

返回 `Array<{ asset, cadence, offsetPct }>`，表示需要新建的市场。原则：
- 缺哪一档只补哪一档
- 超额不删（等自然到期消失）
- 返回顺序按 (asset, cadence, offsetPct) lexicographic，保证可重现

**步骤 3 — `createMissing`（owner 钱包写链）**

对每个 gap：
- 从 Pyth Hermes 拉当前价 `current`（用现有的 hermes client）
- `threshold = round(current × (1 + offsetPct/100))`，按 Pyth feed expo 缩放
- `betDeadline = now + CADENCE_DURATION[c].betHours·3600`
- `resolveAfter = now + CADENCE_DURATION[c].resolveHours·3600`
- `question = formatQuestion(asset, threshold, resolveAfter, cadence)`（见 4.3）
- 调 `PredictionMarket.createMarket`，等 receipt，从 `MarketCreated` event 拿 `marketId`

每个 gap 独立 try-catch；任一失败记中文日志、继续下一个；下一轮 schedule 自然补足。

**步骤 4 — `ensureSeed`（seed 钱包池写链）**

对**所有未关闭**的市场（snapshot 已存在的 + created 新建的）检查是否已 seed。判据：
- 扫 `Bet` 事件从 `DEPLOY_BLOCK` 到 latest
- 过滤 `user ∈ SEED_WALLETS`，按 `id` 去重
- 没出现过 → 需 seed；已出现 → 跳过

需 seed 的市场：用 `pickSeedWallets(marketId, SEED_WALLETS)` 选 1–3 个；对每个钱包发"YES 一笔 + NO 一笔"，金额由 `seedAmount(marketId, walletIndex, side)` 决定（详见 §5）。

### 4.3 question 模板与 cadence 反查

模板：`{ASSET}/USD ≥ {THRESHOLD} @ {DATE_UTC} [{CADENCE_TAG}]`

- 例：`BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [weekly]`
- `[weekly]` tag 同时承担两个职责：给用户读 + 给脚本反查 cadence（合约没存 cadence）
- 解析正则：`/\[(daily|weekly|monthly|quarterly)\]$/`
- 解析失败 → 归入"未知 cadence"桶，不抵消任何 gap，前端在 All 以外的过滤里不显示

### 4.4 launchd 集成

新增 `~/Library/LaunchAgents/com.arcpredict.ops.schedule.plist`：

```xml
<key>Label</key><string>com.arcpredict.ops.schedule</string>
<key>WorkingDirectory</key><string>/path/to/ArcPredict/contracts/script/ops</string>
<key>ProgramArguments</key>
<array><string>/bin/bash</string><string>-lc</string><string>npm run schedule</string></array>
<key>StartInterval</key><integer>60</integer>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>/tmp/arc-predict-schedule.log</string>
<key>StandardErrorPath</key><string>/tmp/arc-predict-schedule.err.log</string>
```

systemd / cron 等价配置写进 `ops/README.md`。

### 4.5 故意不做

- ❌ 不做 checkpoint 文件 / 状态机持久化（无状态即简单）
- ❌ 不预先排队下一周市场（只补当下缺）
- ❌ 不让 threshold 在同一 gap 同一轮内随机抖动（用 marketId 做种 → deterministic）
- ❌ 不因 Pyth 单 asset 异常就放弃整轮（只跳过该 asset）

---

## 5. § 3 Seed 流动性策略

`ensureSeed` 步骤的细则。

### 5.1 何时触发

对每个 **未到 `betDeadline` 且 outcome == Unresolved** 的市场，扫 `Bet` 事件过滤 `user ∈ SEED_WALLETS`，按 `id` 去重。无任何 seed 钱包参与过 → 需 seed。

**事件扫描范围**：从合约 `DEPLOY_BLOCK`（写在 config）到 latest。Arc testnet log retention 一般够用；日后若收紧再加 checkpoint 优化。

### 5.2 钱包选择（确定性）

```typescript
function pickSeedWallets(marketId: bigint, seeds: Address[]): Address[] {
  const seedNum = Number(marketId % BigInt(2**32));
  const rng = mulberry32(seedNum);
  const k = 1 + Math.floor(rng() * 3);           // k ∈ {1, 2, 3}
  const pool = [...seeds];
  for (let i = 0; i < k; i++) {                  // Fisher-Yates 前 k
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, k);
}
```

**确定性意义**：任意次重试选同一批钱包；从已上链 Bet 事件能复现"应当还有谁"。

### 5.3 金额（确定性 + 双边对称不相等）

```typescript
function seedAmount(marketId: bigint, walletIndex: number, side: 'yes' | 'no'): bigint {
  const seedNum = Number(marketId % BigInt(2**32)) ^ walletIndex ^ (side === 'yes' ? 0 : 1);
  const rng = mulberry32(seedNum);
  const usdc = 1 + Math.floor(rng() * 10);       // 1–10 USDC
  return BigInt(usdc) * 1_000_000n;              // 6 decimals
}
```

**两边对称但不相等**：YES/NO 各自独立 RNG → 池子大体平衡但不刻意工整，更像真人。

**单市场总注入量级**：k=2 时约 4–40 USDC；上界 k=3 × 10 USDC × 2 边 = 60 USDC。

**钱包余额不足时**：若钱包当前 USDC < 25 USDC（约一次 seed 的安全 buffer），跳过该钱包、日志告警，由 topup 守护进程接管；其它被选中的钱包继续。

### 5.4 approve 模式

每个 seed 钱包**首次被使用**时对合约 `approve type(uint256).max`：
- 调度器启动时校验 `allowance(wallet, market)`
- 若 allowance < 即将下注金额 → 先发 approve 再发 bet
- approve 失败 → 跳过该钱包，记日志

max approve 合理，因为 seed 钱包**只持有 testnet USDC、只交互我们自己的合约**。

### 5.5 交易调度

- 同一钱包多笔 tx → 串行（nonce 必须递增），用 viem `pending` nonce 策略
- 不同钱包之间 → 并行
- 实现：按钱包分桶，桶内 Promise 串，桶间 `Promise.allSettled`
- 单市场 seed 总耗时 ≈ 2–4 秒（取决于 RPC 延迟）
- 5 个市场需要 seed 的最差情形 ≈ 10–20 秒，远低于 1 分钟节拍

### 5.6 兜底

- **单市场 seed 全部失败** → 不影响其它市场，下一轮重试
- **同一市场连续 N 轮 seed 失败** → 不特殊处理（仅日志标记），市场仍可正常 resolve；合约会判 Invalid，真人按 invalid 退款
- **整个 seed 池余额耗尽** → 跳过 seed 步骤，调度器仍照常造单；告警靠 § 6 的 topup

### 5.7 故意不做

- ❌ 不试图让 yesPool / noPool 接近某目标比例（自然演化交给真人）
- ❌ 不在市场快到期前补刀 seed（seed 是开局动作，不是持续介入）
- ❌ 不为 seed 钱包伪装 ENS / 姓名

---

## 6. § 4 钱包池与 faucet 顶配

### 6.1 钱包池生成与存储

一次性脚本 `npm run generate-seeds`：

- 用 viem `generatePrivateKey()` 生成 12 个 EOA
- 输出到 `contracts/.env.seeds`（git-ignore、chmod 600）：

```
SEED_WALLET_COUNT=12
SEED_PRIVATE_KEY_0=0x...
SEED_ADDRESS_0=0x...
SEED_PRIVATE_KEY_1=0x...
SEED_ADDRESS_1=0x...
...
```

- stdout 打印 12 个地址，owner 手动复制到 Circle faucet 领第一轮 testnet native + USDC
- 同时把公开地址数组写出到 `web/lib/seed-wallets.ts`（仅地址、无私钥）—— 由 `generate-seeds` 脚本同步写两边，避免人工对齐错位；存量地址若被撤换，重跑同步即可

**`.gitignore` 显式追加 `contracts/.env.seeds`**（现有规则 `.env*` 通常已覆盖，但显式声明更稳）；`web/lib/seed-wallets.ts` 是公开文件，**必须 commit**。

### 6.2 faucet 自动化分层

⚠️ **现实约束**：Circle faucet 是带 captcha 的网页，没有公开程序化 API。"全自动 faucet"在 Phase 16+ 起步阶段不存在干净方案。

**层 1 — 半自动（先实现）**：
- `npm run topup` 扫所有 seed 钱包余额
- 余额低于阈值的钱包写到 `/tmp/arc-predict-topup-needed.json` + stdout 打印"复制粘贴清单"
- 退出码 0（无需顶配） / 1（需顶配）→ launchd 日志可见

**层 2 — 自动探测（后续视情况实现）**：
- 第一次部署前 owner 手动用 devtools 抓 faucet 的 form-post endpoint
- 若可程序化调用 → 在 `topup` 里直接发请求
- 若必须 captcha → 永远停在层 1
- **不写假的层 2**：探测之前留空，README 写明状态

**层 3 — 完全失败（兜底）**：
- 余额极低（<5 USDC）→ ensureSeed 直接跳过该钱包
- 告警走 launchd 日志 + `/tmp/arc-predict-low-balance.log`

### 6.3 余额阈值

```typescript
export const BALANCE_THRESHOLDS = {
  warn:   10_000_000n,            // 10 USDC：faucet 冷启动期的临时最低健康线
  skip:    5_000_000n,            //  5 USDC：本轮 ensureSeed 跳过
  gasMin: parseEther('0.01'),     // 0.01 native：gas 不够跳过
};
```

`warn` 暂降到 10 USDC，作为 faucet 冷启动阶段的临时最低健康线：先保证 12 个 seed 钱包都能进入 healthy，等 faucet 供给稳定后再评估是否恢复更高 buffer。

### 6.4 launchd 集成

`com.arcpredict.ops.topup.plist`，`StartInterval=21600`（6h）。日志 `/tmp/arc-predict-topup.log`。

### 6.5 钱包池演化

- **新增**：`npm run generate-seeds --append=3` → 在文件末尾追加；调度器读 `SEED_WALLET_COUNT` 自动识别
- **撤换**：删整行并把后续行号回填保持连续；历史 Bet 事件中的去重判断仍有效
- **轮换节奏**：MVP 不做主动轮换；只在"owner 怀疑泄漏"时换

### 6.6 故意不做

- ❌ Slack / Telegram / 邮件告警
- ❌ KMS / Vault
- ❌ 调度器进程内做 faucet 重试

---

## 7. § 5 前端微调

### 7.1 视觉与语言基线

- **语言**：Phase 16+ 新增 UI 组件**默认英文**（filter / badges / seed disclosure）；存量中文页面保留现状，统一改造作为 follow-up
- **主题**：prediction-market 风格，**light / white 主色**为底；融合 Arc 网络元素（点缀，不喧宾夺主）
- **存量暖橙品牌色**：保留作为行动 / 获胜方 / 强调色（来自 `mockups/preview.html`）
- **Arc 元素**：因部署在 Arc testnet，UI 在 chain badge / TVL 数字 / 顶部状态条等"网络层"信息上引入 Arc 视觉线索。**具体色值、图形、字体由 web-design-engineer 在调研 Arc brand guideline 后决定，不在本 spec 硬编**

### 7.2 实施约束（给 web-design-engineer 的输入）

- 主色：white #FFFFFF / off-white #F8FAFC
- Arc accent：颜色待 web-design-engineer 调研
- 暖橙保留：用作强调（具体色值沿用 `mockups/preview.html` 既有规范）
- Typography：英文 sans-serif，具体字体 web-design-engineer 选；中文字体不冲突
- Mobile responsive 仍为强制要求
- **Implementation directive**：本节实现阶段由 `web-design-engineer` skill 接管视觉稿产出，先出 HTML/CSS mock → 用户审 → 落到 `web/` 组件；writing-plans 阶段会将这一指令转化为具体任务

### 7.3 Homepage：cadence / asset 过滤条

```
[All] [BTC] [ETH] [SOL]    |    [All] [Daily] [Weekly] [Monthly] [Quarterly]
```

- 默认 `All × All`
- 纯前端过滤，靠 `question` 文本里 `[weekly]` 等 tag，与调度器共用解析
- tag 解析失败的市场：仅在 `All` 视图出现

### 7.4 Homepage 头部：活跃 badges

```
26 active markets · 8 resolving this week · 1,243 USDC TVL
```

- `active` = `outcome === Unresolved && now < betDeadline`
- `resolving this week` = `resolveAfter ∈ [now, now + 7d]`
- `TVL` = Σ `yesPool + noPool`
- 全部来自现有 `getMarketsPaged` / `getDashboardLatest`，**不新加合约 view**

### 7.5 Market detail：流动性来源披露

```
~12 USDC from project seed liquidity
```

- 扫该市场 `Bet` 事件求和 `user ∈ SEED_WALLETS`
- seed 钱包公开地址清单：`web/lib/seed-wallets.ts`（**只放地址，不含私钥**；从 `contracts/.env.seeds` 的 `SEED_ADDRESS_*` 同步生成）
- 加载策略：和市场详情其它数据同批；loading 期间整段不显示

### 7.6 测试

继续走现有 `web/test/check_*.mjs` 模式：

- `check_market_filter.mjs`：构造含 `[weekly]` 等 tag 的 fixture，验证过滤
- `check_seed_disclosure.mjs`：构造 Bet 事件 fixture 含 seed / 非 seed 地址，验证求和
- 视觉稿不做自动化断言，只做 manual QA

### 7.7 故意不做

- ❌ 不引 next-i18next / 完整 i18n 切换
- ❌ 不重写存量中文页面
- ❌ 不在 spec 硬编 Arc 色值
- ❌ 不做"按 cadence 分 tab"路由结构

---

## 8. § 6 错误处理、回归与运维

### 8.1 调度器失败矩阵

| 失败点 | 行为 | 副作用 |
|---|---|---|
| Pyth Hermes 拉当前价超时 | 跳过该 asset 本轮所有 gap | 下一轮重试；其他 asset 不受影响 |
| `createMarket` revert（gas/owner 余额） | 记错误日志，跳过该 gap | 下一轮重试 |
| `createMarket` 上链但 receipt 超时 | 不重试本轮 | 下一轮 scan 看到市场已在，gap 自然消失 |
| `ensureSeed` 某钱包 approve / bet revert | 跳过该钱包 | 下一轮可能再补，幂等性靠 Bet 事件 |
| RPC 整体不通 | 整轮失败，进程退出非 0 | launchd 下一分钟拉起 |
| Hermes 返回价格 ≤ 0 / 非数 | 跳过该 asset，告警 | 持续异常人工介入 |
| question tag 解析失败 | 归入"未知 cadence" | 不抵消 gap；前端 All 以外不显示 |

**核心不变量**：任何单点失败不影响其它 asset / cadence / 市场。每个 gap 独立 try-catch。

### 8.2 owner nonce 协调

两个进程都用 owner 私钥（调度器 `createMarket`，结算器 `resolve`）。

- 两者**时间窗不重叠**：调度器只动未到 `betDeadline` 的市场，结算器只动已到 `resolveAfter` 的，中间隔了"冷静期"（resolveHours − betHours）
- 唯一交集是 nonce：用 viem 默认 `pending` nonce 策略；进程内串行写交易
- 偶发并发冲突 → 后到 tx 被 RPC 拒（underpriced / nonce too low） → 下轮重试
- **不引入文件锁**

### 8.3 回归

合约不动 → `forge test` 必须仍然 130 passed，新增脚本不改任何 `.sol` 文件。

新增 TypeScript 测试（在 `contracts/script/ops/test/`，沿用现有 `check_*.mjs` + node:test）：

- `check_scheduler_config.mjs`：矩阵与阶梯长度一致；betHours < resolveHours；Σ active ≥ 25
- `check_compute_gaps.mjs`：snapshot fixture → gap 输出正确（缺补、超不删）
- `check_question_tag.mjs`：模板正反对称；解析失败回 'unknown'
- `check_pick_seed_wallets.mjs`：同 marketId 多次调用同结果；分布合理
- `check_seed_amount.mjs`：金额 ∈ [1, 10] USDC；YES/NO 独立
- `check_ensure_seed_idempotent.mjs`：含 seed Bet 事件输入 → 不重复 seed
- `check_topup_threshold.mjs`：余额 vs 阈值的分类正确

web 端新增（沿用 `web/test/check_*.mjs`）：

- `check_market_filter.mjs`
- `check_seed_disclosure.mjs`

### 8.4 ops runbook（写进 `ops/README.md`）

**首次启用**：
1. `npm run generate-seeds` → 把地址清单复制到 Circle faucet 领第一轮
2. `npm run topup` 验证 12 个钱包余额 ≥ 10 USDC（faucet 冷启动期的临时最低健康线）
3. `DRY_RUN=1 npm run schedule` 验证目标矩阵正确
4. 加载 launchd plist：`schedule` / `topup`（`resolve` 已在跑）

**日常巡检**：
- 每天扫一次 `/tmp/arc-predict-topup-needed.json`，非空 → 去 faucet 领
- 看 `/tmp/arc-predict-schedule.err.log` 是否同一 asset 连续失败
- 周期性确认前端 badge "active ≥ 25"

**故障**：
- schedule 持续失败 → 先查 owner native 余额（gas）
- seed 持续失败 → 查 seed 钱包 native 余额（gas，不是 USDC）
- Hermes 价格异常 → 卸 schedule launchd，人工介入

**回滚**：
- 关 launchd `schedule` 和 `topup`；`resolve` 不动
- 合约不动；已建市场继续按原节奏到期、结算、claim
- 前端过滤 / badges / 披露 hint 通过 `NEXT_PUBLIC_PHASE16_ENABLED=false` 整段隐藏

### 8.5 故意不做

- ❌ Sentry / 任何 SaaS observability
- ❌ gas oracle（用 viem 默认）
- ❌ seed 钱包 nonce 调度优化（不同钱包天然并行）
- ❌ "创建过的市场归档"机制

---

## 9. 不变量与约束（集中归纳）

| ID | 不变量 |
|---|---|
| INV-1 | 合约 ABI / 部署地址不变；`forge test` 仍 130 passed |
| INV-2 | 任何单点失败不污染其它 asset / cadence / 市场处理 |
| INV-3 | `ensureSeed` 幂等性以"链上是否有 seed 钱包的 Bet 事件"为唯一判据 |
| INV-4 | `pickSeedWallets` / `seedAmount` 对同一 (marketId, walletIndex, side) deterministic |
| INV-5 | 调度器、结算器、topup 三个进程关注点分离，日志互不污染 |
| INV-6 | 私钥不进 git；`.env.seeds` chmod 600 |
| INV-7 | 不引入新合约 view；前端聚合靠现有 ABI |
| INV-8 | seed 钱包公开地址清单在前端可见（`seed-wallets.ts`），用于披露 |
| INV-9 | `question` 文本里 `[cadence]` tag 是脚本反查 cadence 的唯一可靠源 |
| INV-10 | 不引入消息推送告警；运营靠 launchd 日志 + 本地 json |

---

## 10. 实施依赖与待验证

实现前必须用 `cast` / `curl` 验证的事实：

1. **Arc testnet 上 BTC/ETH/SOL 的 Pyth priceId**：`PYTH_PRICE_ID` 三个值从 Pyth 官方 doc 获取，并在 Arc testnet 上用一个临时市场跑通一次"创建 → 等到 resolveAfter → ResolveDueMarkets 结算成功"完整路径，三个 asset 都要走一遍。
2. **Circle faucet endpoint**：手动用浏览器 devtools 抓 form-post URL + payload + 是否 captcha。这决定 § 4 是否能从层 1 升到层 2。
3. **Arc brand guideline 可用色 / 图形元素**：web-design-engineer 调研产出 mock 后纳入实施。
4. **Arc testnet log retention 实际窗口**：用 `eth_getLogs` 跨较大区块范围测试，确认 § 5.1 的"扫整段历史"策略不会失败。

---

## 11. 落地交付物清单

新增 / 修改文件大致清单（writing-plans 阶段细化）：

```
contracts/script/ops/
├── MarketScheduler.ts            (新增)
├── TopUpSeeds.ts                 (新增)
├── GenerateSeeds.ts              (新增)
├── scheduler.config.ts           (新增)
├── lib/                          (新增 - 共享：viem clients、hermes、RNG、tag 解析)
├── test/
│   ├── check_scheduler_config.mjs
│   ├── check_compute_gaps.mjs
│   ├── check_question_tag.mjs
│   ├── check_pick_seed_wallets.mjs
│   ├── check_seed_amount.mjs
│   ├── check_ensure_seed_idempotent.mjs
│   └── check_topup_threshold.mjs
├── package.json                  (加 schedule / topup / generate-seeds)
└── README.md                     (扩 runbook)

contracts/
└── .env.seeds                    (本地生成，git-ignore)

web/
├── lib/seed-wallets.ts           (新增：公开地址清单)
├── lib/cadence-tag.ts            (新增：与脚本共用的解析)
├── components/
│   ├── MarketFilterBar.tsx       (新增)
│   ├── ActivityBadges.tsx        (新增)
│   └── SeedDisclosure.tsx        (新增)
├── test/
│   ├── check_market_filter.mjs   (新增)
│   └── check_seed_disclosure.mjs (新增)
└── (各页面接入)

ops launchd / systemd:
├── com.arcpredict.ops.schedule.plist
└── com.arcpredict.ops.topup.plist

docs/
└── superpowers/specs/2026-06-11-arc-predict-phase16-design.md  (本文件)
```

---

## 12. 与现有 spec / plan 的关系

- `docs/superpowers/specs/2026-06-07-arc-predict-design.md`（v3）：**合约层真相源**，本文件不覆盖、不修订
- `docs/superpowers/plans/2026-06-08-arc-predict-mvp.md`：MVP 实施计划，已全部完成
- 本文件是 Phase 16+ 的**增量层 spec**；writing-plans 会基于本文件产出 `docs/superpowers/plans/2026-06-11-arc-predict-phase16.md`

---

*Spec 版本：v1（草案，待用户终审）*
