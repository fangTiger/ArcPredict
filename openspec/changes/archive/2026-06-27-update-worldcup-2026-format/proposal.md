# 变更：修正 World Cup 品类为 2026 赛制

## 为什么

当前 World Cup 品类仍以 2022 世界杯的 32 队、64 场、8 小组数据为基础，只在部分展示市场中使用了 2026 年时间，导致用户看到的世界杯市场与 2026 年真实赛制不一致。2026 世界杯为 48 队、12 小组、104 场，并新增 32 强淘汰阶段，前端 seed、过滤和规范必须同步修正。

## 变更内容

- 将 `worldcup-category` 赛程要求从 32 队 / 64 场更新为 48 队 / 104 场。
- 新增 `r32` 阶段，World Cup 阶段过滤包含 Group / R32 / R16 / QF / SF / Final / Winner。
- 更新 `web/lib/worldcup-seed.ts` 的 2026 队伍、分组、赛程、占位符和阶段 helper。
- 更新 World Cup skeleton markets，避免继续展示 2022 对阵伪装成 2026 市场。
- 更新测试，确保 48 队、12 组、72 场小组赛、32 场淘汰赛和 2026 UTC 时间被验证。

## 影响范围

- 受影响的规范：`worldcup-category`
- 受影响的代码：`web/lib/worldcup-seed.ts`、`web/lib/market-kind.ts`、`web/lib/worldcup-markets.ts`、`web/components/MarketFilterBar.tsx`
- 受影响的测试：`web/test/worldcup-seed.test.ts`、`web/test/check_worldcup_seed.mjs`、`web/test/check_market_filter.mjs`、World Cup 相关组件/数据层测试
