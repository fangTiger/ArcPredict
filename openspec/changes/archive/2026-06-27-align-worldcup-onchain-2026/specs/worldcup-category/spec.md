## REMOVED Requirements

### Requirement: 冠军盘 32 选 1 市场

系统 SHALL 支持世界杯冠军盘市场，使用 `EventMarket` 合约，outcome 数量为 32（参赛队伍）。已被淘汰队伍的 outcome 持仓 SHALL 保留到最终结算（不在淘汰时强制归零）。

#### Scenario: 冠军盘下注
- **WHEN** 用户在冠军盘中购买 50 USDC 的 "Argentina" outcome
- **THEN** 系统 SHALL 在 `stakeByOutcome` 中记录 50 单位 "Argentina" 持仓
- **AND** 其他 31 个队伍的隐含概率 SHALL 可由 `outcomePools` 重新计算

#### Scenario: 冠军最终化
- **WHEN** 决赛结束，`AdminEventOracle` 最终化冠军为 "Argentina"
- **THEN** 持有 "Argentina" outcome 持仓的用户 SHALL 按赢家池比例领取 USDC
- **AND** 其他 31 个队伍 outcome 持仓 SHALL 无可领取 payout

#### Scenario: 已淘汰队伍持仓不强制清零
- **WHEN** 小组赛阶段 "Germany" 已被淘汰，但冠军盘尚未结算
- **THEN** 持有 "Germany" outcome 持仓的用户 SHALL 继续保留该持仓直到冠军最终化
- **AND** 合约 SHALL NOT 主动清零任何非获胜 outcome 持仓

## ADDED Requirements

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

系统 SHALL 在 `contracts/script/data/worldcup-seed.json` 中提供 2026 世界杯链上预创建 seed，包含 48 支参赛队伍、72 场小组赛、`final-1` 决赛占位市场和 48 outcome 冠军盘。部署脚本 SHALL 创建每场小组赛的 1X2 与 goals-25 市场、`final-1` 1X2 市场和 `worldcup-2026` 冠军盘，共 146 个市场。

#### Scenario: 链上 seed 完整性
- **当** `SeedWorldCupMarkets` 读取默认 `worldcup-seed.json`
- **则** seed SHALL 包含 48 支队伍、72 个小组赛 match id、72 个 kickoff、72 个主队和 72 个客队
- **并且** 第一个 match id SHALL 为 `group-a-1`
- **并且** 最后一个小组赛 match id SHALL 为 `group-l-6`

#### Scenario: 批量创建 2026 市场
- **当** 项目方运行 World Cup seed 脚本
- **则** 脚本 SHALL 创建 146 个市场
- **并且** 冠军盘 event id SHALL 从 `worldcup:winner:worldcup-2026` 派生
- **并且** 冠军盘 outcome 数量 SHALL 为 48
