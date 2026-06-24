# Rich Market Surfaces Handoff

## Handoff Task Package

- ChangeId: `add-rich-market-surfaces`
- TaskId: `rich-market-surfaces-vertical`
- AgentId: `worker-codex-rich-surfaces-001`
- SliceId: `rich-surfaces-vertical`
- Executor: Implementation Codex (`worker-codex`, `gpt-5.4` + `xhigh`)
- IntegrationOwner: Architecture Codex（当前主线程）
- SessionStatePath: `.codex/session-state.md`
- GitBaseline: `3fd36771bae819250cf8f4904b5e4634882593e6`
- Worktree path: worker forked workspace or current workspace patch handback
- Patch artifact: worker final response must list changed files, validation commands, RED/GREEN evidence, and any unverified items

## Proposal Summary

ArcPredict 本轮目标是“页面更丰富”，不是新增底层市场能力。实现应让首页从市场列表升级为可浏览的预测市场产品页，并让详情页成为预测档案。法务合规、开放创建市场、排行榜、积分、评论、合约变更均不在本轮范围内。

## Acceptance Criteria

- 首页展示 Today Board 或等价主推区。
- 首页展示 Trending / Closing Soon / Recently Resolved 中至少两个列表。
- active theme pack 继续作为主推内容区，并直接链接市场。
- Crypto 与 Event 卡片信息密度提升，下注按钮和详情链接继续分离。
- 详情页展示市场故事、相关市场或活动时间线中的至少两个模块。
- `SettlementTimeline`、`AILensPanel`、下注路径不回归。
- rich sections 只基于已读取数据派生，不伪造 24h delta、下注人数或不存在的 activity feed。
- 首页 rich sections 不自动触发 Lens POST。

## Editable Files

- `openspec/changes/add-rich-market-surfaces/tasks.md`
- `web/app/page.tsx`
- `web/app/market/[id]/page.tsx`
- `web/app/globals.css`
- `web/components/HomeHero.tsx`
- `web/components/CryptoMarketCard.tsx`
- `web/components/WorldCupMarketCard.tsx`
- `web/components/ThemeMarketBoard.tsx`
- `web/components/MarketDiscoveryRail.tsx`
- `web/components/MarketStoryPanel.tsx`
- `web/components/ActivityTimeline.tsx`
- `web/components/RelatedMarketsPanel.tsx`
- `web/lib/market-richness.ts`
- `web/test/market-richness.test.ts`
- `web/test/check_home_page.mjs`
- `web/test/check_market_components.mjs`
- `web/test/check_home_hero.mjs`
- `web/test/theme-market-pages.test.ts`
- `web/components/__tests__/ThemeMarketBoard.test.tsx`
- `web/components/__tests__/MarketDiscoveryRail.test.tsx`
- `web/components/__tests__/MarketStoryPanel.test.tsx`

## Forbidden Files

- `contracts/**`
- `.env*`
- `contracts/.env*`
- `web/package.json`
- `web/package-lock.json`
- `web/pnpm-lock.yaml`
- `web/next.config.*`
- `.codex/agents/**`
- `.codex/skills/**`
- `openspec/changes/add-rich-market-surfaces/proposal.md`
- `openspec/changes/add-rich-market-surfaces/design.md`
- `openspec/changes/add-rich-market-surfaces/specs/**`
- `openspec/specs/**`

## Task Scope Files

同 `Editable Files`。若实现需要编辑 allowlist 之外的文件，先停止并在 handback 中说明原因、风险和建议新增文件，不得擅自修改。

## PreExistingDirtyBaseline

- `openspec/changes/add-rich-market-surfaces/proposal.md`
- `openspec/changes/add-rich-market-surfaces/design.md`
- `openspec/changes/add-rich-market-surfaces/tasks.md`
- `openspec/changes/add-rich-market-surfaces/specs/rich-market-surfaces/spec.md`
- `docs/plans/2026-06-24-rich-market-surfaces-handoff.md`

这些是 Architecture Codex 创建的规划/提案文件。Implementation Codex 可以更新 `tasks.md` 勾选，但不得改 proposal/design/spec。

## GeneratedOrNoisyArtifacts

- `.next/**`
- `web/.next/**`
- `coverage/**`
- `node_modules/**`
- `contracts/out/**`
- `contracts/cache/**`

不要把构建产物纳入提交或任务证据，除非用户另行要求。

## Graphify Context

- `graphify query "web homepage market card detail theme board architecture dependencies"` 命中 `CryptoMarketCard.tsx`、`WorldCupMarketCard.tsx`、`MarketDetailCard.tsx`、`BaseMarketCard.tsx`、`MarketCard.tsx`。
- `graphify query "web homepage market card detail theme board impact callers tests dependencies"` 命中同一组前端组件。
- `graphify-out/GRAPH_REPORT.md` 显示核心影响社区包括卡片组件、详情页、测试辅助、Lens/图表薄社区与 claim/resolve 相关节点。图谱对首页 rich sections 的覆盖不完整，已降级结合源码和测试阅读。

## Validation

Worker 至少运行并记录：

```bash
cd web && pnpm exec vitest run test/market-richness.test.ts
cd web && pnpm exec vitest run test/theme-market-pages.test.ts components/__tests__/ThemeMarketBoard.test.tsx
cd web && node test/check_home_page.mjs
cd web && node test/check_market_components.mjs
cd web && pnpm typecheck
```

如果实现触及 `HomeHero` 或全局样式，也运行：

```bash
cd web && node test/check_home_hero.mjs
```

完成前尽量运行：

```bash
cd web && pnpm build
```

如 build 因网络字体或已知可选依赖 warning 失败/降级，记录完整原因。

## Stop Conditions

- 需要修改 `contracts/**`。
- 需要新增依赖或改 package/lock/config。
- 需要引入数据库、服务端持久化、真实外部 API 或自动 Lens POST。
- 发现 rich sections 必须伪造历史趋势才能达成。
- 下注按钮被 Link 包裹或现有下注/claim 路径被破坏。
- 测试无法建立 RED 证据。
- 文件范围超出 allowlist。

## Implementation Instructions

1. 严格 TDD：先写失败测试，确认 RED，再实现 GREEN，再整理。
2. 先做 `web/lib/market-richness.ts`，再接首页/详情页 UI。
3. 所有新增用户可见文案保持英文；代码注释如需添加使用中文。
4. 不做法务合规提示，不做风险教育模块。
5. 不伪造 24h delta、下注人数、成交历史或 activity feed。
6. 保持现有视觉语言，但让首页更有层级：主推、主题、发现列表、市场网格。
7. final handback 必须包含 changed files、RED/GREEN/最终验证命令与结果、未验证项、范围扩展请求。
