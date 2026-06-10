# ArcPredict Phase 15 手动 QA 记录（2026-06-10）

- 当前状态：Pending external manual QA（外部逐项证据待固化）
- 记录范围：依据 `docs/superpowers/specs/2026-06-07-arc-predict-design.md` §7.4 整理 Phase 15 手动 QA 清单。
- 记录目的：先补齐可审计记录与静态检查，避免后续生产环境手动验证遗漏。
- 说明：已增加生产构建前的公开环境变量校验；`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` 与 `NEXT_PUBLIC_PYTH_HERMES_ENDPOINT` 已写入 Vercel Production 并通过校验。
- 用户反馈：2026-06-10 用户已在部署环境测试并反馈“功能正常”；本文件仍保留 Pending 标记，因为逐项截图、交易哈希、移动端录屏等证据尚未固化到仓库。

## 当前阻塞与前置条件

- Vercel Production 已部署，部署地址：`https://web-jtwxdk2xh-arcpredict.vercel.app`，生产别名：`https://web-arcpredict.vercel.app`。
- Vercel SSO Deployment Protection 已关闭，匿名访问生产别名返回 HTTP 200。
- 用户已反馈 MetaMask / WalletConnect / 核心功能测试正常，但仓库内尚未补齐 Coinbase Wallet、Safari iOS、Chrome Android、交易哈希、截图/录屏等逐项证据。

## 当前自动化证据

以下内容只能作为辅助证据，不能替代手动 QA：

- `node docs/qa/check_phase15_manual_qa.mjs`：校验本记录文件存在、15 项 QA 清单齐全、阻塞关键字齐全，且未出现误导性通过宣称。
- `node web/test/check_production_env.mjs`：复核生产构建前公开环境变量校验已覆盖缺失值、占位值与合法配置。
- `node web/test/check_vercel_config.mjs`：复核 Phase 15.1 本地 Vercel 配置约束。
- `cd web && pnpm typecheck`：复核前端 TypeScript 类型检查。
- `pnpm exec vercel pull --environment=production --yes`：已拉取 `arcpredict/web` Production 环境变量。
- `set -a; source .vercel/.env.production.local; set +a; node scripts/ensure-production-env.mjs`：生产环境变量校验通过。
- `pnpm exec vercel deploy --prod`：已生成 READY 状态部署 `dpl_DGYDDC8CcUwhRbxPGCJugvk9qfk6`。
- `pnpm exec vercel inspect web-jtwxdk2xh-arcpredict.vercel.app`：部署状态为 Ready。
- `pnpm exec vercel curl / --deployment https://web-jtwxdk2xh-arcpredict.vercel.app`：保护层后页面包含 `ArcPredict` 首页内容。
- `pnpm exec vercel project protection`：`ssoProtection` 为 `null`，SSO Deployment Protection 已关闭。
- `curl -fsSI https://web-arcpredict.vercel.app`：匿名访问返回 HTTP 200。
- `curl -fsS https://web-arcpredict.vercel.app | rg "ArcPredict|市场总览|Arc Testnet|0xCFDC"`：匿名访问页面包含 ArcPredict 首页内容。

## spec §7.4 手动 QA 清单记录

| 手动 QA 项 | 状态 | 证据/结果 | 备注 |
| --- | --- | --- | --- |
| MetaMask 浏览器扩展连接 + 切换到 Arc testnet | 用户反馈通过 | 用户反馈部署环境功能正常。 | 需补截图或录屏证据。 |
| WalletConnect 手机扫码连接 | 用户反馈通过 | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` 已配置到 Vercel Production；用户反馈功能正常。 | 需补手机扫码录屏或截图证据。 |
| Coinbase Wallet 连接 | 待执行 | 尚未固化 Coinbase Wallet 真机或扩展连接证据。 | 需记录连接成功页面、账户展示与链状态。 |
| Faucet 领 USDC 后下注成功 | 用户反馈通过 | 用户反馈部署环境功能正常。 | 需补 faucet 到账、USDC 余额变化、下注交易哈希与前端结果。 |
| 余额不足时按钮正确禁用 | 待执行 | 尚未固化真实余额不足账户下的按钮禁用证据。 | 需记录按钮禁用态、文案与钱包余额截图。 |
| 链错误时切换提示生效 | 待执行 | 尚未固化错误链环境下的切链提示证据。 | 需记录错误链进入页面后的提示、切换动作与结果。 |
| approve 流程正确（首次签名 + 后续免） | 用户反馈通过 | 用户反馈部署环境功能正常。 | 需补首次 approve 签名、再次下注免 approve 的完整链路证据。 |
| Bet Modal "Implied Win" 数字与合约计算一致 | 待执行 | 尚未固化前端显示与合约计算结果对照证据。 | 需记录输入金额、前端数字、链上池子数据与对照过程。 |
| 下注后 Bet event 正确，前端刷新仓位 | 用户反馈通过 | 用户反馈部署环境功能正常。 | 需补交易哈希、事件日志、前端刷新后的仓位展示。 |
| resolve 后 claim 金额与公式一致 | 待执行 | 尚未固化可 resolve 市场与真实 claim 交易证据。 | 需记录 resolve 结果、claim 金额公式、实际到账金额与交易哈希。 |
| Invalid 情况下退款正确 | 待执行 | 尚未固化 Invalid 市场真实退款流程证据。 | 需记录 Invalid 触发原因、退款前后余额、claim 结果与交易哈希。 |
| 移动端浏览器（Safari iOS + Chrome Android）布局可用 | 待执行 | 尚未固化 Safari iOS 与 Chrome Android 真机证据。 | 需补充移动端截图或录屏，覆盖连接、市场详情、Bet Modal、/connect 页面。 |
| Dark / Light 模式切换 | 待执行 | 尚未固化真实浏览器环境下逐页切换主题验证。 | 需记录首页、`/market/[id]`、`/connect` 在两种模式下的可读性与布局。 |
| `/market/[id]` 深链可分享 | 用户反馈通过 | 用户反馈部署环境功能正常。 | 需补分享链接、打开结果、市场内容加载证据。 |
| `/connect` 故障排查页可用 | 用户反馈通过 | 用户反馈部署环境功能正常。 | 需补页面可访问性、网络参数展示与故障排查信息截图。 |

## 收尾要求

只有完成所有手动项并补齐证据后，才允许执行 allow-empty 的 QA 全通过提交。
