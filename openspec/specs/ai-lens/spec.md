# Capability: ai-lens

## Purpose

ArcPredict 的 **AI Lens** 是一个用户主动触发的"公允概率参考机"。它在 UI 层叠加于每个市场之上：用户在市场卡或详情页点击 `Ask AI` / `Generate AI Lens`，前端 POST 到 `/api/lens/[marketId]`，后端通过 DeepSeek 原生 fetch 调用 LLM，结合市场元信息与上下文（Pyth 价格 / 静态事实表）生成结构化输出（公允概率区间 + 影响因素 + 数据来源），与市场隐含概率并列展示。AI Lens 永远只在 UI 层呈现，**绝不参与链上结算或写入合约**。

## Requirements

### Requirement: 用户主动触发

系统 SHALL 仅在用户显式点击触发按钮时调用 LLM；除 MarketSource cron 在新建自动化市场后的 best-effort Lens 预生成路径外，不允许在页面加载、轮询或其他后台路径中预生成 Lens 内容。

#### Scenario: 列表页首次访问不触发 LLM
- **WHEN** 用户首次打开 `/`，浏览市场列表
- **THEN** 后端 SHALL 不向 DeepSeek 发起任何请求
- **AND** 市场卡底部 SHALL 显示 idle 态 `Ask AI` 按钮，不显示任何 AI 内容

#### Scenario: 点击触发生成
- **WHEN** 用户点击某张市场卡的 `Ask AI` 按钮
- **THEN** 前端 SHALL 向 `/api/lens/[marketId]` 发送 POST 请求
- **AND** 后端 SHALL 在缓存未命中时调用 DeepSeek 并返回结果
- **AND** 同一 `(marketId, inputHash)` 的后续请求在 TTL 内 SHALL 从共享缓存秒返，不再调用 LLM

### Requirement: 输出结构化与禁止建议性措辞

系统 SHALL 通过 Zod schema 对 LLM 输出做严格校验，并禁止任何投顾性、建议性措辞。

输出字段包含：
- `summary`: ≤ 280 字符的一句话总结
- `factors`: 3–5 项影响因素，每项 ≤ 120 字符
- 二元市场 `fair_range`: `[low, high]`，均 ∈ [0, 1]，low ≤ high
- 多结果市场 `outcome_fair_probabilities`: 每个 outcome 一个 `[low, high]` 区间，至少 2 项
- `confidence`: `low` / `med` / `high`
- `reasoning`: ≤ 800 字符的推理链
- `sources`: 数据来源数组，每项含 name / ref / ts（unix 秒，兼容 ISO 字符串自动转换）
- `caveats`: ≤ 3 项不确定性条款

禁止词包含且不限于：`建议下注`、`建议买入`、`建议卖出`、`建议加仓`、`recommend buy`、`recommend sell`、`recommend bet`、`all in`、`all-in` 等。

#### Scenario: 二元市场输出
- **WHEN** LLM 收到 `market.type = 'crypto-binary'` 的输入
- **THEN** 输出 SHALL 包含 `fair_range` 且不含 `outcome_fair_probabilities`
- **AND** schema 验证 SHALL 通过 `BinaryOutputSchema` 单分支判别

#### Scenario: 多结果市场输出
- **WHEN** LLM 收到 `market.type = 'event-multi'` 的输入
- **THEN** 输出 SHALL 包含 `outcome_fair_probabilities` 且不含 `fair_range`
- **AND** schema 验证 SHALL 通过 `MultiOutputSchema` 单分支判别

#### Scenario: 含禁止词被拒
- **WHEN** LLM 输出的 `summary` / `factors` / `reasoning` 任一字段含禁止词
- **THEN** Zod 校验 SHALL 失败
- **AND** route handler SHALL 返回 `schema_failure` 错误，**不写缓存**

### Requirement: 置信度上限规则

系统 SHALL 在 system prompt 中明示并由 LLM 自约束以下两条置信度规则：
- `confidence: 'high'` 仅当 ≥ 2 个 `sources` 印证；单一来源最多 `med`
- 二元市场 `fair_range` 宽度 < 0.05（5 pp）时，`confidence` 必须 ≤ `med`

#### Scenario: 单源约束
- **WHEN** LLM 仅引用 1 个 source 并打算给 `high`
- **THEN** LLM SHALL 自动降级为 `med` 或 `low`

### Requirement: 链上隔离

AI Lens 的任何输出 SHALL NOT 写入合约、SHALL NOT 被 `AdminEventOracle` 引用、SHALL NOT 影响 `PredictionMarket` / `EventMarket` 的结算路径。

#### Scenario: 结算路径不污染
- **WHEN** 任何市场达到结算条件
- **THEN** 结算 SHALL 完全依赖 Pyth 价格（对 `PredictionMarket`）或 `AdminEventOracle`（对 `EventMarket`）
- **AND** AI Lens 缓存 / 输出 SHALL 不被任何结算合约调用读取

### Requirement: 共享缓存与日预算护栏

系统 SHALL 按 `(marketId, inputHash)` 共享缓存 Lens 结果；`inputHash` 基于 market 元信息 + context（含 Pyth 价格快照、事实表内容、`seconds_to_resolve` 等）的 SHA-1 截断。

TTL 默认：
- 加密二元市场：6 小时
- 事件多结果市场：24 小时

当价格漂移超过阈值（默认 5%）或事实表 mtime 变化时，因 `inputHash` 已变，下次访问自然 cache miss，无需后台失效扫描。

系统 SHALL 维护 UTC 0 点重置的日预算累计；超限时 SHALL 返回 HTTP 429 `budget_exhausted`，**不再调用 LLM**。

#### Scenario: 缓存命中秒返
- **WHEN** 用户 A 触发了某市场 Lens 后，用户 B 在 TTL 内对同一市场点击 `Ask AI`
- **THEN** 后端 SHALL 命中缓存，**不调用 DeepSeek**
- **AND** 响应应在 100ms 内返回 200

#### Scenario: 日预算触顶
- **WHEN** 当日累计 LLM 估算成本达到 `LENS_DAILY_BUDGET_USD`
- **THEN** 前端按钮 SHALL 置灰（HTTP 429 触发）
- **AND** 后端 SHALL NOT 再向 DeepSeek 发起请求，直至 UTC 0 点重置

### Requirement: DeepSeek 原生 fetch 客户端

系统 SHALL 使用原生 fetch 直调 DeepSeek REST API（`POST {baseUrl}/chat/completions`），不依赖任何 OpenAI 兼容包装库。

调用参数：
- 5 秒超时
- 4xx 客户端错误（**除 408 / 429 外**）SHALL 不重试，直接抛错
- 5xx / 网络错 / 408 / 429 SHALL 重试一次（500ms × (attempt+1) 指数退避）
- 请求体 SHALL 设置 `response_format: { type: 'json_object' }`
- 任何错误路径 SHALL NOT 在响应中泄露 Authorization 头或 API key（通过 `safeErrorMessage(code)` 返回脱敏后的通用文案）

#### Scenario: 401 不重试
- **WHEN** DeepSeek 返回 HTTP 401
- **THEN** 客户端 SHALL 立刻抛错且 fetch 仅被调用 1 次

#### Scenario: 429 / 408 重试
- **WHEN** DeepSeek 返回 HTTP 429 或 408
- **THEN** 客户端 SHALL 重试 1 次

#### Scenario: 错误消息脱敏
- **WHEN** LLM 调用因任何原因失败
- **THEN** route response 的 `message` 字段 SHALL NOT 包含 `sk-` 前缀的 API key 子串

### Requirement: 用户界面与可达性

系统 SHALL 在以下两个位置提供 AI Lens 入口，UI 文案与 LLM 输出 SHALL 为英文：

- **市场卡（compact）**：底部 32px 占位条；idle 显示 `✨ Ask AI` 按钮 + 简短说明；点击后 in-place 展开为 ~140px 区域，含 summary（不截断）、mini AILensGauge（binary / multi 两种 variant）、最多 3 个 factors bullets、`Updated Xm ago · Reference only — not financial advice` 脚标，以及右上 `Hide` 按钮（回到 idle）
- **详情页（full）**：`MarketDetailCard` 下方 idle 占位卡，含居中 `✨ Generate AI Lens` 按钮 + 一句说明；触发后渲染完整面板：header 仅 `Confidence X · Updated Xm ago`、双层 gauge、3–5 个 factors 玻璃子卡片、sources chips、`Why?` 折叠（展开 LLM reasoning）、可选 caveats 列表、永久 disclaimer 脚标 `AI estimate based on listed sources. Not financial advice. Not a settlement oracle.`

系统 SHALL 不在用户可见 UI 中出现 `Cached` / `Fresh` / `cache` / `缓存` 等缓存实现术语。

result / loading 状态外层容器 SHALL 设置 `role="status"` 和 `aria-live="polite"`，触发按钮 SHALL 含 `aria-label`。

#### Scenario: 错误降级不破坏页面
- **WHEN** LLM 调用失败（超时 / 5xx / schema_failure）
- **THEN** 前端 SHALL 显示 `AI Lens unavailable — please retry` 与 `Retry` 按钮
- **AND** 市场卡其他下注 / 状态 / 价格信息 SHALL 不受影响

#### Scenario: in-place 收起
- **WHEN** 用户点击 result 状态的 `Hide` 按钮
- **THEN** Compact SHALL 回到 idle 状态（丢弃当前会话的结果，但缓存仍在后端 TTL 内）
- **AND** 用户再次点击 `Ask AI` SHALL 秒返同一份缓存结果

### Requirement: Context Builder — 显式喂时间

系统 SHALL 在 crypto context builder 中可选计算并传递 `seconds_to_resolve`（距市场结算剩余秒数），用于消除 LLM 自行估算时间区间的幻觉。system prompt 中 SHALL 明示：context 提供的 `seconds_to_resolve` 是权威值，LLM 不得自行推断时间。

#### Scenario: 提供 endTimeSeconds
- **WHEN** 调用 `buildCryptoContext({ pythSeries, threshold, endTimeSeconds })` 且 `endTimeSeconds > now`
- **THEN** 输出 context SHALL 包含 `seconds_to_resolve = max(0, endTimeSeconds - now)`

#### Scenario: 未提供 endTimeSeconds
- **WHEN** 调用 `buildCryptoContext` 不传 `endTimeSeconds`
- **THEN** 输出 context SHALL 不包含 `seconds_to_resolve` 字段

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

#### Scenario: 预生成失败不阻塞开市
- **WHEN** cron 创建新市场后调用 lens-preloader 失败
- **THEN** createMarket 主流程 SHALL 保持成功
- **AND** 失败信息 SHALL 被记录供后续排查
