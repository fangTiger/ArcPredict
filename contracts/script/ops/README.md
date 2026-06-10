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

无论你使用 `cron`、`systemd timer` 还是 `launchd`，目标频率都应保持一致：每 30 秒扫描一次，也就是每 30 秒完成一次全量扫描。

### `systemd timer` 示例（Linux）

`systemd timer` 没有传统 cron 那种通用的“秒位”表达式。比较稳妥的做法是：让 timer 每分钟触发一次 `oneshot` service，而 service 在同一轮里执行两次 `npm run resolve`，中间 `sleep 30`。

`/etc/systemd/system/arc-predict-resolve.service`

```ini
[Unit]
Description=ArcPredict ops resolve due markets

[Service]
Type=oneshot
WorkingDirectory=/path/to/ArcPredict/contracts/script/ops
ExecStart=/usr/bin/env bash -lc 'npm run resolve >> /var/log/arc-predict-resolve.log 2>&1; sleep 30; npm run resolve >> /var/log/arc-predict-resolve.log 2>&1'
```

`/etc/systemd/system/arc-predict-resolve.timer`

```ini
[Unit]
Description=Run ArcPredict resolver every minute

[Timer]
OnCalendar=*-*-* *:*:00
AccuracySec=1s
Persistent=true

[Install]
WantedBy=timers.target
```

启用方式：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now arc-predict-resolve.timer
systemctl list-timers arc-predict-resolve.timer
```

说明：

- 上面的组合能稳定达到“每 30 秒扫描一次”。
- 如果你更想要单次任务、由 timer 自己重复触发，也可以改成 `OnUnitActiveSec=30s`；但那种方式的 30 秒间隔是“上一次 service 结束后再过 30 秒”，会把脚本执行耗时计算进去，长期运行时节奏会有漂移。

### `launchd` 示例（macOS）

macOS 下可以用 `launchd` 的 `StartInterval=30` 直接做到每 30 秒扫描一次。下面示例把标准输出和错误输出都写入日志文件，便于排障。

`~/Library/LaunchAgents/com.arcpredict.ops.resolve.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.arcpredict.ops.resolve</string>

    <key>WorkingDirectory</key>
    <string>/path/to/ArcPredict/contracts/script/ops</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>npm run resolve</string>
    </array>

    <key>StartInterval</key>
    <integer>30</integer>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/tmp/arc-predict-resolve.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/arc-predict-resolve.err.log</string>
  </dict>
</plist>
```

加载方式：

```bash
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.arcpredict.ops.resolve.plist
launchctl kickstart -k "gui/$(id -u)/com.arcpredict.ops.resolve"
launchctl print "gui/$(id -u)/com.arcpredict.ops.resolve"
```

说明：

- `WorkingDirectory` 必须指向 `contracts/script/ops`，否则 `npm run resolve` 找不到本目录的 `package.json`。
- `ProgramArguments` 通过 `/bin/bash -lc` 执行 `npm run resolve`，和手动命令保持一致。
- `StartInterval` 设为 `30` 后，`launchd` 会按每 30 秒扫描一次的目标频率触发脚本。
- `StandardOutPath` / `StandardErrorPath` 建议分别落到固定文件，便于查看最近一次运行结果。

## 故障排查

### 1. 提示实时窗口已过

这不是立即判定 `Invalid` 的信号。脚本会记录“实时窗口已过，尝试拉历史 update”，然后继续向 Hermes 请求 `resolveAfter` 时刻的历史 update 数据。

### 2. 为什么过了 5 分钟还继续尝试

合约实时窗口是 `[resolveAfter, resolveAfter + 5 分钟]`，但运营脚本的职责不是因为超出 5 分钟就放弃，而是继续尝试用 Hermes 历史 update 完成结算。窗口过期仍尝试 Hermes 历史 update。窗口过期只代表不能依赖“刚好在实时窗口内”的路径，不代表市场应该立刻作废。

### 3. 什么时候才考虑 `forceInvalid`

只有在 `resolveAfter + 7 天` 之后，市场仍然无法通过正常 `resolve` 完成结算，才考虑调用 `forceInvalid` 作为兜底，避免资金长期锁住。

### 4. 单个市场失败会不会卡住后续市场

不会。脚本会对每个市场单独捕获错误，记录中文错误日志后继续扫描后续市场。
