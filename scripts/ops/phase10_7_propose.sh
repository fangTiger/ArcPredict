#!/usr/bin/env bash
set -euo pipefail

export PATH="/Users/captain/.foundry/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)
cd "$REPO_ROOT"

mkdir -p "$REPO_ROOT/log"
LOG_FILE="$REPO_ROOT/log/phase10_7.log"
exec >>"$LOG_FILE" 2>&1

log() {
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

iso_utc() {
  date -u -r "$1" +%Y-%m-%dT%H:%M:%SZ
}

iso_cst() {
  TZ=Asia/Shanghai date -r "$1" +%Y-%m-%dT%H:%M:%S%z
}

json_field() {
  python3 -c 'import json,sys; print(json.load(sys.stdin)[sys.argv[1]])' "$1"
}

cleanup_launch_agent_async() {
  local label="$1"
  local plist="$2"
  local user_id
  user_id=$(id -u)
  /usr/bin/nohup /bin/bash -c "sleep 2; /bin/launchctl bootout 'gui/$user_id/$label' >>'$LOG_FILE' 2>&1 || /bin/launchctl unload -w '$plist' >>'$LOG_FILE' 2>&1 || true; /bin/rm -f '$plist'; /bin/echo \"[\$(/bin/date -u +%Y-%m-%dT%H:%M:%SZ)] cleanup done $label\" >>'$LOG_FILE'" >/dev/null 2>&1 &
}

load_launch_agent() {
  local label="$1"
  local plist="$2"
  local user_id
  user_id=$(id -u)

  if launchctl print "gui/$user_id/$label" >/dev/null 2>&1; then
    log "Existing LaunchAgent loaded; booting out $label before reload"
    launchctl bootout "gui/$user_id/$label" || fail "launchctl bootout failed for $label"
  fi

  if launchctl bootstrap "gui/$user_id" "$plist"; then
    log "Loaded LaunchAgent via bootstrap: $label"
  else
    log "launchctl bootstrap failed; trying load -w fallback for $label"
    launchctl load -w "$plist" || fail "launchctl load -w failed for $label"
  fi
}

log "phase10_7_propose start"

command -v cast >/dev/null || fail "cast not found in PATH"
command -v python3 >/dev/null || fail "python3 not found in PATH"
command -v plutil >/dev/null || fail "plutil not found in PATH"

ENV_FILE="$REPO_ROOT/contracts/.env.automation.local"
test -r "$ENV_FILE" || fail "missing env file: $ENV_FILE"
set +u
set -a
source "$ENV_FILE"
set +a
set -u

: "${AUTOMATION_PRIVATE_KEY:?missing AUTOMATION_PRIVATE_KEY}"
: "${AUTOMATION_RPC_URL:?missing AUTOMATION_RPC_URL}"

OWNER_PRIVATE_KEY="$AUTOMATION_PRIVATE_KEY"
EXPECTED_OWNER="0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E"
ORACLE="0xA4b27Ee975C31Ad60fF0Bda8ACB680Cb183BC004"
EVENT_MARKET="0x2E9F15905739632ed7b156b4c7824d368a97bB15"
FINAL_EVENT_ID="0x2b902d6a9c3a763f380d5c1af8475ea4efa1142488ebc730dc7c1c8851b061b1"
MARKET_ID=96
RESOLVE_AFTER=1782243237
DISPUTE_WINDOW_SECONDS=$((72 * 3600))
FINALIZE_DELAY_SECONDS=$((DISPUTE_WINDOW_SECONDS + 5 * 60))
QA_DOC="$REPO_ROOT/docs/qa/2026-06-13-phase7b-testnet-deploy.md"
FINALIZE_LABEL="com.arcpredict.phase10_7.finalize"
FINALIZE_PLIST="$HOME/Library/LaunchAgents/$FINALIZE_LABEL.plist"
FINALIZE_SCRIPT="$REPO_ROOT/scripts/ops/phase10_7_finalize_claim.sh"
PROPOSE_LABEL="com.arcpredict.phase10_7.propose"
PROPOSE_PLIST="$HOME/Library/LaunchAgents/$PROPOSE_LABEL.plist"

OWNER_ADDR=$(cast wallet address "$OWNER_PRIVATE_KEY")
log "owner address: $OWNER_ADDR"
if [[ "$OWNER_ADDR" != "$EXPECTED_OWNER" ]]; then
  fail "owner address mismatch"
fi

latest_ts=$(cast block latest --rpc-url "$AUTOMATION_RPC_URL" --field timestamp | awk 'NR==1{print $1}')
log "latest timestamp: $latest_ts ($(iso_utc "$latest_ts"))"
if (( latest_ts < RESOLVE_AFTER )); then
  fail "resolveAfter not reached: latest=$latest_ts resolveAfter=$RESOLVE_AFTER"
fi

market_event_id=$(cast call "$EVENT_MARKET" "markets(uint256)(bytes32,uint8,uint64,uint64,uint128[],uint128,uint128,uint16,address,uint8,uint64,string)" "$MARKET_ID" --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
if [[ "$market_event_id" != "$FINAL_EVENT_ID" ]]; then
  fail "market 96 eventId mismatch: $market_event_id"
fi

status_before=$(cast call "$ORACLE" "getEventStatus(bytes32)(uint8)" "$FINAL_EVENT_ID" --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
log "oracle status before propose: $status_before"
if [[ "$status_before" != "0" ]]; then
  fail "oracle status is not Pending(0)"
fi

send_json=$(cast send "$ORACLE" "proposeResult(bytes32,uint8)" "$FINAL_EVENT_ID" 0 --rpc-url "$AUTOMATION_RPC_URL" --private-key "$OWNER_PRIVATE_KEY" --json)
propose_tx=$(printf '%s' "$send_json" | json_field transactionHash)
log "propose tx hash: $propose_tx"

receipt_status=$(cast receipt "$propose_tx" status --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
if [[ "$receipt_status" != "1" ]]; then
  fail "propose receipt status is not success: $receipt_status"
fi

propose_block=$(cast receipt "$propose_tx" blockNumber --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
propose_ts=$(cast block "$propose_block" --rpc-url "$AUTOMATION_RPC_URL" --field timestamp | awk 'NR==1{print $1}')
finalize_unix=$((propose_ts + DISPUTE_WINDOW_SECONDS))
finalize_run_unix=$((propose_ts + FINALIZE_DELAY_SECONDS))

status_after=$(cast call "$ORACLE" "getEventStatus(bytes32)(uint8)" "$FINAL_EVENT_ID" --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
if [[ "$status_after" != "1" ]]; then
  fail "oracle status after propose is not Proposed(1): $status_after"
fi

propose_iso=$(iso_utc "$propose_ts")
finalize_iso=$(iso_utc "$finalize_unix")
finalize_run_iso_utc=$(iso_utc "$finalize_run_unix")
finalize_run_iso_cst=$(iso_cst "$finalize_run_unix")
log "propose block: $propose_block timestamp=$propose_ts ($propose_iso)"
log "finalize earliest: $finalize_iso; scheduled run: $finalize_run_iso_utc / $finalize_run_iso_cst"

cat >>"$QA_DOC" <<EOF

## Phase 10.7 Step 1: propose

- propose tx hash: \`$propose_tx\`
- propose block number: \`$propose_block\`
- propose block timestamp (unix): \`$propose_ts\`
- propose block timestamp (UTC ISO): \`$propose_iso\`
- oracle status before: Pending (\`$status_before\`)
- oracle status after: Proposed (\`$status_after\`)
- proposed outcome: 0 (ARG / home)
- proposer wallet: \`$OWNER_ADDR\`
- finalize earliest at (UTC ISO): \`$finalize_iso\` (= proposeBlockTimestamp + 72h)
- scheduled finalize LaunchAgent run at: \`$finalize_run_iso_utc\` UTC / \`$finalize_run_iso_cst\` CST
- next steps: 调 \`finalizeResult(...)\`，再调 \`EventMarket.resolve(96)\`，然后 \`claim(96)\` 领取那笔 0.5 USDC。
EOF

year=$(TZ=Asia/Shanghai date -r "$finalize_run_unix" +%Y)
month=$(TZ=Asia/Shanghai date -r "$finalize_run_unix" +%-m)
day=$(TZ=Asia/Shanghai date -r "$finalize_run_unix" +%-d)
hour=$(TZ=Asia/Shanghai date -r "$finalize_run_unix" +%-H)
minute=$(TZ=Asia/Shanghai date -r "$finalize_run_unix" +%-M)

mkdir -p "$HOME/Library/LaunchAgents"
cat >"$FINALIZE_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$FINALIZE_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>$FINALIZE_SCRIPT</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Year</key><integer>$year</integer>
    <key>Month</key><integer>$month</integer>
    <key>Day</key><integer>$day</integer>
    <key>Hour</key><integer>$hour</integer>
    <key>Minute</key><integer>$minute</integer>
  </dict>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$REPO_ROOT/log/phase10_7.launchd.log</string>
  <key>StandardErrorPath</key><string>$REPO_ROOT/log/phase10_7.launchd.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/Users/captain/.foundry/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
EOF
chmod 0644 "$FINALIZE_PLIST"
plutil -lint "$FINALIZE_PLIST"
load_launch_agent "$FINALIZE_LABEL" "$FINALIZE_PLIST"

log "phase10_7_propose completed"
cleanup_launch_agent_async "$PROPOSE_LABEL" "$PROPOSE_PLIST"
