## MODIFIED Requirements

### Requirement: 品类导航与过滤

前端 SHALL 在 `MarketFilterBar` 顶层提供品类 Tab（Crypto / World Cup），切换品类时下方过滤器内容 SHALL 整体替换：Crypto Tab 显示币种过滤，World Cup Tab 显示阶段过滤（All / Group Stage / Round of 32 / Round of 16 / Quarter Final / Semi Final / Final / Winner）。

#### Scenario: 默认进入 Crypto 品类
- **当** 用户首次访问首页
- **则** 系统 SHALL 默认选中 Crypto Tab
- **并且** 仅显示 `marketKind = PRICE` 的市场

#### Scenario: 切换到 World Cup 品类
- **当** 用户点击 World Cup Tab
- **则** 系统 SHALL 只显示 `marketKind = EVENT` 且属于世界杯的市场
- **并且** 过滤器 SHALL 切换为阶段选项
- **并且** `ArcBackground` SHALL 切换为绿茵纹理变体

#### Scenario: 阶段子过滤
- **当** 用户在 World Cup Tab 中选择 "Round of 32"
- **则** 系统 SHALL 仅显示 32 强阶段的赛事市场（1X2 + 让分）
- **并且** 冠军盘 SHALL 不出现在阶段过滤中（仅在 "Winner" 子 Tab 显示）

### Requirement: WorldCupMarketCard 卡片变体

前端 SHALL 提供 `WorldCupMarketCard` 组件，在 World Cup 品类下替代默认 `MarketCard`，包含队徽（SVG 国旗图标）、队名缩写、赛事阶段、开赛时间、结算时间、三种 outcome 布局（1X2 三栏 / 让分二元 / 冠军盘前 3 + 折叠）。

#### Scenario: 1X2 卡片展示
- **当** World Cup Tab 显示一个 1X2 市场卡片
- **则** 卡片 SHALL 显示两队队徽与缩写、"VS" 分隔、赛事阶段标签
- **并且** outcome 区域 SHALL 显示三栏（主胜 / 平 / 客胜），每栏含赔率与隐含概率百分比

#### Scenario: 冠军盘卡片展示
- **当** World Cup Tab 显示冠军盘市场卡片
- **则** 卡片 SHALL 显示当前概率最高的前 3 支队伍及其概率
- **并且** 提供 "查看全部 48 队" 折叠展开入口

#### Scenario: 移动端卡片折叠
- **当** 用户在移动端视口（< 768px）查看 1X2 卡片
- **则** 卡片 SHALL 默认折叠为二元视图（"主队 WIN / 其他"）
- **并且** 点击展开按钮 SHALL 还原为完整三栏

### Requirement: 世界杯赛程种子数据

系统 SHALL 在 `web/lib/worldcup-seed.ts` 中提供 2026 世界杯赛程静态种子数据，包含 48 支参赛队伍、104 场比赛（小组赛 72 场 + 淘汰赛 32 场）、12 个小组（A-L）、各场比赛的阶段、时间、参赛队伍。该数据 SHALL 在前端构建时打包，不通过运行时 API 获取。

#### Scenario: 赛程数据完整性
- **当** 前端启动并加载 `worldcup-seed.ts`
- **则** 数据 SHALL 包含全部 48 支队伍和全部 104 场比赛
- **并且** 小组赛 SHALL 包含 12 个小组，每组 4 支队伍、6 场比赛
- **并且** 淘汰赛 SHALL 包含 16 场 Round of 32、8 场 Round of 16、4 场 Quarter Final、2 场 Semi Final、1 场三四名决赛和 1 场决赛
- **并且** 每场比赛 SHALL 包含 `matchId`、`stage`、`kickoffTime`、`homeTeam`、`awayTeam`

#### Scenario: 阶段未定的淘汰赛
- **当** 小组赛或前序淘汰赛尚未确定全部晋级队伍
- **则** 淘汰赛场次 SHALL 用占位标识（如 "Winner Group A"、"Runner-up Group B"、"3rd Group C/E"、"Winner Match 89"）替代未知具体队伍
- **并且** 晋级关系确定后，系统 SHALL 通过项目方更新种子数据填充实际队伍（前端发版或配置推送）
