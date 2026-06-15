# ArcPredict · AI Lens 设计文档

> 日期：2026-06-15
> 范围：ArcPredict 前端（`web/`）新增一类"按需触发的 AI 公允概率透镜"功能
> LLM 供应商：DeepSeek（V4，原生 SDK）
> 业务侵入：零（合约层不动；不参与链上结算）
> 状态：Draft · 待用户复核

---

## 0. 设计哲学

ArcPredict 在视觉、品类、提交素材方面已经齐备；下一站要让产品具备**与同类预测市场不同的"信息密度"差异化**。

AI Lens 不是 chatbot，也不是投顾——它是一台**按用户请求运行的概率参考机**：用户对某个市场感兴趣，点一下，系统现场用 DeepSeek 综合可见的数据源（Pyth 价格 / 市场状态 / 静态事实表）输出一段**结构化的公允概率估计 + 影响因素 + 数据来源**，与市场当前隐含概率并列展示。

设计铁律：
- **用户主动触发**：永远不在背景烧 token；点了才生成
- **结构化输出**：JSON schema 强约束，禁止任何"买入/卖出/建议下注"措辞
- **数据透明**：所有 AI 引用的事实必须可溯源，免责脚标常驻
- **共享缓存**：同一市场的首次触发结果在 TTL 内对所有人免费命中

---

## 1. 用户体验（UX）

### 1.1 市场卡（列表 / 首页 / 世界杯版面 compact 形态）

每张市场卡底部追加一行高度约 32px 的 Lens 占位条，与卡片其余玻璃质感统一。

四种状态：

| 状态 | 视觉 | 触发条件 |
| --- | --- | --- |
| **idle** | 左：`✨ Ask AI` 玻璃胶囊按钮 / 右：灰色小字 `AI 概率分析 · 24h 缓存共享` | 该市场缓存未命中 |
| **loading** | 按钮内嵌 spinner，文字 `Analyzing…` | 用户点击后 → 调 DeepSeek |
| **result** | 一句话总结（≤ 60 字符 ellipsis）+ drift chip（`市场 32% / AI 19%–25% ↑rich`）；右上铅笔图标 = regenerate | LLM 返回成功且通过 schema 校验 |
| **cached** | 同 result，附右上小字 `Cached · updated 14m ago` | 用户点击时直接命中共享缓存 |

drift chip 配色复用 Synthra 调色板：
- `↑rich`：heat（暖红）
- `↓cheap`：arc-glow（电气青）
- `≈ aligned`：ink-3（灰）

### 1.2 详情页（full 形态）

详情页 12 栅格主区，在 `MarketDetailCard` 下方插入 `<AILensPanel>`。

四种状态：

**idle**
```
┌──────────────────────────────────────────────┐
│            ✨ Generate AI Lens                │
│                                              │
│   AI 综合 Pyth 价格 / 市场状态 / 事实表       │
│   给出公允概率区间，仅供参考、非投顾建议       │
└──────────────────────────────────────────────┘
```

**loading**：按钮区变成 SSE 流式文本框，DeepSeek 逐字打字 summary（演示张力来自这里）

**result**：完整面板，自上而下：
1. **Fair-Probability Gauge**：水平条 0–100%，市场隐含概率（实心 marker）vs AI 区间（半透明带）
2. **Top Factors**：3–5 个影响因素 bullet（玻璃子卡片）
3. **Sources**：结构化 chip `Pyth · BTC/USD · 2026-06-15 17:12 UTC`
4. **Why?** 折叠：展开显示 reasoning（200–400 字 LLM 推理链）
5. **Footer**：右下 `↻ Regenerate`（60s 冷却 + 同 IP 限流），左下永久免责脚标 `AI estimate. Not financial advice. Not a settlement oracle.`

**cached / result**：与上述 result 完全相同，仅时间戳变化

### 1.3 失败与降级

| 场景 | 行为 |
| --- | --- |
| DeepSeek 5s 超时 | 重试一次（指数退避 500ms）；仍失败 → 显示 `AI Lens 暂不可用，请稍后重试`；按钮恢复可点 |
| 输出 schema 校验失败 | 不写缓存；回退 idle，console.warn |
| 日预算上限触达 | 按钮置灰；hover tooltip `Daily AI budget reached — try again tomorrow` |
| 用户网络断开 | 客户端 catch；提示重试 |
| 价格在缓存窗口内漂移 > 5% | 因 inputHash 含价格快照，下次访问自然命中 miss，按 idle 处理 |

### 1.4 共享缓存红利

- 触发缓存的"第一个人"承担 ~$0.0003 LLM 成本
- 后续任意用户在 TTL 内（crypto 6h / event 24h）点 `Ask AI`，命中共享缓存 → 0 token 烧、瞬时显示
- `Regenerate` 强制 bypass，限流：60s 冷却 / 同 IP 同市场最多 5 次/小时

---

## 2. 架构与数据流

### 2.1 链路图

```
浏览器（点击 ✨ Ask AI）
    │
    ▼
POST /api/lens/[marketId]          ← Next 14 Route Handler
    │
    ├─ Cache lookup (key = marketId + inputHash)
    │     │
    │     ├─ HIT  → 直接返回 JSON
    │     └─ MISS ↓
    │
    ├─ 构造 context_bundle
    │     ├─ market_meta（题面 / 类型 / end_time / 隐含概率）
    │     ├─ crypto 市场：Pyth 近 7d 价格、波动率、距阈值 σ
    │     └─ event 市场：静态事实表条目（球队 / 战绩 / 对阵）
    │
    ├─ DeepSeek 原生 SDK 调用
    │     ├─ model: DEEPSEEK_MODEL（默认 deepseek-v4，env 可覆盖）
    │     ├─ response_format: { type: 'json_object' }
    │     ├─ stream: true（仅详情页 SSE 透传）
    │     └─ 5s 超时 + 1 次重试
    │
    ├─ Zod schema 校验
    │     └─ 失败 → reject，不写缓存
    │
    └─ 写缓存 + 返回 JSON
```

### 2.2 文件清单

新增（全部位于 `web/`）：

```
web/
├── app/
│   └── api/
│       └── lens/
│           └── [marketId]/
│               └── route.ts            ← Route handler（POST 触发 / GET 读缓存）
├── lib/
│   └── lens/
│       ├── llm.ts                       ← DeepSeek 原生 SDK 封装
│       ├── prompts.ts                   ← 系统提示词 + 上下文模板
│       ├── schema.ts                    ← Zod 输入输出契约
│       ├── cache.ts                     ← KV 抽象（v1 内存/文件，可切 Vercel KV）
│       ├── budget.ts                    ← 日预算计数器 + 限流
│       └── contextBuilders/
│           ├── crypto.ts                ← Pyth 历史 + 阈值距离
│           └── event.ts                 ← 读 worldcup-facts.json
├── components/
│   ├── AILensCompact.tsx                ← 市场卡占位条
│   ├── AILensPanel.tsx                  ← 详情页完整面板
│   ├── AILensGauge.tsx                  ← Fair-Probability 双层条
│   └── AILensDriftChip.tsx              ← rich/cheap/aligned 标签
├── data/
│   └── worldcup-facts.json              ← 事件市场静态事实表（admin 维护）
└── test/
    ├── lens.schema.test.ts              ← Zod schema 单测
    ├── lens.cache.test.ts               ← 缓存键 / TTL / 失效逻辑
    └── lens.prompts.test.ts             ← prompt 构造快照
```

修改：
- `web/components/MarketCard.tsx` / `WorldCupMarketCard.tsx` / `CryptoMarketCard.tsx` / `BaseMarketCard.tsx`：底部 slot 接入 `<AILensCompact>`
- `web/app/market/[id]/page.tsx`（或对应详情页路径）：`MarketDetailCard` 下接入 `<AILensPanel>`
- `web/next.config.js` / 环境变量：新增 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`LENS_DAILY_BUDGET_USD`、`LENS_CRYPTO_TTL_HOURS`、`LENS_EVENT_TTL_HOURS`

合约 / contracts / ops：不动。

### 2.3 LLM 输入/输出契约（Zod）

**输入（构造给 DeepSeek 的 user message JSON）：**
```ts
{
  market: {
    id: string,
    question: string,
    type: 'crypto-binary' | 'event-multi',
    end_time: number,              // unix seconds
    implied_probability: number,   // 0-1 当前市场隐含
    outcome_options?: string[]     // 事件市场结果项
  },
  context: {
    // crypto 市场
    pyth_recent?: { ts: number, price: number }[],   // 近 7 天采样
    volatility_30d?: number,
    distance_to_threshold_sigma?: number,
    // 事件市场
    facts?: { key: string, value: string, source: string }[]
  },
  generated_at: number             // unix seconds
}
```

**输出（DeepSeek 必须返回的 JSON）：**
```ts
{
  summary: string,                 // ≤ 280 字符
  factors: string[],               // 3–5 项，每项 ≤ 120 字符

  // 二元市场用 fair_range；多结果市场用 outcome_fair_probabilities；
  // 二者必填其一，根据 market.type 决定（schema 用 discriminated union）
  fair_range?: [number, number],   // crypto-binary 专用：[low, high] ∈ [0,1]，low ≤ high
  outcome_fair_probabilities?: {   // event-multi 专用：每个结果项的概率区间
    [outcome: string]: [number, number]  // 各区间 low/high ∈ [0,1]；区间中点之和应 ≈ 1
  },

  confidence: 'low' | 'med' | 'high',
  reasoning: string,               // ≤ 800 字符
  sources: { name: string, ref: string, ts: number }[],
  caveats: string[]                // ≤ 3 项，AI 自评的不确定性条款
}
```

对应的 `<AILensGauge>` 也分两种渲染：
- 二元：水平条 + 双层 marker / 区间带（如 §1.2 所述）
- 多结果：垂直堆叠条形图，每个结果项一行，市场隐含 vs AI 区间并列

输出由 `web/lib/lens/schema.ts` Zod 强校验；任何字段缺失 / 越界 / 含禁止词（见 §3.3）→ 整次结果作废。

### 2.4 缓存策略

| 维度 | 规则 |
| --- | --- |
| Cache Key | `lens:${marketId}:${inputHash}` |
| inputHash | sha1(JSON.stringify(market) + JSON.stringify(context))，截 8 字符 |
| TTL（crypto） | `LENS_CRYPTO_TTL_HOURS=6` 兜底；价格快照纳入 `inputHash`，价格漂移 > 5% 时下次读取自动 miss（lazy 失效，无后台扫描） |
| TTL（event） | `LENS_EVENT_TTL_HOURS=24` 兜底；事实表文件 mtime / 哈希纳入 `inputHash`，admin 改了表 → 下次读自动 miss |
| 存储后端 v1 | 进程内 Map + 进程退出前 dump JSON 文件 `cache/lens.json`（够 demo） |
| 存储后端 v2（不在 v1） | Vercel KV / Redis；通过 `cache.ts` 抽象层切换 |
| Concurrent dedup | 同 key 的 in-flight 请求合并（Promise 复用） |

### 2.5 DeepSeek 客户端约定

- 用 DeepSeek **原生 SDK**（不走 openai-compat 兼容封装）
- baseURL / auth header / payload schema 以 DeepSeek 官方文档为准（详细 endpoint 字符串在实现时确认）
- 模型 id 通过 `DEEPSEEK_MODEL` 环境变量注入，默认值 `deepseek-v4`（**实施前请用最新官方文档核对准确的 model id**）
- API key 永远只在服务端读取；客户端任何路径不接触
- 请求 timeout = 5s；retry = 1（500ms 指数退避）
- 详情页支持 SSE 流式（DeepSeek 原生支持），列表卡走非流式批量响应

---

## 3. 成本、护栏与合规

### 3.1 成本估算（DeepSeek V4 定价代入）

按 ~20 活跃市场 + ~10 DAU + 24h/6h TTL + 用户主动触发 + 共享缓存：

| 项 | 估算 |
| --- | --- |
| 单次 LLM miss 成本 | ~$0.00026（600 input + 200 output tokens） |
| 日 miss 次数 | 20–50 次（每市场最多 24h 内一次） |
| 日总成本 | **$0.005–$0.015** |
| 月总成本 | **$0.15–$0.50** |

### 3.2 日预算硬上限

- 环境变量：`LENS_DAILY_BUDGET_USD`（默认 `1.0`）
- 每次 LLM 调用前 `budget.ts` 检查累计美元 → 超额返回 `429 budget_exhausted`
- 前端展示按钮置灰 + tooltip 文案
- UTC 0:00 重置（demo 期；生产再考虑滚动窗口）

### 3.3 Prompt 安全铁律（写入 system prompt）

1. **只输出 schema 内 JSON**，禁止任何对话性前缀 / 解释
2. **禁止任何"建议下注/买入/卖出/All-in/建议加仓"措辞**——只能在 `factors` 和 `reasoning` 里描述事实与概率推理
3. **任何不在 `context_bundle` 里的"事实"必须用 `[unverified]` 前缀**
4. **`confidence: high` 仅当 ≥ 2 个 sources 印证**；单源最多 `med`
5. **`fair_range` 宽度 < 5pp 时强制降级 confidence**（防止 AI 过度自信）

后端额外做正则黑名单扫描 `summary` / `factors` / `reasoning`，命中禁止词整次作废。

### 3.4 速率限制（防滥用）

| 维度 | 限制 |
| --- | --- |
| 同 IP 全局 | 60 次/小时 |
| 同 IP 同市场 | 5 次/小时 |
| Regenerate 单次冷却 | 60s |
| Anonymous 不限速 vs 钱包用户提升上限 | v1 不区分（demo 期简化） |

---

## 4. 信任与合规

- **永久免责脚标**：每个 Lens 形态底部都展示 `AI estimate based on listed sources. Not financial advice. Not a settlement oracle.`
- **数据来源透明**：每条结论必须有对应 `sources` 条目（含名称、引用、时间戳）
- **链上隔离**：AI 输出永远只在 UI 层呈现，**不会写入合约 / 不参与 EventMarket 结算 / 不被 AdminEventOracle 引用**
- **可审计**：缓存 JSON 包含 LLM 原始响应 + 输入摘要，便于事后追溯
- **a11y**：所有 Lens 组件遵循 `prefers-reduced-motion`（不自动跳动），焦点环复用现有 hair token

---

## 5. 测试策略

### 5.1 单元测试

- `lens.schema.test.ts`：Zod 输出校验（合法 / 越界 / 缺字段 / 含禁止词）
- `lens.cache.test.ts`：key 构造、TTL 过期、价格漂移失效、in-flight 合并
- `lens.prompts.test.ts`：上下文构造快照（crypto 与 event 两类）
- `lens.budget.test.ts`：累计、上限触发、UTC 重置

### 5.2 集成测试（mock DeepSeek）

- `/api/lens/[marketId]` happy path（miss → 调 LLM → 写缓存 → 返回）
- cache hit path（无 LLM 调用）
- timeout / retry / 降级返回 503
- budget exhausted → 429
- Zod 校验失败 → 不写缓存 + 返回错误码

### 5.3 端到端（手工或 Playwright，v1 选其一）

- 详情页点击 `Generate AI Lens` → 流式打字 → 完整面板呈现
- 列表卡点击 `✨ Ask AI` → result 状态 → 二次访问命中 cached
- Regenerate 冷却生效
- 失败态文案与按钮恢复

### 5.4 LLM 输出抽样人工评估

- demo 前抽样 ≥ 20 个市场的实际生成输出，人工打分：
  - 事实正确性
  - 是否含禁止措辞
  - `fair_range` 是否合理
  - sources 是否可溯源
- 抽样结果写到 `docs/superpowers/qa/2026-06-XX-ai-lens-sampling.md`

---

## 6. 范围外（v1 不做）

- 个性化分析（基于用户已有仓位的对冲建议）
- 推送 / 邮件 / Web Push 通知
- 多 LLM 供应商 failover
- 真实 newsfeed 接入（v1 用静态事实表 + admin 手维护）
- AI 输出参与链上结算（永久不做）
- 多语言（v1 仅中英两语，提示词在 `prompts.ts` 写双语版本）
- 历史 Lens 时间轴 / "AI 当时说什么"回看
- Vercel KV / Redis 持久化（v1 用进程内 + 文件 dump）

---

## 7. 开放问题（待决策 / 待实施时核对）

1. **DeepSeek V4 准确 model id 字符串**：实施前请用 DeepSeek 官方最新文档核对（V4 / R 系列 / 是否需要 `-chat` / `-reasoner` 后缀）
2. **事实表初始内容**：世界杯阶段进度、对阵、近期战绩——admin 何时填、由谁维护？
3. **价格漂移失效阈值 5%**：是否需要按市场类型区分（短期市场可能要更敏感）？
4. **anonymous vs 钱包用户限速差异**：是否在 v1 引入（影响后端用户标识逻辑）？
5. **失败重试次数**：1 次够吗？DeepSeek 偶尔波动场景下要不要升到 2 次？

---

## 8. 与现有架构的兼容性确认

- 合约层：零侵入
- ops 脚本：零侵入（事实表 JSON 由 admin 直接 PR）
- 现有视觉系统：`AILens*` 组件全部使用 Synthra 调色板 token（glass / hair / arc-glow / heat / yes / no），不引入新色
- 现有数据流：从合约读市场状态的链路不变；AI Lens 是叠加在 UI 层的旁路功能
- ETHGlobal 提交素材：v1 上线后可以补一张 `screenshot-06-ai-lens.png`，但不阻塞当前提交

---

*本设计严格遵循 ArcPredict 项目"规范先行、合约层不动、UI 层叠加"原则；DeepSeek 调用、Prompt 内容、缓存策略全部在 `web/lib/lens/` 内自洽，可在不影响其余系统的前提下独立实现、测试与回滚。*
