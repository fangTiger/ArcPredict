# Design: ai-lens

## 目的

为已实现的 AI Lens 能力记录当前技术决策与架构形态。本文是 `openspec/specs/ai-lens/spec.md` 的伴生文件，对应实施期的详细设计在 `docs/superpowers/specs/2026-06-15-ai-lens-design.md`，实施期的实施计划在 `docs/superpowers/plans/2026-06-16-ai-lens.md`。

## 架构形态（已落地）

```
浏览器（点击 ✨ Ask AI / Generate AI Lens）
    │
    ▼
POST /api/lens/[marketId]            ← web/app/api/lens/[marketId]/route.ts
    │
    ├─ Cache lookup (createMemoryCache, key = marketId + inputHash)
    │     │
    │     ├─ HIT  → 直接返回 JSON（cached: true 字段保留在 API 层但 UI 不渲染）
    │     └─ MISS ↓
    │
    ├─ handleLensRequest (web/lib/lens/route-handler.ts)
    │     ├─ 调 DeepSeek (web/lib/lens/llm.ts, 原生 fetch, 5s timeout, 4xx 不重试除 408/429)
    │     ├─ Zod 强校验 (web/lib/lens/schema.ts, selectOutputSchema(type))
    │     ├─ 记录预算 (web/lib/lens/budget.ts)
    │     └─ 失败返回 safeErrorMessage（不泄密）
    │
    └─ 写缓存（只在 schema 通过后写）
```

## 关键模块

| 模块 | 路径 | 职责 |
| --- | --- | --- |
| Schema | `web/lib/lens/schema.ts` | Zod 输入输出契约 + 禁止词扫描 + `selectOutputSchema(type)` |
| Prompts | `web/lib/lens/prompts.ts` | system prompt 五条铁律 + 强制英文输出 + sources[].ts unix 秒约束 |
| Cache | `web/lib/lens/cache.ts` | 内存 Map + 可选文件持久化（`loadCacheDumpFromFile` / `saveCacheDumpToFile`） |
| Budget | `web/lib/lens/budget.ts` | 日预算累计 + UTC 重置 + 价格 token 估算 |
| LLM Client | `web/lib/lens/llm.ts` | 原生 fetch + 超时/重试/4xx 区分 |
| Route Handler | `web/lib/lens/route-handler.ts` + `web/app/api/lens/[marketId]/route.ts` | POST 入口 lazy 读 env，handleLensRequest 纯函数 |
| Context: Crypto | `web/lib/lens/contextBuilders/crypto.ts` | Pyth 价格采样 + 波动率 + sigma 距离 + seconds_to_resolve |
| Context: Event | `web/lib/lens/contextBuilders/event.ts` | 从 worldcup-facts.json 读静态事实 |
| 事实表种子 | `web/data/worldcup-facts.json` | admin 维护的世界杯静态事实表 |
| UI: DriftChip | `web/components/AILensDriftChip.tsx` | rich/cheap/aligned 标签 |
| UI: Gauge | `web/components/AILensGauge.tsx` | binary 水平条 + multi 堆叠条形 |
| UI: Compact | `web/components/AILensCompact.tsx` | 市场卡底部 idle/loading/expanded result/error 状态机 |
| UI: Panel | `web/components/AILensPanel.tsx` | 详情页完整面板 + Why? 折叠 + 永久 disclaimer |

## 取舍记录

### 选 DeepSeek 而非 Anthropic / OpenAI
- 成本：DeepSeek V4 价格约 Anthropic Haiku 的 1/4
- 接口：DeepSeek 原生 REST 即 OpenAI 兼容格式，不需要 OpenAI 包装库

### v1 范围裁剪（推迟到 v1.1）
- **SSE 流式打字**：用户已确认接受非流式 UX，节省前端 EventSource 接入工作量
- **IP token bucket 速率限制**：依赖全局日预算护栏 + 共享缓存即可，早期流量小

### 用户主动触发 vs 被动渲染
- 原设计是"被动永远在场"，用户反馈"操作最少 + 效果最强 + 接口三方"后改为"主动触发"
- 共享缓存红利保留：第一个用户烧 token 后，TTL 内所有人秒返

### in-place expand vs 模态
- Compact 展开走 in-place（同卡片内），不走模态——便于横向比较多市场，不打断浏览流

### 多结果 implied probability
- W3 Review 发现 multi gauge 缺 per-outcome implied，schema 已扩展 `outcome_implied_probabilities: Record<string, number>` 强制必填
- 详情页与卡片接入时按市场实际 `outcomes[].impliedProbability` 填入，不允许自造

### seconds_to_resolve
- 发现 LLM 在 prompt 里看到 `end_time` 时会自行推断"距今多少年"，且经常算错
- 解决：context 显式喂 `seconds_to_resolve`，system prompt 强约束"使用 context 提供的值，禁止自估时间"

## 测试矩阵

| 维度 | 测试位置 | 用例数 |
| --- | --- | --- |
| Schema（含禁止词、binary/multi 判别、ISO ts 兼容、seconds_to_resolve） | `web/test/lens.schema.test.ts` | 9 |
| Prompts（五条铁律 + 英文输出 + unix 秒） | `web/test/lens.prompts.test.ts` | 3 |
| Cache（hit/miss/TTL/inputHash 稳定/文件 dump） | `web/test/lens.cache.test.ts` | 7 |
| Budget（累计/上限/UTC 重置/cost 估算） | `web/test/lens.budget.test.ts` | 4 |
| Crypto Context（波动率/sigma/采样/seconds_to_resolve） | `web/test/lens.context-crypto.test.ts` | 5 |
| Event Context（global/by_team/未知 team） | `web/test/lens.context-event.test.ts` | 3 |
| LLM Client（成功/401 不重试/404 不重试/408 重试/429 重试/网络重试/非 JSON 抛错） | `web/test/lens.llm.test.ts` | 7 |
| Route（miss/hit/budget/schema_failure/泄密/TTL 透传/invalid 等） | `web/test/lens.route.test.ts` | 7 |
| Compact（idle/loading/result expand/error/Hide/Cached 字样无） | `web/test/lens.compact.test.tsx` | 5 |
| Panel（idle/result/Why? 折叠/multi 分支/disclaimer/Cached 字样无） | `web/test/lens.panel.test.tsx` | 5 |
| 集成（市场卡 Ask AI 按钮发送正确 LensInput） | `web/test/worldcup-components.test.tsx` | ~2（含 lens 集成） |
| Live smoke（真实 DeepSeek + 双类市场） | `web/test/lens.deepseek-live.test.ts` | 2（默认 skip，`LENS_LIVE_SMOKE=1` 解锁） |

**合计**：88 个常规测试 PASS + 2 个 live skipped。`pnpm vitest run` / `pnpm typecheck` / `pnpm lint` / `pnpm build` 全绿，`/api/lens/[marketId]` 出现在 Next 14 路由表。

## 后续可能性（不在当前实现）

- 接入 SSE 流式（前端 EventSource，后端 streaming response）
- 引入基于 IP 的 token bucket 速率限制
- 把 cache 升级到 Vercel KV / Redis 以支持多实例
- 给详情页 `seconds_to_resolve` 也接入到事件市场 context builder
- 多语言切换（目前 hard-code 英文输出）
- 历史 Lens 时间轴（看"AI 当时说什么"）
