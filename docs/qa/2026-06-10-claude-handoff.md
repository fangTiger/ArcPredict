# ArcPredict Claude 交接摘要（2026-06-10）

## 当前结论

- MVP Phase 0 到 Phase 15 的实现任务已完成，`docs/superpowers/plans/2026-06-08-arc-predict-mvp.md` 的 checkbox 已同步为完成。
- spec 真相源仍是 `docs/superpowers/specs/2026-06-07-arc-predict-design.md`。
- 用户已在部署环境测试并反馈“功能正常”。
- 生产部署已完成，Vercel SSO Deployment Protection 已关闭，生产别名可匿名访问。

## 关键地址

- PredictionMarket：`0xCFDC9B7F4a4c360CF5B3a31Bb33eB46aD8A3dA43`
- Vercel project：`arcpredict/web`
- Production deployment：`https://web-jtwxdk2xh-arcpredict.vercel.app`
- Production alias：`https://web-arcpredict.vercel.app`
- Vercel deployment id：`dpl_DGYDDC8CcUwhRbxPGCJugvk9qfk6`

## 最近提交

- `1d511e1` `test(web): 补生产环境校验覆盖`
- `d7ca45d` `chore(web): 安装 Vercel CLI`
- `003beae` `deploy(web): 校验生产环境变量`
- `0726e89` `docs(qa): 添加 Phase 15 手动 QA 记录`
- `686d8fa` `deploy: 添加 Vercel 前端部署配置`

## 已验证

- `pnpm exec vercel whoami`：已登录 Vercel CLI。
- `pnpm exec vercel pull --environment=production --yes`：已拉取 Production env。
- `set -a; source .vercel/.env.production.local; set +a; node scripts/ensure-production-env.mjs`：生产 env 校验通过。
- `pnpm exec vercel deploy --prod`：部署完成，readyState 为 `READY`。
- `pnpm exec vercel inspect web-jtwxdk2xh-arcpredict.vercel.app`：部署状态 Ready。
- `pnpm exec vercel curl / --deployment https://web-jtwxdk2xh-arcpredict.vercel.app`：通过 Vercel 保护层后能读取 ArcPredict 首页内容。
- `pnpm exec vercel project protection`：`ssoProtection` 为 `null`，SSO Deployment Protection 已关闭。
- `curl -fsSI https://web-arcpredict.vercel.app`：匿名访问返回 HTTP 200。
- `curl -fsS https://web-arcpredict.vercel.app | rg "ArcPredict|市场总览|Arc Testnet|0xCFDC"`：匿名访问页面包含 ArcPredict 首页内容。
- `forge test`：130 tests passed，0 failed。
- `cd web && pnpm typecheck`：通过。
- `cd web && pnpm build`：通过，有既有依赖/字体 warning，不阻断。
- `find web/test -maxdepth 1 -name 'check_*.mjs' -exec node {} \;`：通过。
- `cd contracts/script/ops && npm run check`：通过。

## 当前边界

- `web/.env.local` 和 `web/.vercel/` 是本地/凭据状态，已被 git ignore，不应提交。
- Vercel Production env 已包含 `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` 和 `NEXT_PUBLIC_PYTH_HERMES_ENDPOINT`。
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` 是公开变量，已从 `web/.env.local` 读取并写入 Vercel Production；不要在日志或文档里暴露具体值。
- Vercel SSO Deployment Protection 已关闭，生产别名当前可匿名访问。

## 建议下一步

1. 固化手动 QA 证据：MetaMask、WalletConnect、Coinbase Wallet、faucet/USDC、approve/bet、claim、Invalid refund、Safari iOS、Chrome Android、Dark/Light、深链、`/connect`。
2. 若要整理为正式发布，可在 QA 证据齐全后做 allow-empty summary commit，或创建 PR/发布说明。
