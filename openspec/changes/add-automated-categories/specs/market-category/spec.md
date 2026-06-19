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

#### Scenario: 自动化市场主题图片
- **WHEN** 前端将 category=macro 或 category=chain 的链上事件市场解析为展示 row
- **THEN** row SHALL 包含按题材确定性派生的主题图片 metadata
- **AND** 市场列表卡片与详情页 SHALL 渲染该主题图片
- **AND** 主题图片 SHALL 来自项目静态资产，不依赖运行时生图或链上字段
