# ArcPredict Phase 15 手动 QA 记录（2026-06-10）

- 当前状态：Pending external manual QA（外部手动 QA 待完成）
- 记录范围：依据 `docs/superpowers/specs/2026-06-07-arc-predict-design.md` §7.4 整理 Phase 15 手动 QA 清单。
- 记录目的：先补齐可审计记录与静态检查，避免后续生产环境手动验证遗漏。

## 当前阻塞与前置条件

- 缺少 Vercel 生产 URL 或项目链接，当前无法对线上部署结果做真实手动验证。
- 缺少 `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` 的生产环境确认，WalletConnect 生产连接前置条件未闭合。
- 需要准备可实际操作的 MetaMask 浏览器扩展、WalletConnect 手机扫码环境、Coinbase Wallet、Safari iOS、Chrome Android。
- 需要可用 faucet、测试资金与 USDC 余额，才能完成下注、approve、claim、Invalid 退款等真实链路验证。

## 当前自动化证据

以下内容只能作为辅助证据，不能替代手动 QA：

- `node docs/qa/check_phase15_manual_qa.mjs`：校验本记录文件存在、15 项 QA 清单齐全、阻塞关键字齐全，且未出现误导性通过宣称。
- `node web/test/check_vercel_config.mjs`：复核 Phase 15.1 本地 Vercel 配置约束。
- `cd web && pnpm typecheck`：复核前端 TypeScript 类型检查。

## spec §7.4 手动 QA 清单记录

| 手动 QA 项 | 状态 | 证据/结果 | 备注 |
| --- | --- | --- | --- |
| MetaMask 浏览器扩展连接 + 切换到 Arc testnet | 受阻 | 当前机器未提供生产 URL 与可确认的线上钱包连接目标。 | 需在生产部署可访问后，用 MetaMask 实测连接、签名、切链提示与 Arc testnet 网络切换。 |
| WalletConnect 手机扫码连接 | 受阻 | 缺少 `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` 的生产环境确认，且暂无可扫码生产会话。 | 需补齐生产环境变量，并提供手机扫码录屏或截图证据。 |
| Coinbase Wallet 连接 | 待执行 | 尚未进行 Coinbase Wallet 真机或扩展连接验证。 | 需记录连接成功页面、账户展示与链状态。 |
| Faucet 领 USDC 后下注成功 | 受阻 | 当前未拿到可用 faucet/USDC 资金证据，无法在真实环境下注。 | 需记录 faucet 到账、USDC 余额变化、下注交易哈希与前端结果。 |
| 余额不足时按钮正确禁用 | 待执行 | 尚未在真实余额不足账户下做按钮禁用验证。 | 需在前端记录按钮禁用态、文案与钱包余额截图。 |
| 链错误时切换提示生效 | 待执行 | 尚未在错误链环境下触发切链提示。 | 需记录错误链进入页面后的提示、切换动作与结果。 |
| approve 流程正确（首次签名 + 后续免） | 受阻 | 当前无生产环境资金与钱包证据，未执行首次 approve 与后续复用验证。 | 需记录首次 approve 签名、再次下注免 approve 的完整链路。 |
| Bet Modal "Implied Win" 数字与合约计算一致 | 待执行 | 尚未在真实市场池子状态下对比前端显示与合约计算结果。 | 需记录输入金额、前端数字、链上池子数据与对照过程。 |
| 下注后 Bet event 正确，前端刷新仓位 | 受阻 | 尚未产生真实下注交易，因此没有 Bet event 与仓位刷新证据。 | 需记录交易哈希、事件日志、前端刷新后的仓位展示。 |
| resolve 后 claim 金额与公式一致 | 受阻 | 当前缺少可 resolve 的生产市场与真实 claim 交易。 | 需记录 resolve 结果、claim 金额公式、实际到账金额与交易哈希。 |
| Invalid 情况下退款正确 | 受阻 | 尚未构造并验证 Invalid 市场的真实退款流程。 | 需记录 Invalid 触发原因、退款前后余额、claim 结果与交易哈希。 |
| 移动端浏览器（Safari iOS + Chrome Android）布局可用 | 受阻 | 当前没有 Safari iOS 与 Chrome Android 真机证据。 | 需补充移动端截图或录屏，覆盖连接、市场详情、Bet Modal、/connect 页面。 |
| Dark / Light 模式切换 | 待执行 | 尚未在真实浏览器环境下逐页切换主题验证。 | 需记录首页、`/market/[id]`、`/connect` 在两种模式下的可读性与布局。 |
| `/market/[id]` 深链可分享 | 受阻 | 缺少可访问的生产 URL，暂无法验证深链分享落地效果。 | 需记录分享链接、打开结果、市场内容是否正确加载。 |
| `/connect` 故障排查页可用 | 待执行 | 尚未在生产部署页面人工检查该页面内容与跳转。 | 需记录页面可访问性、网络参数展示与故障排查信息。 |

## 收尾要求

只有完成所有手动项并补齐证据后，才允许执行 allow-empty 的 QA 全通过提交。
