## ADDED Requirements

### Requirement: 每周主题市场包 Manifest

系统 SHALL 支持每周主题市场包 manifest。每个主题包 SHALL 包含稳定 `themeId`、标题、描述、weekStart、weekEnd、主推 category、市场引用列表、share copy 与状态（draft / active / archived）。

#### Scenario: 当前主题包可识别
- **WHEN** 当前日期落在某个 theme pack 的 weekStart 与 weekEnd 之间
- **THEN** 系统 SHALL 将该 theme pack 识别为 active
- **AND** 首页 SHALL 能展示该主题包关联的市场

#### Scenario: themeId 稳定
- **WHEN** 同一主题包被多次构建或部署
- **THEN** `themeId` SHALL 保持不变
- **AND** 主题分享 URL SHALL 不因构建变化而改变

### Requirement: 主题市场归组

系统 SHALL 允许自动化 MarketDraft 携带可选 `themeId`。带 `themeId` 的市场 SHALL 被归入对应主题包；没有 `themeId` 的市场 SHALL 保持原有 category 展示，不受影响。

#### Scenario: 自动化市场进入主题包
- **WHEN** `chain-event` source 生成 `themeId = "arc-summer-onchain"` 的 MarketDraft
- **THEN** cron createMarket 成功后，该市场 SHALL 在主题包聚合结果中出现
- **AND** 市场仍 SHALL 在原 category tab 中出现

#### Scenario: 无主题市场兼容
- **WHEN** MarketDraft 不包含 `themeId`
- **THEN** 系统 SHALL 按现有 market category 流程展示
- **AND** 不应因为缺少 themeId 失败

### Requirement: 主题入口优先展示可操作市场

首页主题板块和主题详情页 SHALL 直接展示可下注或即将结算的市场列表，而不是营销落地页。没有可用市场时 SHALL 显示降级状态，并保留 category 导航。

#### Scenario: active theme 有市场
- **WHEN** active theme 下存在 open markets
- **THEN** 首页 SHALL 展示主题标题、简短描述和市场卡列表
- **AND** 用户 SHALL 能直接进入市场详情或下注流程

#### Scenario: active theme 暂无市场
- **WHEN** active theme manifest 存在但 market refs 尚未创建成功
- **THEN** 首页 SHALL 显示简短降级文案
- **AND** SHALL NOT 渲染空白卡片或崩溃

### Requirement: 主题包 Lens 预热

主题包关联市场创建后，系统 SHALL best-effort 调用 Lens preload。Lens preload 失败 SHALL 被记录到 OpsReport，但不得阻塞 createMarket 或 seed。

#### Scenario: Lens preload 失败不阻塞主题市场
- **WHEN** DeepSeek 或 Lens route 暂不可用
- **THEN** 主题市场 SHALL 仍然创建并 seed
- **AND** OpsReport SHALL 记录 lens preload warning
- **AND** 用户仍可稍后手动触发 AI Lens

### Requirement: 历史主题归档

过期主题包 SHALL 进入 archived 状态并保持只读可访问。归档主题不应继续触发新的自动市场创建，但其已创建市场 SHALL 正常显示、结算与 claim。

#### Scenario: 主题过期
- **WHEN** 当前日期晚于 theme pack 的 weekEnd
- **THEN** 该 theme pack SHALL 不再作为首页 active theme
- **AND** 已创建市场 SHALL 继续按原合约状态展示
