## ADDED Requirements

### Requirement: 首页必须使用克制的交易产品视觉系统

系统 SHALL 在首页主市场浏览界面使用浅色中性、低装饰、信息密集的交易产品视觉系统。页面 SHALL NOT 在主浏览路径中依赖深色霓虹玻璃、粒子 Hero、紫蓝大渐变标题或大面积发光阴影作为主要视觉语言。

#### Scenario: 用户打开首页
- **WHEN** 用户访问首页
- **THEN** 页面 SHALL 呈现浅色或中性背景、清晰边界和紧凑内容区
- **AND** 首页主 Hero SHALL 是市场摘要或浏览入口，不得是营销式大幅视觉 Hero
- **AND** 主要内容区 SHALL 优先显示可交易市场、分类、概率和流动性信息

### Requirement: 顶部导航和过滤器必须像市场浏览工具

系统 SHALL 提供紧凑的顶部导航、搜索或 browse-like affordance、分类/主题 strip 和状态明确的 active chip。分类与过滤交互 SHALL 保持现有 URL query、category、stage、asset、cadence 行为。

#### Scenario: 用户切换市场分类
- **WHEN** 用户在首页切换 Crypto、World Cup、Macro 或 On-chain 分类
- **THEN** 系统 SHALL 保持现有 category query 同步行为
- **AND** active 分类 SHALL 以克制的边框、背景或主色文本表现
- **AND** 页面 SHALL NOT 因视觉改造破坏 stage、asset 或 cadence 过滤

### Requirement: 市场卡片必须是紧凑概率卡

系统 SHALL 将 Crypto 与 Event 市场卡片呈现为紧凑概率卡。卡片 SHALL 以问题标题、category/status、概率、volume/liquidity、deadline 和 Yes/No 或 outcome action 为核心。详情链接和下注按钮 SHALL 继续分离。

#### Scenario: 用户浏览市场卡片
- **WHEN** 市场卡片渲染
- **THEN** 卡片 SHALL 使用 flat bordered panel 或等价低装饰容器
- **AND** SHALL 展示概率或 outcome odds、流动性/池子、状态信息
- **AND** Yes/No 或 outcome 按钮 SHALL 可直接点击下注
- **AND** 下注按钮 SHALL NOT 位于详情 `Link` 内部

### Requirement: Rich sections 必须统一为 flat panel system

系统 SHALL 将 Today Board、Discovery Rail、Theme Board、Market Story、Activity Timeline 和 Related Markets 统一为同一种克制 panel 语言，避免卡片套卡片、过大圆角、重 blur、重 glow 或装饰性 radial gradient。

#### Scenario: 用户浏览 rich sections
- **WHEN** 首页或详情页展示 rich sections
- **THEN** 各 section SHALL 使用一致的 panel 边框、间距、字号和 hover 语言
- **AND** 列表条目 SHALL 适合快速扫描
- **AND** 页面 SHALL NOT 出现视觉层级混乱或按钮遮挡

### Requirement: 详情页必须保留交易能力并降低装饰感

系统 SHALL 将详情页呈现为市场档案与交易 ticket 的组合。视觉改造 SHALL 保留 `SettlementTimeline`、`AILensPanel`、下注表单、event challenge/resolution 信息和移动端底部下注入口。

#### Scenario: 用户打开详情页
- **WHEN** 用户访问 price 或 event market 详情页
- **THEN** 页面 SHALL 展示 flat market profile panel
- **AND** SHALL 保留下注入口、SettlementTimeline 和 AILensPanel
- **AND** AI Lens SHALL 仍只由用户显式操作触发或既有 preload 路径触发

### Requirement: 风格回归必须有静态检查

系统 SHALL 提供静态检查或组件测试，防止 primary homepage surfaces 回退到重 AI 风格。检查 SHALL 覆盖 light tokens、HomeHero、BaseMarketCard、CryptoMarketCard、WorldCupMarketCard、MarketFilterBar 和 rich section panels。

#### Scenario: 开发者运行视觉风格检查
- **WHEN** 开发者运行相关 test/check 命令
- **THEN** 检查 SHALL 捕获主市场浏览界面重新引入粒子 Hero、`.glass` primary card shell、`.num-glow` primary card numbers、装饰 SVG rings 或大 `rounded-3xl` primary card 外壳的回归
- **AND** 检查 SHALL 验证关键交易行为标记仍存在
