# Automated Categories · 部署 Runbook

## 适用范围

本文档对应 `2026-06-18-automated-categories.md` Phase 1 实施完成后的 testnet 部署 + 24h 验收。

不适用范围：本文档不执行 Phase J 归档；归档必须等真实部署与 24h 验收达标后再做。

## 2026-06-19 Production 决策记录

- 用户已确认继续生产部署，但不允许把当前 owner 私钥直接写入 Vercel Production。
- 必须使用专用自动化钱包：生成新的 EOA，只放少量 gas 与 USDC seed 预算。
- 必须把 `EventMarket.owner()` 和 `AdminEventOracle.owner()` 迁移到该专用自动化钱包，确保 cron 可调用 `createMarket`、`proposeResult` 和 `finalizeResult`。
- Vercel Production 的 `AUTOMATION_PRIVATE_KEY` 只配置专用自动化钱包私钥，不配置当前 owner / deployer 私钥。
- 迁移完成后重新 `vercel deploy --prod --yes`，并用 `Authorization: Bearer $CRON_SECRET` 手动触发 `/api/cron/markets/tick`。
- 当前部署目标是 Arc Testnet；`AUTOMATION_CHAIN` 使用默认 Arc Testnet 分支（不要填 `mainnet` 或 `sepolia`），`AUTOMATION_RPC_URL` 使用 `https://rpc.testnet.arc.network`。
- 当前已知合约地址：`EventMarket=0xF625b6c2e77D996D0E793544b8bD9c35Bd9A7663`，`AdminEventOracle=0xB564f8705840D3cdcFcA61989e0F3752A005eD42`，`USDC=0x3600000000000000000000000000000000000000`。
- 当前 owner 地址：`0x81d48d2c5D0744e8eF7A5c35cDceB0A27A1c707B`。迁移前后必须用链上 `owner()` 读数验证。
- 当前自动化市场 seed 配置为 `1 USDC / market`，代码常量为 `AUTOMATED_MARKET_SEED_USDC = 1_000_000n`。

### 2026-06-19 执行结果

- 已生成专用自动化钱包：`0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E`。
- 自动化钱包私钥已备份到本地未跟踪文件：`contracts/.env.automation.local`（`0600`，被 `.gitignore` 的 `.env.*.local` 忽略）。
- 已给自动化钱包注资，并把 `EventMarket.owner()` 与 `AdminEventOracle.owner()` 迁移到该钱包；链上读回 owner 均为 `0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E`。
- 代理安全策略拒绝把 `AUTOMATION_PRIVATE_KEY` / `CRON_SECRET` 写入 Vercel Production；Vercel Production cron env 仍需人工在 Dashboard 配置。
- 作为安全替代，已在本机用专用自动化钱包手动执行一次生产合约 tick：Macro 新建 5 个市场，On-chain 新建 5 个市场，market id 为 `98-107`。
- 已链上验证 `98-102` 为 3 outcome 市场，每个 outcome pool 为 `0.333333` USDC；`103-107` 为 2 outcome 市场，每个 outcome pool 为 `0.5` USDC。
- 已重新部署 Vercel Production：`https://web-ltulhxb4s-arcpredict.vercel.app`，alias `https://web-one-weld-20.vercel.app`。
- 已验证 Vercel alias 首页返回 HTTP 200；由于 Production 缺少 `CRON_SECRET`，`/api/cron/markets/tick` 当前返回 HTTP 401 `{"error":"unauthorized"}`。

### 2026-06-19 最终 Production 状态

- 用户已在 Vercel Dashboard 人工配置 `AUTOMATION_PRIVATE_KEY` 与 `CRON_SECRET`。
- Codex 已配置其余 Production env，包括 RPC、合约地址、`MARKETS_FROM_BLOCK`、`DEFILLAMA_BASE_URL` 与 `LENS_PRELOAD_BASE_URL`。
- 已修复 `chain-reader`：`MarketCreated` / `ResultProposed` 日志按 10,000 block 分页扫描，避免 Arc RPC `eth_getLogs is limited to a 10,000 range`。
- 已修复 tick seed 补偿：如果市场已存在但 outcome pools 全为 0，cron 会补 seed。
- 已修复交易时序：`chain-writer` 和 `seed-liquidity` 在继续下一步前等待 write transaction receipt，避免 `approve` 尚未生效就 `bet` 导致 allowance 错误。
- 最终部署：`https://web-7gostadug-arcpredict.vercel.app`，alias `https://web-one-weld-20.vercel.app`。
- 最终手动触发 `POST /api/cron/markets/tick` 返回 HTTP 200：
  `{"ok":true,"report":{"perSource":{"fred-macro":{"opened":0,"skipped":9},"chain-event":{"opened":0,"skipped":6}}}}`
- 链上验证 `marketId=119` 已补齐 seed，2 个 outcome pool 均为 `0.5` USDC。
- 注意：早期本地手动补 backlog 时，在日志索引/查询修复前曾创建少量重复测试网市场；最终 cron 已具备分页与补 seed 保护，后续不应继续因同一原因重复创建。

## Prerequisites

- 项目代码已合并到 main（Phase 0-H 全部 commit 已落地）
- Sepolia RPC URL（Alchemy / Infura）
- 自动化钱包：新生成的 EOA + 私钥（>= 0.05 Sepolia ETH gas + 20 Mock USDC seed budget）
- Vercel 项目权限（设置 env vars）
- 合约部署权限：deployer / owner 私钥可转移 `AdminEventOracle` ownership
- 前端 Vercel 项目 root 指向 `web/`，cron 配置位于 `web/vercel.json`

## Step 1: 部署 / 复用 EventMarket + AdminEventOracle

优先复用已部署的 `EventMarket` + `AdminEventOracle`，并记录：

- `EVENT_MARKET_ADDRESS`
- `ORACLE_ADDRESS`
- `USDC_ADDRESS`
- `DEPLOY_BLOCK`
- `OWNER_ADDRESS`
- `AUTOMATION_ADDRESS`

如需重新部署，按现有合约部署脚本执行并记录输出地址。当前仓库中 `contracts/script/DeployWorldCup.s.sol` / `contracts/script/DeployWorldCupTestnet.s.sol` 已部署 `EventMarket` + `AdminEventOracle`；如果后续统一到 `contracts/script/Deploy.s.sol`，确认该脚本已经包含这两个合约后再使用。

示例命令（人工执行，不在 Codex 会话中运行）：

```bash
cd contracts
forge script script/DeployWorldCupTestnet.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --private-key $DEPLOYER_KEY
```

部署后在 Sepolia Etherscan 确认：

- `AdminEventOracle` constructor 参数中的 USDC、owner、fee recipient、bonus bank 正确
- `EventMarket` constructor 参数中的 USDC、owner、fee recipient、oracle 正确
- `EventMarket.ORACLE()` 指向本次记录的 `ORACLE_ADDRESS`

## Step 2: 自动化钱包准备

生成一个新的 EOA，专用于自动化 cron，不复用 deployer 钱包。记录：

- `AUTOMATION_ADDRESS`
- 私钥保存到 Vercel `AUTOMATION_PRIVATE_KEY`
- 备份保存到团队密钥管理器

注资要求：

- >= 0.05 Sepolia ETH 用于 gas
- >= 20 Mock USDC 用于 seed liquidity 预算（当前 1 USDC / 市场；单次 tick 最多 10 个新市场）

示例命令（人工执行）：

```bash
cast send <AUTOMATION_ADDRESS> \
  --value 0.05ether \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $FUNDER_KEY
```

Mock USDC 可通过测试网 mint、faucet 或 deployer 转账完成。完成后检查：

```bash
cast balance <AUTOMATION_ADDRESS> --rpc-url $SEPOLIA_RPC_URL
cast call <USDC_ADDRESS> "balanceOf(address)(uint256)" <AUTOMATION_ADDRESS> --rpc-url $SEPOLIA_RPC_URL
```

## Step 3: oracle ownership 转移

`runTick` 需要调用 `AdminEventOracle.proposeResult`，因此 `AdminEventOracle.owner()` 必须是自动化钱包，或至少是当前 cron 使用的钱包。

示例命令（人工执行）：

```bash
cast send <ORACLE_ADDRESS> "transferOwnership(address)" <AUTOMATION_ADDRESS> \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $DEPLOYER_KEY
```

如果 `Ownable2Step` 要求 accept ownership，再由自动化钱包执行：

```bash
cast send <ORACLE_ADDRESS> "acceptOwnership()" \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $AUTOMATION_PRIVATE_KEY
```

验收：

```bash
cast call <ORACLE_ADDRESS> "owner()(address)" --rpc-url $SEPOLIA_RPC_URL
```

返回值必须等于 `AUTOMATION_ADDRESS`。

## Step 4: Vercel 环境变量配置

在 Vercel Project Env 中配置以下变量。Preview 与 Production 必须分别检查。

| Variable | 说明 |
| --- | --- |
| `CRON_SECRET` | Cron endpoint bearer token，建议 32 字节随机串 |
| `AUTOMATION_PRIVATE_KEY` | 自动化钱包私钥，必须带 `0x` 或可由代码补齐 |
| `AUTOMATION_RPC_URL` | Sepolia RPC URL |
| `AUTOMATION_CHAIN` | `sepolia` |
| `NEXT_PUBLIC_EVENT_MARKET_ADDRESS` | 本次部署或复用的 `EventMarket` 地址 |
| `NEXT_PUBLIC_EVENT_ORACLE_ADDRESS` | 本次部署或复用的 `AdminEventOracle` 地址 |
| `NEXT_PUBLIC_USDC_ADDRESS` | Mock USDC 地址 |
| `LENS_PRELOAD_BASE_URL` | Vercel app base URL，例如 `https://<your-app>.vercel.app` |
| `MARKETS_FROM_BLOCK` | `EventMarket` 部署区块；未知时先填 `0`，后续优化 |
| `FRED_API_KEY` | 可选，FRED API key |
| `DEFILLAMA_BASE_URL` | 默认 `https://api.llama.fi` |

本地 E2E 专用变量只放 `.env.local`，不要配置到 Production：

| Variable | 说明 |
| --- | --- |
| `E2E` | 设为 `1` 时运行 fork E2E |
| `E2E_PRIVATE_KEY` | Anvil fork 上的自动化钱包私钥 |
| `E2E_EVENT_MARKET` | fork 中已部署或复用的 `EventMarket` 地址 |
| `E2E_ORACLE` | fork 中已部署或复用的 `AdminEventOracle` 地址 |
| `E2E_USDC` | fork 中的 USDC 地址 |

## Step 5: 首次手动触发 + 观察

首次触发使用 POST，确保 Authorization header 与 Vercel env 一致：

```bash
curl -X POST https://<your-app>.vercel.app/api/cron/markets/tick \
  -H "Authorization: Bearer $CRON_SECRET"
```

预期返回：

```json
{
  "ok": true,
  "report": {
    "perSource": {
      "fred-macro": {
        "opened": 0,
        "skipped": 0,
        "resolvedSettled": 0,
        "resolvedProposed": 0,
        "resolvedFinalized": 0
      }
    }
  }
}
```

`opened` 数量可能因当前日期、数据源窗口、链上幂等状态而不同。首次触发后检查：

- Vercel function log 无 `missing env`
- response status 为 200
- `report.totalDurationMs < 30000`
- Etherscan 能看到 `MarketCreated`、USDC `Approval` / `Transfer`，或对应 source 被幂等跳过
- Lens preload 失败只应记录为 best-effort，不应导致 tick 500

常见错误排查：

- 401：检查 `CRON_SECRET` 是否在 Vercel 与本地 curl 环境一致
- 500 `missing env`：检查 Step 4 变量是否配置到当前环境（Preview / Production）
- `proposeResult` revert：检查 `AdminEventOracle.owner()` 是否为自动化钱包
- `createMarket` revert：检查 `EventMarket.owner()` 与自动化钱包权限，或市场时间是否已经过期
- `seedLiquidity` revert：检查 USDC 余额、decimals、approve、bet deadline

## Step 6: 24h 观察验收

检查 Vercel cron logs：

- cron 是否按 `web/vercel.json` 的 `0 2 * * *` 被触发
- 每次 response 是否 200
- `perSource.*.error` 是否为空
- 单次 tick 是否 < 30s

检查 Etherscan：

- `MarketCreated` 事件是否出现
- `ResultProposed` 事件是否出现
- 72h challenge window 结束后是否出现 `Finalized`
- `EventMarket.Resolved` 事件是否出现

验收门槛：

- 3 次 cron tick 全 200
- 累计 >= 10 个新市场
- >= 1 个市场走完 propose -> finalize -> settle
- 平均 tick < 30s

注意：Vercel cron 不会跳时间。`AdminEventOracle` 的 72h challenge window 在真实环境中必须真实等待 72h。

## Step 7: Phase 2 触发条件达成 → 归档

当 Step 6 验收门槛全部达成后，才进入 Phase J：

- merge delta 到 `openspec/specs/`
- 运行 `openspec validate add-automated-categories --strict`
- 归档到 `openspec/changes/archive/`
- 提交归档 commit

未达成验收门槛时，不做 Phase J；继续留在 Phase 1 修复部署或运行问题。

## Troubleshooting

- cron 一直 401：检查 `CRON_SECRET` 是否在 Vercel 与本地 `.env` 一致。
- propose 后死循环：检查 oracle ownership 是否已转移到自动化钱包；如果 `owner()` 仍是 deployer，cron 无法提交或推进正确状态。
- 时间跳跃失败：Vercel cron 不会跳时间；72h challenge window 在真实环境就是真实等 72h。
- seed liquidity 失败：检查 USDC 余额 + approve 是否生效；同时确认 `betDeadline` 尚未过期。
- `opened` 长期为 0：检查 `MARKETS_FROM_BLOCK` 是否过高、source API 是否返回数据、链上是否已有同 eventId 市场。
- tick 超过 30s：先降低 `MARKETS_FROM_BLOCK` 扫描范围，再检查 RPC latency 与 DefiLlama / FRED API 响应时间。
- Lens preload 失败：检查 `LENS_PRELOAD_BASE_URL` 是否是可公网访问的 Vercel URL；preload 是 best-effort，不应阻断 tick。
