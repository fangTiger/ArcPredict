# 变更：丰富 ArcPredict 首页与市场详情页

## Why

ArcPredict 已经具备 Crypto、World Cup、Macro、On-chain、AI Lens、主题市场包与结算时间线等基础能力，但用户进入页面时仍主要看到市场卡片列表。下一阶段的产品目标不是继续增加底层合约或合规能力，而是让网站看起来更丰富、更像每天都在运行的预测市场产品。

用户明确要求：去掉法务合规，不把它作为本轮规划重点；本轮以页面丰富度、内容感、探索感和可停留性为主要目标。

## What Changes

- 新增 capability `rich-market-surfaces`，定义首页和详情页的内容丰富度要求。
- 首页新增“可浏览内容层”：今日看板、趋势市场、即将截止、最近结算、AI Lens 摘要/占位、主题包入口。
- 市场卡片增强信息密度：封面/主题视觉、活动度、倒计时、池子状态、概率条和 Lens 摘要入口。
- 市场详情页增强为“预测档案”：市场故事、关键数字、活动动态、相关市场和现有 SettlementTimeline / AI Lens 的更清晰编排。
- 新增纯前端派生层，复用现有链上读取结果计算 richer sections，不新增后端数据库，不新增合约。
- 开发流程采用三角色：Architecture Codex 规划和集成，Implementation Codex 执行 TDD，Review Codex 独立审查。

## 影响范围

- 受影响规范：新增 `rich-market-surfaces`。
- 预计受影响代码：
  - `web/app/page.tsx`
  - `web/app/market/[id]/page.tsx`
  - `web/components/HomeHero.tsx`
  - `web/components/CryptoMarketCard.tsx`
  - `web/components/WorldCupMarketCard.tsx`
  - `web/components/MarketDetailCard.tsx`
  - `web/components/ThemeMarketBoard.tsx`
  - 新增 `web/components/MarketDiscoveryRail.tsx` 或等价首页丰富内容组件
  - 新增 `web/components/MarketStoryPanel.tsx` 或等价详情页内容组件
  - 新增 `web/lib/market-richness.ts` 或等价派生工具
  - 新增/更新相关 `web/test/**` 与 `web/components/__tests__/**`
- 不预期影响：
  - 不修改 `contracts/**`
  - 不新增合约、不新增 oracle、不改结算逻辑
  - 不引入数据库
  - 不新增真实外部服务调用
  - 不处理法务合规和地理限制

## 非目标

- 不做开放创建市场。
- 不做排行榜、积分、任务系统或用户成就。
- 不做评论区、社交 feed 或用户生成内容。
- 不把 AI Lens 变成投注建议。
- 不新增实时行情供应商或体育数据供应商。
- 不改变自动化市场创建、seed、resolve 的链上流程。
