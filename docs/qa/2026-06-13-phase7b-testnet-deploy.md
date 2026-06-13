# Phase 7b — 测试网部署 + 首笔下注证据

## 当前准备状态

- 当前文档为 Phase 7b 回填框架，真实部署结果、首笔下注结果与截图均待后续工单补录。
- 工单 4 dry-run 证据：`DeployWorldCupTestnet` 的 build、fmt、dry-run 已通过。
- `final-1` eventId：`0x2b902d6a9c3a763f380d5c1af8475ea4efa1142488ebc730dc7c1c8851b061b1`
- dry-run 参考：`final-1 marketId = 96`，`winner marketId = 97`
- dry-run 参考总 gas 估算：`25627863`
- 说明：以上 dry-run 数据仅供本地 Anvil dummy env 对照，不代表测试网实际广播结果。

## 人工执行命令清单

- 以下命令为工单 5 的准备清单，待人工确认后执行；本文不声称已执行。

```bash
forge script contracts/script/DeployWorldCupTestnet.s.sol --rpc-url $RPC_URL

forge script contracts/script/DeployWorldCupTestnet.s.sol --rpc-url $RPC_URL --broadcast --verify

cast send $USDC_ADDRESS "transfer(address,uint256)" $WALLET_A 1000000000 --rpc-url $RPC_URL --private-key $FUND_KEY

cast send $USDC_ADDRESS "transfer(address,uint256)" $WALLET_B 1000000000 --rpc-url $RPC_URL --private-key $FUND_KEY
```

## 环境

- 测试网：待人工确认后回填
- chainId：待人工确认后回填
- 部署时间：待工单 5 广播后回填
- final-1 startTime：待工单 5 广播后回填

## 部署地址表

| 合约 | 地址 | 区块浏览器 |
|------|------|-----------|
| USDC | 待工单 5 广播后回填 | 待工单 5 广播后回填 |
| AdminEventOracle | 待工单 5 广播后回填 | 待工单 5 广播后回填 |
| EventMarket | 待工单 5 广播后回填 | 待工单 5 广播后回填 |

## Seed tx hash 表

| 操作 | tx hash | 块号 | gas |
|------|---------|------|-----|
| createMarket final-1 | 待工单 5 广播后回填 | 待工单 5 广播后回填 | 待工单 5 广播后回填 |
| createMarket winner | 待工单 5 广播后回填 | 待工单 5 广播后回填 | 待工单 5 广播后回填 |
| createMarket group-1 | 待工单 5 广播后回填 | 待工单 5 广播后回填 | 待工单 5 广播后回填 |
| 其余 group-* / goals-25 共 95 条 | 待工单 5 广播后回填 | 待工单 5 广播后回填 | 待工单 5 广播后回填 |

## 首笔下注证据

- 钱包：待工单 6 前端下注后回填
- final-1 marketId：待工单 6 前端下注后回填
- outcome：待工单 6 前端下注后回填
- 金额：待工单 6 前端下注后回填
- tx hash：待工单 6 前端下注后回填
- 区块浏览器：待工单 6 前端下注后回填

## 前端截屏

- 首页 World Cup Tab：待工单 6 前端下注后回填，路径：`screenshots/worldcup/2026-06-13-phase7b/01-home.png`
- final-1 详情页：待工单 6 前端下注后回填，路径：`screenshots/worldcup/2026-06-13-phase7b/02-detail.png`
- 下注确认：待工单 6 前端下注后回填，路径：`screenshots/worldcup/2026-06-13-phase7b/03-confirm.png`
- 下注成功：待工单 6 前端下注后回填，路径：`screenshots/worldcup/2026-06-13-phase7b/04-success.png`

## 结论

- 待工单 5/6 完成后判定。
- 当前阶段仅确认回填框架、占位规则与 dry-run 参考信息已整理完毕。

## Phase 7c smoke

- 待补录
