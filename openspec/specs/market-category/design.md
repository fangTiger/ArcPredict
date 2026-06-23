# Design: market-category

## 目的

market-category 记录 ArcPredict 当前市场品类维度，以及每个品类在过滤、
路由、列表卡片、详情页和 Lens 分发中的覆盖要求。该能力保证新增自动化
品类后，用户可以在首页直接浏览并进入对应市场。

## 当前品类

| Category | 市场来源 | 结题路径 |
| --- | --- | --- |
| `crypto` | 现有价格预测市场 | `PredictionMarket` + Pyth |
| `worldcup` | 世界杯事件市场 | `EventMarket` + `AdminEventOracle` |
| `macro` | `fred-macro` 自动化 source | `EventMarket` + `AdminEventOracle` |
| `chain` | `chain-event` 自动化 source | `EventMarket` + `AdminEventOracle` |

## 前端覆盖

- `MarketCategory` 类型是所有 category switch / mapping 的源头。
- `MarketFilterBar` 在首页暴露 4 个 tab，点击后筛选对应 category。
- 页面路由、市场 row 派生、列表卡片和详情页必须完整处理 4 类。
- 任意新增 category 应让 TypeScript 穷举检查暴露遗漏分支。

## 自动化市场主题图片

Macro 与 chain 市场来自链上事件，不依赖链上字段保存图片。前端在解析展示
row 时根据 category、source metadata 或题材稳定派生主题图片 metadata，并
使用项目静态资产渲染列表卡片和详情页图片。

## 关联能力

- `market-sources` 负责 macro / chain 市场的自动开市、seed 与结题。
- `ai-lens` 负责按 category 分发到对应 contextBuilder。
