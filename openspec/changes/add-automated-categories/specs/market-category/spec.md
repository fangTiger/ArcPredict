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
