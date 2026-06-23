# Phase 7 / 10.x 非广播收口验证报告

## 环境

- 日期：2026-06-23
- Git baseline：`0d4fba0 feat(markets): add automated category visuals`
- 活跃 OpenSpec change：`add-worldcup-category`
- Anvil 版本：`anvil Version: 1.5.1-stable`，Commit `b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2`
- Forge 版本：`forge Version: 1.5.1-stable`，Commit `b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2`
- 前端测试环境：`web` 目录，`pnpm exec vitest run`
- Graphify：`graphify-out/graph.json` 存在；web 查询命中 `event-source.test.tsx` / `worldcup-components.test.tsx`，合约查询命中不相关节点，已降级读取 `graphify-out/GRAPH_REPORT.md` 并结合源码/测试确认影响面。

## 10.4 三条挑战路径验证

执行文件：`contracts/script/Phase7E2EChallengePaths.s.sol`

尝试按 7a 文档启动本地 Anvil RPC：

```bash
anvil --host 127.0.0.1 --port 8545 --chain-id 31337
```

沙箱返回 `Error: Operation not permitted (os error 1)`，本轮无法绑定本地 RPC 端口。随后执行同一脚本的 Foundry 离线 dry-run，仍使用 `vm.warp` / `vm.prank` / 本地 EVM 部署、seed、下注、挑战、结算和 claim 断言。

```bash
cd contracts
forge script --offline script/Phase7E2EChallengePaths.s.sol -vvv
```

结果：exit `0`，`Script ran successfully.`，`Gas used: 51821503`。

### 10.4.1 owner 撤销路径

- 路径：`proposeResult(outcome=2)` -> `challenge` -> `revokeProposal` -> 回到 `Pending` -> 重新 `proposeResult(outcome=0)` -> `finalizeResult` -> `EventMarket.resolve` -> claim
- 模拟地址：
  - MockUSDC：`0x5aAdFB43eF8dAF45DD80F4676345b7676f1D70e3`
  - AdminEventOracle：`0xf13D09eD3cbdD1C930d4de74808de1f33B6b3D4f`
  - EventMarket：`0x5c4a3C2CD1ffE6aAfDF62b64bb3E620C696c832E`
- final-1 marketId：`96`
- challenge stake in oracle：`100000000`
- 资金对账：
  - ALICE final balance：`10198000000`
  - BOB final balance：`10000000000`，挑战者收回下注外质押并获得 bonus
  - CHARLIE final balance：`9900000000`
  - feeRecipient balance：`2000000`
  - bonusBank balance：`9900000000`
  - market remaining balance：`0`
- tx hash：`N/A（forge script dry-run，未 broadcast）`

### 10.4.2 owner 驳回路径

- 路径：`proposeResult(outcome=0)` -> `challenge` -> `confirmProposal` -> `Finalized` -> `EventMarket.resolve` -> claim
- 模拟地址：
  - MockUSDC：`0x6AE5E129054a5dBFCeBb9Dfcb1CE1AA229fB1Ddb`
  - AdminEventOracle：`0xcD95e0E356A5f414894Be4bAD363acdaCcAb30a9`
  - EventMarket：`0x961e384b66ae2Bb90c9bBdd3d5105397E70a7A37`
- final-1 marketId：`96`
- challenge stake in oracle：`100000000`
- 资金对账：
  - ALICE final balance：`10198000000`
  - BOB final balance：`9800000000`，挑战质押被没收到 feeRecipient
  - CHARLIE final balance：`9900000000`
  - feeRecipient balance：`102000000`
  - bonusBank balance：`10000000000`
  - market remaining balance：`0`
- tx hash：`N/A（forge script dry-run，未 broadcast）`

### 10.4.3 owner 不响应 finalizeOnTimeout 路径

- 路径：`proposeResult(outcome=0)` -> `challenge` -> warp 72h+ -> 任意 EOA `finalizeOnTimeout` -> `EventMarket.resolve` -> claim
- 模拟地址：
  - MockUSDC：`0x41b343Df2196081e42ac8Da11a1aA38De08e8658`
  - AdminEventOracle：`0xC33F7eF76C2bBC678794516f038e62Ce3fAE6072`
  - EventMarket：`0x7a3CE1E2bF7dBbb4A1B3039Cc468a915b2596cA8`
- final-1 marketId：`96`
- challenge stake in oracle：`100000000`
- 资金对账：
  - ALICE final balance：`10198000000`
  - BOB final balance：`9900000000`，挑战质押退还、无 bonus
  - CHARLIE final balance：`9900000000`
  - feeRecipient balance：`2000000`
  - bonusBank balance：`10000000000`
  - market remaining balance：`0`
- tx hash：`N/A（forge script dry-run，未 broadcast）`

## 10.6 比分 API 失败降级

新增测试：`web/test/event-source.degradation.test.tsx`

覆盖矩阵：

- 网络错误
- HTTP 4xx
- HTTP 5xx
- HTTP 429
- timeout / `TimeoutError`
- 200 但 `events: []`
- 200 但 `response.json()` 抛出非法 JSON 错误

执行命令：

```bash
cd web
pnpm exec vitest run test/event-source.degradation.test.tsx
```

结果：`Test Files 1 passed (1)`，`Tests 7 passed (7)`。

相关回归：

```bash
cd web
pnpm exec vitest run test/event-source.test.tsx test/event-source.degradation.test.tsx test/worldcup-components.test.tsx test/components/MarketFilterBar.test.tsx
```

结果：`Test Files 4 passed (4)`，`Tests 36 passed (36)`。

UI 调用方核对：

- `EventInfoPanel` 仅在 `useLiveScore` 成功且比分字段非空时显示比分。
- 降级时组件显示赛程基础信息与说明文案，不阻断 `WorldCupOutcomePanel`、`EventBetModal` 或 claim 相关链上操作。
- Crypto 下注 / claim 路径使用 `BetForm` / `ResolvedList`，不依赖 `event-source.ts`。

## 10.1 灰度关闭回归

灰度变量按单命令注入，未写入本地环境文件：

```bash
NEXT_PUBLIC_WORLDCUP_ENABLED=false pnpm exec vitest run
```

结果：`Test Files 36 passed | 2 skipped (38)`，`Tests 155 passed | 3 skipped (158)`。

```bash
NEXT_PUBLIC_WORLDCUP_ENABLED=false pnpm build
```

结果：exit `0`，关键行：

- `✓ Compiled successfully`
- `✓ Generating static pages (5/5)`
- 路由表包含 `/`、`/connect`、`/market/[id]`、`/api/cron/markets/tick`、`/api/lens/[marketId]`

构建期间存在既有依赖/环境 warning：

- Google Fonts 下载失败，跳过字体优化。
- RainbowKit / Wagmi 依赖链对可选包 `@react-native-async-storage/async-storage`、`pino-pretty` 有 warning。
- `metadataBase` 未配置，Next 使用 `http://localhost:3000`。

上述 warning 未导致 build 失败。

```bash
NEXT_PUBLIC_WORLDCUP_ENABLED=false pnpm typecheck
```

结果：exit `0`，`tsc --noEmit` 无输出错误。

补充静态 smoke：

```bash
NEXT_PUBLIC_WORLDCUP_ENABLED=false node test/check_worldcup_ui.mjs
NEXT_PUBLIC_WORLDCUP_ENABLED=false node test/check_home_hero.mjs
NEXT_PUBLIC_WORLDCUP_ENABLED=false node test/check_market_filter.mjs
NEXT_PUBLIC_WORLDCUP_ENABLED=false node test/check_position_lists.mjs
```

结果分别为：

- `worldcup ui 检查通过`
- `home hero 检查通过`
- `market filter 检查通过`
- `position lists 检查通过`

未采用 `node test/check_bet_modal.mjs` 作为 10.1 证据：该旧静态脚本在默认环境也失败，原因是下注读写逻辑已从 `BetModal.tsx` 重构到 `BetForm.tsx`，脚本仍扫描旧文件。人工代码路径核对显示 `BetForm.tsx` 仍显式使用 `chainId: arcTestnet.id`、`PREDICTION_MARKET_ADDRESS`、USDC approve、bet 写入、Faucet 链接；`ResolvedList.tsx` claim 路径仍写入 `PredictionMarket.claim`。

## Section 0.7 / 归档前完整性检查草案

- ✅ specs/ 完整性草案：`openspec/changes/add-worldcup-category/specs/worldcup-category/spec.md` 与 `event-oracle/spec.md` 仍保留完整 delta。
- ✅ design.md 完整性：`openspec/changes/add-worldcup-category/design.md` 覆盖合约、oracle、前端、灰度、API 降级和回滚。
- ⚠️ delta 合并到 specs/：未执行；按任务要求留给 11.3。
- ⚠️ tasks.md 全部 `[x]`：未完成；10.3 与 11.3 仍待 Wave 3，10.7 post-archive smoke 不阻塞 archive。
- ✅ changes/ 状态：本轮未归档，`openspec list` 仍保留 `add-worldcup-category` 活跃。
- ✅ strict validate：本轮结束前执行 `openspec validate add-worldcup-category --strict`。

## 结论

- 10.1、10.4、10.6 的非广播验证证据已补齐。
- 10.3 真实 testnet 广播、首笔下注证据、11.3 spec sync + archive 未执行。
- 10.7 post-archive smoke 仍保持后续补录，不阻塞归档。
