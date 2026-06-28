## MODIFIED Requirements

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
