# Ops 运营脚本

本目录用于 ArcPredict 的运营查询与自动结算脚本。

## 目录说明

- `ListMarkets.s.sol`：列出全部市场基础信息。
- `ListResolvable.s.sol`：列出当前已到结算时间且仍未结算的市场。
- `ResolveDueMarkets.ts`：扫描到期未结算市场，向 Hermes 拉取历史 update，并调用合约 `resolve`。

## 安装依赖

```bash
cd /path/to/ArcPredict/contracts/script/ops
npm install
```

## `.env` 必需变量

`ResolveDueMarkets.ts` 会显式读取 `contracts/.env`，不是当前目录单独放 `.env`。

必需：

- `RPC_URL`：Arc Testnet RPC。
- `PREDICTION_MARKET`：已部署的 `PredictionMarket` 合约地址。
- `OWNER_PRIVATE_KEY`：owner 私钥，支持带或不带 `0x` 前缀。
- `PYTH_ADDRESS`：Arc Testnet 的 Pyth 合约地址。

可选：

- `PYTH_HERMES_ENDPOINT`：默认 `https://hermes.pyth.network`。

## 手动查询

```bash
cd /path/to/ArcPredict/contracts
forge script script/ops/ListMarkets.s.sol --rpc-url "$RPC_URL"
forge script script/ops/ListResolvable.s.sol --rpc-url "$RPC_URL"
```

## 手动执行自动结算

```bash
cd /path/to/ArcPredict/contracts/script/ops
npm run resolve
```

## 每 30 秒自动扫描

传统 cron 没有秒粒度，推荐每分钟启动一次 shell，再在同一轮里执行两次：

```cron
* * * * * cd /path/to/ArcPredict/contracts/script/ops && /usr/bin/env bash -lc 'npm run resolve >> /var/log/arc-predict-resolve.log 2>&1; sleep 30; npm run resolve >> /var/log/arc-predict-resolve.log 2>&1'
```

说明：

- 这样可以稳定实现“每 30 秒扫描一次”。
- 日志会持续追加到 `/var/log/arc-predict-resolve.log`。
- 建议先手动执行一次 `npm run resolve`，确认 `.env`、RPC 和私钥都正确。

如果你使用 `systemd timer` 或 `launchd`，也应保持同样的目标频率：每 30 秒完成一次全量扫描。

## 故障排查

### 1. 提示实时窗口已过

这不是立即判定 `Invalid` 的信号。脚本会记录“实时窗口已过，尝试拉历史 update”，然后继续向 Hermes 请求 `resolveAfter` 时刻的历史 update 数据。

### 2. 为什么过了 5 分钟还继续尝试

合约实时窗口是 `[resolveAfter, resolveAfter + 5 分钟]`，但运营脚本的职责不是因为超出 5 分钟就放弃，而是继续尝试用 Hermes 历史 update 完成结算。窗口过期只代表不能依赖“刚好在实时窗口内”的路径，不代表市场应该立刻作废。

### 3. 什么时候才考虑 `forceInvalid`

只有在 `resolveAfter + 7 天` 之后，市场仍然无法通过正常 `resolve` 完成结算，才考虑调用 `forceInvalid` 作为兜底，避免资金长期锁住。

### 4. 单个市场失败会不会卡住后续市场

不会。脚本会对每个市场单独捕获错误，记录中文错误日志后继续扫描后续市场。
