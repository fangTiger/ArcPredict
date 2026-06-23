## Why

当前 ArcPredict 仅支持基于 Pyth 价格预言机的加密资产二元市场，市场叙事受限于币价波动。世界杯作为 4 年一届的全球高关注度赛事，能在短期内显著拉新与提升活跃度，但其结算机制（离散事件结果）与现有 Pyth 价格映射不兼容，必须在合约层、预言机层、UI 层同步扩展，才能承载赛事品类。

## What Changes

- 在前端市场模型中引入 `marketKind` 维度（区分 `PRICE` / `EVENT`），现有 `PredictionMarket` 市场默认为 `PRICE`，新增 `EventMarket` 市场默认为 `EVENT`
- 新增多结果市场合约 `EventMarket`（N 选 1，N ∈ [2, 32]），现有 `PredictionMarket` 合约保持不变
- 新增赛事结算预言机抽象 `IEventOracle`，MVP 实现 `AdminEventOracle`（项目方提交结果 + 72 小时异议期 + 100 USDC 质押挑战 + owner 裁定）
- 新增世界杯赛程种子数据与赛事元数据（赛程、阶段、队伍、队徽）
- 前端新增**品类 Tab**（Crypto / World Cup），World Cup 内提供阶段子过滤（小组赛 / 16 强 / 8 强 / 半决赛 / 决赛 / 冠军盘）
- 前端抽取 `BaseMarketCard` + slot 模式，新增 `WorldCupMarketCard` 变体（队徽 + 1X2/让分/冠军盘三种 outcome 布局）
- `MarketDetailCard` 按 `marketKind` 切换：价格走势图 → 隐含概率走势图；Pyth 喂价模块 → 赛事信息模块（标注结算来源 = AdminEventOracle）
- 移动端 World Cup 卡片默认折叠为"主队 WIN / 其他"二元视图，点击展开三栏
- `ArcBackground` 在 World Cup 品类下切换为绿茵纹理变体（accent 级别，不破坏浅色主题）
- 资金策略：**Crypto 与 World Cup 使用同一 USDC token 地址**，仅在前端做品类视觉隔离；不同合约地址仍按 ERC20 spender 分别授权
- **不引入**：积分/成就系统、UMA Optimistic Oracle（留接口给后续切换）

## Capabilities

### New Capabilities

- `worldcup-category`: 世界杯品类的市场类型（1X2 三选一、单场让分二元、冠军盘 32 选 1）、赛程数据模型、品类导航与卡片变体
- `event-oracle`: 赛事结算预言机抽象 `IEventOracle` 及其 `AdminEventOracle` 实现，含结果提交、异议期、最终化流程

### Modified Capabilities

<!-- 当前 openspec/specs/ 为空，无可修改 capability。`marketKind` 维度作为新概念在 worldcup-category spec 中定义；现有合约层无对应 spec，将在本次提案的 design.md 中说明改造点 -->

## Impact

- **合约层** (`contracts/src/`)：新增 `EventMarket.sol`、`AdminEventOracle.sol`、`interfaces/IEventOracle.sol`；不修改现有 `PredictionMarket.sol`
- **前端组件** (`web/components/`)：`MarketFilterBar`（品类 Tab）、`MarketCard`（抽 Base + 变体）、`MarketDetailCard`（按 kind 切 slot）、`ArcBackground`（纹理变体）；新增 `WorldCupMarketCard`、`WorldCupOutcomePanel`、`EventInfoPanel`
- **前端数据层** (`web/lib/`)：新增 `event-source.ts`（赛程/比分轮询，仅展示用）、`worldcup-seed.ts`（赛程种子）、`market-kind.ts`（kind 枚举与路由）；`asset-price-map.ts` 不动
- **依赖**：新增 `country-flag-emoji` 或等价队徽方案（评估后定）；引入 API-Football 或 TheSportsDB 免费 API（仅前端展示，不参与结算）
- **配置**：环境变量增加 `NEXT_PUBLIC_WORLDCUP_ENABLED` 灰度开关
- **不影响**：现有 Crypto 市场流程、Pyth 喂价、Phase16 标志、Faucet、钱包连接
