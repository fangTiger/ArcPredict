# rich-market-surfaces Specification

## Purpose
定义首页、市场卡片和详情页的丰富内容层，让用户在不依赖伪造趋势或自动 AI 调用的前提下，更快理解可参与市场、主题包和相关预测上下文。

## Requirements
### Requirement: 首页必须展示丰富内容层

系统 SHALL 在首页市场网格之外展示至少三个可浏览内容区：今日看板、趋势/临期市场、最近结算或本周主题包。内容区 SHALL 直接链接可操作市场或主题页，不得是空营销落地页。

#### Scenario: 首页有市场时显示 rich sections
- **WHEN** 首页读取到 open price 或 event markets
- **THEN** 页面 SHALL 展示 Today Board 或等价主推区
- **AND** SHALL 展示 Trending / Closing Soon / Recently Resolved 中至少两个列表
- **AND** 每个市场条目 SHALL 链接到对应详情页

#### Scenario: 首页无市场时优雅降级
- **WHEN** 当前没有可用 open market
- **THEN** rich sections SHALL 显示明确空状态或隐藏自身
- **AND** 页面 SHALL NOT 渲染空白卡片、崩溃或阻断原市场网格空状态

### Requirement: Rich sections 必须基于真实已读数据派生

系统 SHALL 只使用当前已读取的链上 dashboard rows、theme manifest 和本地静态 metadata 派生 rich sections。系统 SHALL NOT 伪造 24h 价格变化、下注人数、成交历史或不存在的活动 feed。

#### Scenario: 无历史序列时不展示伪造 delta
- **WHEN** 系统没有市场历史价格或历史池子快照
- **THEN** 页面 SHALL NOT 展示 “24h change” 或等价历史变化字段
- **AND** 可以展示当前 pool skew、liquidity、deadline、claimable 等实时字段

#### Scenario: Lens 不被自动调用
- **WHEN** 用户打开首页 rich sections
- **THEN** 系统 SHALL NOT 自动 POST 到 `/api/lens/[marketId]`
- **AND** AI Lens 仍 SHALL 只由 `AILensCompact` / `AILensPanel` 的用户显式操作触发，或由既有 cron preload 路径触发

### Requirement: 市场卡片必须增强信息密度且保持可下注

系统 SHALL 在 Crypto 与 Event 市场卡片中展示更丰富的状态信息，包括但不限于主题/category、总池子或流动性、当前概率/池子 skew、截止状态、活动度标签或 Lens 入口。下注按钮 SHALL 保持可点击，且不得被详情链接包裹。

#### Scenario: Crypto 卡片保留下注按钮
- **WHEN** 用户浏览 Crypto 市场卡片
- **THEN** 主体 SHALL 提供详情链接
- **AND** YES / NO 下注按钮 SHALL 仍调用原 `onBet`
- **AND** 按钮 SHALL NOT 位于详情 `Link` 内部

#### Scenario: Event 卡片显示 category 语义
- **WHEN** 用户浏览 World Cup / Macro / On-chain event 市场卡片
- **THEN** 卡片 SHALL 展示对应 category 或 stage
- **AND** SHALL 展示 outcomes、liquidity、deadline 或 position 状态
- **AND** SHALL 保留进入详情页和下注 outcome 的路径

### Requirement: 详情页必须呈现预测档案

系统 SHALL 在市场详情页展示预测档案内容。预测档案至少包含市场故事、关键观察点、相关市场或活动时间线中的两个模块，并与现有 `SettlementTimeline` 和 `AILensPanel` 共存。

#### Scenario: Price 市场详情页有预测档案
- **WHEN** 用户访问 price market 详情页
- **THEN** 页面 SHALL 展示市场故事或关键观察点
- **AND** SHALL 继续展示 `SettlementTimeline`
- **AND** SHALL 继续展示 `AILensPanel`
- **AND** 下注表单 SHALL 继续可用

#### Scenario: Event 市场详情页有预测档案
- **WHEN** 用户访问 event market 详情页
- **THEN** 页面 SHALL 展示事件故事、相关市场或活动时间线
- **AND** SHALL 继续展示 AdminEventOracle / challenge window 相关 `SettlementTimeline`
- **AND** SHALL 继续展示 `AILensPanel`

### Requirement: 本周主题包必须更像主推内容区

系统 SHALL 将 active theme pack 展示为首页主推内容区之一。主题包 SHALL 显示标题、描述、状态、share link 和直接市场入口；没有可用市场时 SHALL 显示降级状态。

#### Scenario: active theme 有市场
- **WHEN** active theme pack 匹配到 markets
- **THEN** 首页 SHALL 展示主题标题、描述和市场列表
- **AND** 市场条目 SHALL 直接进入对应市场详情页

#### Scenario: active theme 暂无市场
- **WHEN** active theme pack 存在但没有匹配市场
- **THEN** 首页 SHALL 显示简短空状态
- **AND** SHALL NOT 隐藏整个页面或影响市场网格

### Requirement: 页面布局必须兼容移动端和桌面端

系统 SHALL 保证新增 rich sections 在移动端和桌面端均不发生文字溢出、按钮遮挡或 incoherent overlap。固定格式元素 SHALL 有稳定尺寸或响应式约束。

#### Scenario: 移动端内容不遮挡下注操作
- **WHEN** 用户在移动端访问首页或详情页
- **THEN** rich sections SHALL 不遮挡市场下注按钮
- **AND** 详情页移动底部下注条 SHALL 保持可操作

#### Scenario: 桌面端内容层级清楚
- **WHEN** 用户在桌面端访问首页
- **THEN** Hero、主题包、rich sections、过滤器、市场网格之间 SHALL 有清晰视觉间距
- **AND** 页面 SHALL NOT 出现卡片套卡片造成的混乱层级
