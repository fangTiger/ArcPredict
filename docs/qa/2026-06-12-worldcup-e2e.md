# 2026-06-12 World Cup Phase 7 E2E 验证记录

## 结论

Phase 7 当前状态：**本地模拟、前端回归、移动端视觉与 Slither 审计通过；真实测试网 E2E 未执行**。

Review Codex 结论：`PASS` 仅适用于本轮 Phase 7.6 bundle 报告脚本与记录；这不是 Phase 7 整体完成判定。

未执行测试网 E2E 的原因：
- `contracts/.env` 缺少 `BONUS_BANK_ADDRESS`、`EVENT_MARKET_ADDRESS`、`ADMIN_EVENT_ORACLE_ADDRESS`。
- 项目根 `.env` 不存在；广播所需变量未在根目录环境中提供。
- 未经单独确认，不执行真实测试网 `--broadcast` 交易。

## 环境探测

只检查变量是否存在，未输出任何密钥值。

根目录环境：

```text
RPC_URL=UNSET
OWNER_PRIVATE_KEY=UNSET
SEED_PRIVATE_KEY=UNSET
USDC_ADDRESS=UNSET
FEE_RECIPIENT=UNSET
BONUS_BANK_ADDRESS=UNSET
EVENT_MARKET_ADDRESS=UNSET
ADMIN_EVENT_ORACLE_ADDRESS=UNSET
PREDICTION_MARKET=UNSET
```

`contracts/.env`：

```text
RPC_URL=SET
OWNER_PRIVATE_KEY=SET
SEED_PRIVATE_KEY=SET
USDC_ADDRESS=SET
FEE_RECIPIENT=SET
BONUS_BANK_ADDRESS=UNSET
EVENT_MARKET_ADDRESS=UNSET
ADMIN_EVENT_ORACLE_ADDRESS=UNSET
PREDICTION_MARKET=SET
```

## 本地合约验证

```bash
cd contracts
forge test --offline --match-contract EventMarketE2E
```

结果：3 passed / 0 failed。

覆盖：
- 1X2 路径：下注 → owner 提交结果 → 72h 后 finalize → resolve → winner claim。
- 大小球 / 让分路径：OVER / UNDER 下注 → owner 提交 OVER → 72h 后 finalize → resolve → winner claim。
- 冠军盘路径：32 outcome 下注 → owner 提交冠军 → finalize → resolve → champion claim。

```bash
cd contracts
forge test --offline --match-contract AdminEventOracle
```

结果：17 passed / 0 failed。

覆盖：
- owner 撤销：挑战方拿回 stake + bonus。
- owner 驳回：挑战方 stake 罚没。
- owner 不响应：72h 后任意人 finalizeOnTimeout，挑战方取回 stake，无 bonus。
- 未注册 eventId 默认 `Pending`。

```bash
cd contracts
forge test --offline --match-contract EventMarket
```

结果：49 passed / 0 failed。

覆盖：
- 2-outcome / 3-outcome / 32-outcome 市场创建。
- 下注、resolve、claim、invalid refund、已淘汰队伍持仓保留。

## 前端与灰度验证

```bash
node web/test/check_worldcup_data_layer.mjs
node web/test/check_worldcup_ui.mjs
node web/test/check_market_filter.mjs
node web/test/check_flag_bundle.mjs
pnpm --dir web exec vitest run test/event-source.test.tsx test/worldcup-components.test.tsx
```

结果：
- data layer 检查通过。
- UI 静态检查通过。
- market filter 检查通过。
- flag bundle 检查通过：9 个 SVG assets，50,302 bytes gzip build。
- Vitest：2 files passed，13 tests passed。

补充复验：

```bash
pnpm --dir web exec vitest run test/event-source.test.tsx test/worldcup-components.test.tsx
node web/test/check_worldcup_data_layer.mjs
node web/test/check_market_filter.mjs
node web/test/check_position_lists.mjs
```

结果：
- Vitest：2 files passed，14 tests passed。
- data layer / market filter / position lists 检查通过。

```bash
NEXT_PUBLIC_WORLDCUP_ENABLED=false pnpm --dir web build
node web/test/check_routes.mjs
node web/test/check_site_chrome.mjs
node web/test/check_position_lists.mjs
```

结果：
- build 通过；仍有既有钱包依赖与 Google Fonts 下载 warning。
- routes / site chrome / position lists 检查通过。

```bash
NEXT_PUBLIC_WORLDCUP_ENABLED=true pnpm --dir web build
CHECK_FLAG_BUNDLE_REQUIRE_BUILD=1 node web/test/check_flag_bundle.mjs
node web/test/check_routes.mjs
node web/test/check_worldcup_ui.mjs
openspec validate add-worldcup-category --strict --no-interactive
```

结果：
- World Cup enabled build 通过；仍有既有钱包依赖与 Google Fonts 下载 warning。
- flag bundle 构建产物检查通过：9 个 SVG assets，50,302 bytes gzip build，预算 81,920 bytes。
- `.next/analyze/worldcup-flag-bundle.json` 与 `.next/analyze/worldcup-flag-bundle.md` 已生成。
- routes / worldcup ui 检查通过。
- OpenSpec strict validate 通过。

灰度关闭限制：
- 已验证首页、路由、站点 chrome、持仓列表和 World Cup 痕迹隐藏。
- 未执行真实钱包连接、下注、领奖、Faucet 链上/浏览器交互；这些属于 Phase 7.1 剩余人工 E2E。
- `.next/analyze` 已生成 World Cup flag bundle 审计报告；当前没有引入 `@next/bundle-analyzer` 依赖，因此报告聚焦本轮新增 SVG 国旗依赖体积。

## 浏览器视觉验证

本地服务：

```bash
NEXT_PUBLIC_WORLDCUP_ENABLED=true pnpm --dir web exec next dev -H 127.0.0.1 -p 3001
NEXT_PUBLIC_WORLDCUP_ENABLED=false pnpm --dir web exec next dev -H 127.0.0.1 -p 3002
```

验证记录：
- `http://127.0.0.1:3001/?category=worldcup`：World Cup Tab 可见，看到 1X2 / spread / winner 卡片，绿茵背景生效。
- iPhone 12 viewport：World Cup 1X2 卡片默认折叠；点击第一张卡片的“展开”后显示平局、客胜与“收起”。
- `http://127.0.0.1:3001/market/9001?kind=event`：详情页显示 EventInfoPanel、ImpliedProbability、Resolution Source: AdminEventOracle (Owner + 72h Dispute Window)。
- `http://127.0.0.1:3001/market/9001?kind=event`：事件详情页“返回首页”链接保留 `/?category=worldcup`，避免回到默认 Crypto Tab。
- `http://127.0.0.1:3002/`：灰度关闭时无 World Cup Tab，无 World Cup 卡片。

运行态修正记录：
- 现象：`http://127.0.0.1:3001/?category=worldcup` 一度只渲染 Crypto 筛选，用户看到 World Cup Tab 消失。
- 根因：`web/.next/static/chunks/app/page.js` 仍保留先前灰度关闭构建产物，`WORLDCUP_ENABLED` 被内联为 `"false" === "true"`。
- 处理：停止 dev server，将旧 `web/.next` 移到 `/private/tmp/arcpredict-web-next-cache-phase7`，再用 `NEXT_PUBLIC_WORLDCUP_ENABLED=true pnpm --dir web exec next dev -H 127.0.0.1 -p 3001` 重启。
- 复验：World Cup / Crypto Tab、Stage 子过滤、1X2 / SPREAD / WINNER 卡片恢复；事件详情页返回链接为 `/?category=worldcup`。
- 二次修正：Phase 7.5 浏览器验证时，详情页一度返回 500，原因为生产 build 与 dev 产物混用后缺失 dev vendor chunk。已停止旧 `3001` 进程，将坏缓存移到 `/private/tmp/arcpredict-web-next-cache-phase75-20260613002355`，并用同一灰度开启命令重新启动 dev server。

截图：
- `docs/qa/screenshots/worldcup/phase7-worldcup-desktop.png`
- `docs/qa/screenshots/worldcup/phase7-worldcup-mobile-iphone12.png`
- `docs/qa/screenshots/worldcup/phase7-worldcup-detail-mobile.png`
- `docs/qa/screenshots/worldcup/phase7-flag-off-desktop.png`

## 比分 API 失败降级

本轮没有永久硬改 `event-source.ts` 的 base URL。已增加仅开发态且显式 query 参数触发的验证入口：
- `wcLiveScoreFixture=<matchId|all|1>`：在非 production 下强制指定 matchId 进入进行中状态。
- `wcScoreApiBase=<url>`：在非 production 下临时覆写比分 API base URL。

自动化测试覆盖失败降级与轮询策略：

```bash
pnpm --dir web exec vitest run test/event-source.test.tsx test/worldcup-components.test.tsx
```

结果：2 files passed，16 tests passed。

覆盖：
- fetch 抛错时返回 `error + null score`。
- EventInfoPanel 在比赛进行中且比分服务失败时隐藏数值比分，展示“比分服务暂不可用，已回退到赛程信息。”。
- Page Visibility 隐藏时停止轮询。
- IntersectionObserver 滚出视口时停止轮询。
- 重新可见 / 重新进入视口时补拉。
- 开发态 query 可让 `matchInProgress=false` 的详情页进入进行中并按 60s 轮询。
- 开发态 query 可临时覆写比分 API base URL。

本地浏览器 + mock 比分服务观察：

```bash
node -e "/* 127.0.0.1:3999 临时 503 mock，比对 stdout 请求计数 */"
```

验证记录：
- `http://127.0.0.1:3001/?category=worldcup&wcScoreApiBase=http://127.0.0.1:3999/mock`：列表页渲染 World Cup 卡片，mock 服务 0 请求。
- `http://127.0.0.1:3001/market/9001?kind=event&wcLiveScoreFixture=group-c-4&wcScoreApiBase=http://127.0.0.1:3999/mock`：详情页显示比分降级文案。
- mock 服务第 1 次请求：`/mock/lookupevent.php?id=1543899` at `2026-06-12T16:25:27.769Z`。
- mock 服务第 2 次请求：`/mock/lookupevent.php?id=1543899` at `2026-06-12T16:26:27.768Z`，间隔约 60s。

限制：
- in-app Browser 的“新标签页”操作实际复用了当前 tab，无法严格模拟 DevTools 中的后台 Tab `document.visibilityState=hidden`。
- 因此 Phase 7.5 仍不勾选完成；“切走 Tab 后 0 请求”的真实 DevTools Network 观察仍需在可多标签隐藏的浏览器环境中执行。当前仅有 Vitest 对 Page Visibility 停止轮询的自动化覆盖。

## Slither 审计

本轮在临时目录安装 Slither 与 `solc 0.8.24`，未写入项目依赖：

```bash
HOME=/private/tmp/arcpredict-slither-home SOLC_VERSION=0.8.24 \
  /private/tmp/arcpredict-slither-venv/bin/slither src/AdminEventOracle.sol \
  --compile-force-framework solc \
  --solc /private/tmp/arcpredict-slither-venv/bin/solc \
  --solc-remaps '@openzeppelin/=lib/openzeppelin-contracts/ @pythnetwork/=lib/pyth-sdk-solidity/ forge-std/=lib/forge-std/src/' \
  --filter-paths 'lib|test|script' \
  --fail-medium

HOME=/private/tmp/arcpredict-slither-home SOLC_VERSION=0.8.24 \
  /private/tmp/arcpredict-slither-venv/bin/slither src/EventMarket.sol \
  --compile-force-framework solc \
  --solc /private/tmp/arcpredict-slither-venv/bin/solc \
  --solc-remaps '@openzeppelin/=lib/openzeppelin-contracts/ @pythnetwork/=lib/pyth-sdk-solidity/ forge-std/=lib/forge-std/src/' \
  --filter-paths 'lib|test|script' \
  --fail-medium
```

结果：
- `AdminEventOracle.sol`：exit 0；无 High / Medium。剩余 Low 为 `timestamp`，Informational 为常量命名，Optimization 为 `feeRecipient` / `bonusBank` 可 immutable。
- `EventMarket.sol`：exit 0；无 High / Medium。剩余 Low 为 `timestamp`，Informational 为常量命名。
- 初次审计中 `AdminEventOracle.revokeProposal()` 的 `bonusBank -> challenger` 奖励金付款被 Slither 标记为 `arbitrary-send-erc20` High。该路径仅 `onlyOwner` 可触发，`bonusBank` 为构造期固定账户，金额为固定 `BONUS`，因此按误报处理并在代码旁用 Slither directive 抑制。
- 初次审计中 `EventMarket.resolve()` 的 `totalPool == 0 || winningPool == 0` 被标记为 `incorrect-equality` Medium；已改为等价的 `< 1` 判断并重跑测试。

## 未完成项

- 测试网 6 条 E2E 路径未广播，缺少链上交易哈希。
- `DeployWorldCup.s.sol` 与 `SeedWorldCupMarkets.s.sol` 未在测试网执行。
- `SeedWorldCupLiquidity.s.sol` 未在测试网执行。
- 灰度关闭下真实钱包连接、下注、领奖、Faucet 交互未执行；当前只有 build 与静态/浏览器回归证据。
- `.next/analyze` 仅包含本轮新增 SVG 国旗依赖审计报告；未引入官方 bundle analyzer 的完整 bundle treemap。
- DevTools Network 面板人工观察未执行；当前页面无进行中比赛，本轮用 Vitest 覆盖轮询策略。

## 继续测试网 E2E 的前置条件

需要补齐：

```text
BONUS_BANK_ADDRESS
EVENT_MARKET_ADDRESS
ADMIN_EVENT_ORACLE_ADDRESS
```

建议顺序：
1. 设置 `BONUS_BANK_ADDRESS`。
2. 在 `contracts/` 下执行 `DeployWorldCup.s.sol` 测试网广播。
3. 将输出的 `EVENT_MARKET_ADDRESS`、`ADMIN_EVENT_ORACLE_ADDRESS` 写入 `contracts/.env`。
4. 执行 `SeedWorldCupMarkets.s.sol` 测试网广播。
5. 对代表性市场执行 `SeedWorldCupLiquidity.s.sol`。
6. 记录每笔交易哈希后重跑 Phase 7 DoD。
