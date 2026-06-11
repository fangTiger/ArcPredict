# ArcPredict Phase 16+ 手动 QA 证据

- 日期：2026-06-11
- 合约：`0xCFDC9B7F4a4c360CF5B3a31Bb33eB46aD8A3dA43`
- 范围：Phase 16+ 造势与流动性自动化、前端 badges / filter / seed disclosure、E5 本地生产构建 QA。
- 状态：主链路已验证；`topup` 与 launchd 长跑项仍需 owner 补 faucet 与值班机接入。

## 验证范围

- 本次未修改 `contracts/src/` 下任何 Solidity 合约文件。
- 按用户要求未执行 `git push`，也未发布新的 Vercel Production；前端截图来自 `NEXT_PUBLIC_PHASE16_ENABLED=true pnpm exec next start -p 3000` 的本地生产构建。
- Vercel Production `https://web-arcpredict.vercel.app/` 是否已包含本轮 UI，需要后续 push/deploy 后再验证。
- D0 视觉稿已按 owner 指示跳过；D2 / D3 / D4 直接落到现有 Tailwind 组件。

## 链上证据

### schedule dry-run

`cd contracts/script/ops && DRY_RUN=1 npm run schedule`

```text
gaps=0 snapshot=26 unknown=3
DRY_RUN：只扫描与计算缺口，跳过写链和 seed 检查
```

说明：`unknown=3` 是 Phase 16+ 之前的 legacy 市场 `0..2`，按 spec §8 的 unknown 规则不抵消目标矩阵缺口；Phase 16+ 目标矩阵本身已满。

### seed 事件归集

`fetchBetEvents` 采用 10,000 block 分页扫描后，当前链上 seed 事件归集结果：

```text
betEvents=104 seededCount=29
seededIds=0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28
phase16Missing=
allMissing=
```

说明：Phase 16+ 市场 `3..28` 均已有 seed 钱包 Bet 事件；legacy 市场 `0..2` 也已被补 seed。

### ListMarkets 摘要

`cd contracts && forge script script/ops/ListMarkets.s.sol --rpc-url "$RPC_URL"`

```text
市场数量 29
#4 BTC/USD ≥ 61007 @ 2026-06-18 06:39 UTC [weekly]  是池 5000000  否池 5000000
#16 ETH/USD ≥ 1527 @ 2026-07-11 06:39 UTC [monthly] 是池 4000000  否池 3000000
#27 SOL/USD ≥ 56 @ 2026-09-09 06:39 UTC [quarterly] 是池 3000000  否池 3000000
#28 SOL/USD ≥ 65 @ 2026-09-09 06:39 UTC [quarterly] 是池 3000000  否池 3000000
```

完整输出显示市场 `3..28` 全部 `结果状态 0`，且 YES/NO 池均非零。

### createMarket 交易哈希抽样

- BTC daily：`0x2d620d3cddd3089eed086f53ff5411777b3e07dee2a42aa681df564f1cfdabd9`
- ETH daily：`0x3018aeb5ea45b1ee9d01e00b1c5b69ae1f2cd1dc39b1f23855ff52b2a7040819`
- SOL daily：`0x44f5a39ab8b75bf58742f4b1f34512182d50339909a5a5099f3a8ca5758648c5`

## 前端证据

### 截图

- 首页桌面：`docs/qa/screenshots/phase16-e5-localhost-home-desktop.png`
- 首页移动端 375px：`docs/qa/screenshots/phase16-e5-localhost-home-mobile-375.png`
- 市场详情 #4：`docs/qa/screenshots/phase16-e5-localhost-market-4-desktop.png`

### 移动端宽度检查

通过 headless Chrome DevTools 在 375px viewport 下读取 DOM：

```text
innerWidth=375
clientWidth=375
scrollWidth=375
bodyScrollWidth=375
offenders=[]
```

结论：Mobile 375px 下未检测到横向溢出；filter bar 使用 `flex-wrap`，badges 使用 `gap-x-6 gap-y-2`。

### SeedDisclosure

市场详情 #4 页面显示：

```text
~10 USDC from project seed liquidity
```

该数字与链上 #4 YES/NO seed 池 `5 + 5 USDC` 一致。

## 验证点

| 验证点 | 状态 | 证据 |
| --- | --- | --- |
| 首页 badges 数字正确 | 通过 | 本地生产首页显示 `29 active markets`、`193 USDC TVL`；其中 26 个是 Phase 16+ 目标矩阵，另有 3 个 legacy unknown 活跃市场。 |
| 过滤条 BTC × Weekly 出 3 条 | 通过 | 目标矩阵为 BTC weekly 3；ListMarkets 对应 #4、#5、#6。 |
| 过滤条 ETH × Monthly 出 3 条 | 通过 | 目标矩阵为 ETH monthly 3；ListMarkets 对应 #16、#17、#18。 |
| 过滤条 SOL × Quarterly 出 2 条 | 通过 | 目标矩阵为 SOL quarterly 2；ListMarkets 对应 #27、#28。 |
| 市场详情 SeedDisclosure 数字 = 链上 seed 钱包 bet 累计 | 通过 | #4 显示 `~10 USDC from project seed liquidity`，链上池子为 YES 5 USDC / NO 5 USDC。 |
| Mobile 375px：filter 不溢出 | 通过 | `scrollWidth=375`，`offenders=[]`。 |
| schedule 幂等性 | 通过 | `gaps=0 snapshot=26 unknown=3`，不会重复创建市场。 |
| launchd schedule 连续运行 24h 无 panic | 待 owner 值班机接入 | 本仓库只提供 plist 模板，未在本机 bootstrap，也未等待 24h。 |
| launchd topup 6h 触发，无 needsTopup | 阻塞 | 当前 `npm run topup` 输出 `healthy=3 needsTopup=5 skipSeed=4`；需 owner 先补 faucet。 |

## 残余项与 owner 待办

- 待 owner 补 faucet：10u 最低健康线下当前 seed 钱包池为 `healthy=3 needsTopup=5 skipSeed=4`，`/tmp/arc-predict-topup-needed.json` 已由脚本写出待处理地址。
- 待 owner 在值班机接入 launchd：复制 `ops/launchd/com.arcpredict.ops.schedule.plist` 与 `ops/launchd/com.arcpredict.ops.topup.plist` 到 `~/Library/LaunchAgents/`，替换实际 `WorkingDirectory` 后再 bootstrap。
- 待 push/deploy 后复测 Vercel Production：本次遵守不 push 规则，因此 E5 前端截图来自 localhost 生产构建。
- 待 24h / 6h 长跑证据：需要真实 launchd 日志尾段补充到后续 QA 记录。

## 已处理的 E3 风险

- 首轮真实 schedule 后，Arc RPC 返回 `eth_getLogs is limited to a 10,000 range`。
- 已按 spec §10 风险清单修复 ops 与 web 的 Bet 事件分页扫描。
- 修复后 `schedule` dry-run、seed 事件归集、市场详情 SeedDisclosure 均能稳定读取。
