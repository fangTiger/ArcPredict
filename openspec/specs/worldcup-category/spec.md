# Capability: worldcup-category

## Purpose

ArcPredict 的 `worldcup-category` 能力在现有 Crypto 价格预测市场之外，提供世界杯离散事件市场。该能力使用独立 `EventMarket` 合约和 `AdminEventOracle` 结算源，支持 1X2、单场二元让分/大小和 48 队冠军盘，并在前端通过 World Cup 品类、赛事卡片、阶段过滤和低频比分展示与 Crypto 流程隔离。
## Requirements
### Requirement: 市场类型维度（marketKind）

系统 SHALL 在市场模型中引入 `marketKind` 维度，枚举值包含 `PRICE`（价格预言机驱动）和 `EVENT`（赛事预言机驱动）。现有 `PredictionMarket` 市场默认为 `PRICE`，新增 `EventMarket` 市场默认为 `EVENT`；前端 SHALL 根据 `marketKind` 路由到对应的 UI 变体与数据源。前端 SHALL 支持多个 EventMarket deployment 并存，并在每个 EVENT row 上保留 deployment metadata，以便列表、详情、下注和结算状态查询使用该 row 所属的合约地址。

#### Scenario: 创建 EVENT 类型市场
- **WHEN** 项目方调用 `EventMarket.createMarket` 创建赛事市场
- **THEN** 系统 SHALL 在独立 `EventMarket` 合约中创建 N-outcome 市场
- **AND** 市场 SHALL 通过 `IEventOracle` 读取 `AdminEventOracle` 最终化结果

#### Scenario: 创建 PRICE 类型市场（现有路径）
- **WHEN** 项目方使用现有 `PredictionMarket.createMarket` 创建价格市场
- **THEN** 行为 SHALL 与现有 Crypto 市场完全一致

#### Scenario: 前端按 marketKind 切换 UI
- **WHEN** 用户进入市场详情页，且市场 `marketKind = EVENT`
- **THEN** 详情页 SHALL 显示赛事信息模块（队伍、阶段、时间、结算来源）而非 Pyth 喂价模块
- **AND** 走势图 SHALL 显示隐含概率曲线而非价格曲线

#### Scenario: 多 deployment 聚合展示
- **WHEN** `automated-v1` deployment 包含 macro / chain 市场，且 `worldcup-v1` deployment 包含 WorldCup 市场
- **THEN** 首页 SHALL 同时读取两个 deployment 的 event rows
- **AND** World Cup Tab SHALL 显示 `worldcup-v1` 市场
- **AND** Macro 与 On-chain Tab SHALL 显示 `automated-v1` 市场
- **AND** 一个 deployment 切换或部署 SHALL NOT 让另一个 deployment 的品类从前端消失

### Requirement: 1X2 三选一市场

系统 SHALL 支持单场比赛的 1X2 市场（主队胜 / 平 / 客队胜），使用 `EventMarket` 合约，outcome 数量固定为 3，互斥且穷尽。

#### Scenario: 下注 1X2 市场
- **WHEN** 用户在 ARG vs FRA 1X2 市场中选择 "ARG WIN" 并下注 100 USDC
- **THEN** 系统 SHALL 在 `stakeByOutcome` 中记录 100 单位 "ARG WIN" 持仓
- **AND** 其他两个 outcome（DRAW、FRA WIN）的隐含概率 SHALL 可由 `outcomePools` 重新计算

#### Scenario: 1X2 市场结算
- **WHEN** 比赛结束且 `AdminEventOracle` 已最终化结果为 "DRAW"
- **THEN** 持有 "DRAW" outcome 持仓的用户 SHALL 能按赢家池比例领取 USDC
- **AND** 持有 "ARG WIN" 或 "FRA WIN" 的用户 SHALL 无可领取 payout

### Requirement: 单场让分市场（Binary）

系统 SHALL 支持单场比赛的让分市场，使用 `EventMarket` 合约且 `outcomeCount = 2`，outcome 为 "OVER / UNDER" 或 "HOME COVER / AWAY COVER"。让分线在市场创建时确定，不可变更。

#### Scenario: 创建总进球数 Over/Under 市场
- **WHEN** 项目方创建 "ARG vs FRA 总进球数 > 2.5" 市场
- **THEN** 系统 SHALL 在 `EventMarket` 中创建二结果市场，outcome 0 = OVER 2.5，outcome 1 = UNDER 2.5
- **AND** 市场 `marketKind` SHALL 为 `EVENT`

#### Scenario: 让分市场结算
- **WHEN** 比赛实际进球数为 3，且 `AdminEventOracle` 最终化结果
- **THEN** 持有 YES（OVER 2.5）对应 outcome 持仓的用户 SHALL 能按赢家池比例领取 USDC
- **AND** 持有 NO 对应 outcome 持仓的用户 SHALL 无可领取 payout

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

### Requirement: 实时比分仅用于展示且低频按需轮询

系统 SHALL 通过 `web/lib/event-source.ts` 调用 TheSportsDB 免费版 API 获取实时比分用于前端展示。该数据 SHALL NOT 进入任何合约结算路径，结算 MUST 只信任 `AdminEventOracle` 的最终化结果。轮询策略 SHALL 严格遵守以下规则以最小化 API 调用：

- 仅在比赛进行中（`now ∈ [kickoffTime, kickoffTime + 150min]`）且用户聚焦详情页时启动轮询
- 轮询间隔 60 秒
- 用户切走 Tab / 浏览器最小化 / 详情卡片滚出视口时立刻停止轮询
- 列表页（卡片网格）SHALL NOT 轮询比分，仅展示赛程时间
- 同一 `matchId` 60 秒内 SHALL 只发出一次请求

#### Scenario: 比赛进行中聚焦详情页
- **WHEN** 用户进入正在进行中的比赛详情页，且页面处于聚焦状态
- **THEN** 前端 SHALL 立即请求一次当前比分并显示
- **AND** 后续每 60 秒重新请求一次

#### Scenario: 用户切走 Tab 或最小化
- **WHEN** 用户切换浏览器 Tab 或最小化窗口
- **THEN** 前端 SHALL 在下一个 60 秒周期前停止轮询
- **AND** 用户重新聚焦时 SHALL 立刻发起一次请求以补齐数据

#### Scenario: 比赛未开始或已结束
- **WHEN** 当前时间不在比赛进行窗口内
- **THEN** 前端 SHALL NOT 发起任何比分请求
- **AND** 仅显示赛程时间或最终比分（从静态数据/最终结果获取）

#### Scenario: 列表页无轮询
- **WHEN** 用户在 World Cup Tab 列表页浏览卡片
- **THEN** 前端 SHALL NOT 为任何卡片轮询实时比分
- **AND** 卡片仅显示赛程时间与下注信息

#### Scenario: 比分 API 失败降级
- **WHEN** TheSportsDB API 调用失败或超时
- **THEN** 前端 SHALL 隐藏比分模块并显示赛程基础信息
- **AND** 下注与领奖流程 SHALL 不受影响

### Requirement: 资金池共享但视觉隔离

系统 SHALL 让 Crypto 与 World Cup 市场使用同一 USDC token 地址。前端 SHALL 按品类隔离持仓视图：在 Crypto Tab 下 `PositionList` 仅显示 `marketKind = PRICE` 的持仓，在 World Cup Tab 下仅显示 `marketKind = EVENT` 的持仓。

#### Scenario: 跨品类下注复用 USDC 余额
- **WHEN** 用户已持有同一 USDC token 并在 Crypto 市场下过注
- **THEN** 用户在 World Cup 市场下注时 SHALL 使用同一 USDC token 余额
- **AND** 用户仍 SHALL 按具体合约地址完成 ERC20 allowance 授权

#### Scenario: 持仓视图按品类过滤
- **WHEN** 用户切换到 World Cup Tab
- **THEN** `PositionList` SHALL 只列出 World Cup 相关持仓
- **AND** 全局持仓汇总入口 SHALL 在 Header 提供"全部持仓"链接

### Requirement: 灰度开关

系统 SHALL 通过环境变量 `NEXT_PUBLIC_WORLDCUP_ENABLED` 控制 World Cup 品类的可见性。当该值为字符串 `false` 时，前端 SHALL NOT 渲染 World Cup Tab 与相关组件；当未设置或为其他值时正常展示。

#### Scenario: 灰度关闭
- **WHEN** `NEXT_PUBLIC_WORLDCUP_ENABLED = false`
- **THEN** `MarketFilterBar` SHALL NOT 显示品类 Tab，回退到现有 Crypto-only 视图
- **AND** 所有 World Cup 相关路由（如详情页）SHALL 返回 404 或重定向到首页

#### Scenario: 灰度开启
- **WHEN** `NEXT_PUBLIC_WORLDCUP_ENABLED` 未设置或不等于字符串 `false`
- **THEN** 前端 SHALL 显示品类 Tab 并默认选中 Crypto

### Requirement: 冠军盘 48 选 1 市场

系统 SHALL 支持 2026 世界杯冠军盘市场，使用 `EventMarket` 合约，outcome 数量为 48（参赛队伍）。`EventMarket.createMarket` SHALL 接受最多 48 个 outcome，世界杯部署使用的 `AdminEventOracle` 最大 outcome 配置 SHALL 至少为 48。已被淘汰队伍的 outcome 持仓 SHALL 保留到最终结算（不在淘汰时强制归零）。

#### Scenario: 冠军盘下注
- **WHEN** 用户在冠军盘中购买 50 USDC 的 "Argentina" outcome
- **THEN** 系统 SHALL 在 `stakeByOutcome` 中记录 50 单位 "Argentina" 持仓
- **AND** 其他 47 个队伍的隐含概率 SHALL 可由 `outcomePools` 重新计算

#### Scenario: 冠军最终化
- **WHEN** 决赛结束，`AdminEventOracle` 最终化冠军为 "Argentina"
- **THEN** 持有 "Argentina" outcome 持仓的用户 SHALL 按赢家池比例领取 USDC
- **AND** 其他 47 个队伍 outcome 持仓 SHALL 无可领取 payout

#### Scenario: 已淘汰队伍持仓不强制清零
- **WHEN** 小组赛阶段 "Germany" 已被淘汰，但冠军盘尚未结算
- **THEN** 持有 "Germany" outcome 持仓的用户 SHALL 继续保留该持仓直到冠军最终化
- **AND** 合约 SHALL NOT 主动清零任何非获胜 outcome 持仓

### Requirement: 2026 世界杯链上种子脚本

系统 SHALL 在 `contracts/script/data/worldcup-seed.json` 中提供 2026 世界杯链上预创建 seed，包含 48 支参赛队伍、72 场小组赛、`final-1` 决赛占位市场和 48 outcome 冠军盘。部署脚本 SHALL 创建每场仍未过下注截止时间的小组赛 1X2 与 goals-25 市场、仍未过下注截止时间的 `final-1` 1X2 市场和 `worldcup-2026` 冠军盘。若在赛前运行完整 seed，脚本 SHALL 创建 146 个市场；若在赛事进行中运行，脚本 SHALL 跳过已过下注截止时间的单场市场，且 SHALL NOT 为已经开始或已经结束的比赛创建新市场。

#### Scenario: 链上 seed 完整性
- **当** `SeedWorldCupMarkets` 读取默认 `worldcup-seed.json`
- **则** seed SHALL 包含 48 支队伍、72 个小组赛 match id、72 个 kickoff、72 个主队和 72 个客队
- **并且** 第一个 match id SHALL 为 `group-a-1`
- **并且** 最后一个小组赛 match id SHALL 为 `group-l-6`

#### Scenario: 赛前批量创建 2026 市场
- **当** 项目方在第一场比赛下注截止时间前运行 World Cup seed 脚本
- **则** 脚本 SHALL 创建 146 个市场
- **并且** 冠军盘 event id SHALL 从 `worldcup:winner:worldcup-2026` 派生
- **并且** 冠军盘 outcome 数量 SHALL 为 48

#### Scenario: 赛中运行时跳过过期赛事
- **当** 当前时间为 2026-06-27T13:15:46Z，项目方按真实 2026 kickoff 运行 World Cup seed 脚本
- **则** 脚本 SHALL 跳过下注截止时间已过的小组赛
- **并且** 只为仍未过下注截止时间的 6 场小组赛创建 12 个单场市场
- **并且** 仍可创建 `final-1` 1X2 市场和 `worldcup-2026` 冠军盘
