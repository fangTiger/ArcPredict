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

json_field() {
  python3 -c 'import json,sys; print(json.load(sys.stdin)[sys.argv[1]])' "$1"
}

format_usdc() {
  python3 - "$1" <<'PY'
import sys
raw = int(sys.argv[1])
print(f"{raw / 1_000_000:.6f}")
PY
}

cleanup_launch_agents_async() {
  local user_id
  user_id=$(id -u)
  local finalize_label="com.arcpredict.phase10_7.finalize"
  local propose_label="com.arcpredict.phase10_7.propose"
  local finalize_plist="$HOME/Library/LaunchAgents/$finalize_label.plist"
  local propose_plist="$HOME/Library/LaunchAgents/$propose_label.plist"
  /usr/bin/nohup /bin/bash -c "sleep 2; /bin/launchctl bootout 'gui/$user_id/$finalize_label' >>'$LOG_FILE' 2>&1 || /bin/launchctl unload -w '$finalize_plist' >>'$LOG_FILE' 2>&1 || true; /bin/launchctl bootout 'gui/$user_id/$propose_label' >>'$LOG_FILE' 2>&1 || /bin/launchctl unload -w '$propose_plist' >>'$LOG_FILE' 2>&1 || true; /bin/rm -f '$finalize_plist' '$propose_plist'; /bin/echo \"[\$(/bin/date -u +%Y-%m-%dT%H:%M:%SZ)] cleanup done phase10_7 LaunchAgents\" >>'$LOG_FILE'" >/dev/null 2>&1 &
}

log "phase10_7_finalize_claim start"

command -v cast >/dev/null || fail "cast not found in PATH"
command -v python3 >/dev/null || fail "python3 not found in PATH"

ENV_FILE="$REPO_ROOT/contracts/.env.automation.local"
test -r "$ENV_FILE" || fail "missing env file: $ENV_FILE"
set +u
set -a
source "$ENV_FILE"
set +a
set -u

: "${AUTOMATION_PRIVATE_KEY:?missing AUTOMATION_PRIVATE_KEY}"
: "${AUTOMATION_RPC_URL:?missing AUTOMATION_RPC_URL}"
: "${USDC_ADDRESS:?missing USDC_ADDRESS}"

OWNER_PRIVATE_KEY="$AUTOMATION_PRIVATE_KEY"
EXPECTED_OWNER="0xe9c7B76d09863309b4eF1ab71EB32d89b0F9e29E"
ORACLE="0xA4b27Ee975C31Ad60fF0Bda8ACB680Cb183BC004"
EVENT_MARKET="0x2E9F15905739632ed7b156b4c7824d368a97bB15"
FINAL_EVENT_ID="0x2b902d6a9c3a763f380d5c1af8475ea4efa1142488ebc730dc7c1c8851b061b1"
MARKET_ID=96
BET_AMOUNT=500000
DISPUTE_WINDOW_SECONDS=$((72 * 3600))
QA_DOC="$REPO_ROOT/docs/qa/2026-06-13-phase7b-testnet-deploy.md"
TASKS_DOC="$REPO_ROOT/openspec/changes/archive/2026-06-24-add-worldcup-category/tasks.md"

OWNER_ADDR=$(cast wallet address "$OWNER_PRIVATE_KEY")
log "owner address: $OWNER_ADDR"
if [[ "$OWNER_ADDR" != "$EXPECTED_OWNER" ]]; then
  fail "owner address mismatch"
fi

propose_tx=$(awk -F'`' '/propose tx hash:/{v=$2} END{print v}' "$QA_DOC")
propose_ts=$(awk -F'`' '/propose block timestamp \(unix\):/{v=$2} END{print v}' "$QA_DOC")
if [[ -z "$propose_tx" || -z "$propose_ts" ]]; then
  fail "missing propose evidence in QA doc"
fi

finalize_earliest=$((propose_ts + DISPUTE_WINDOW_SECONDS))
latest_ts=$(cast block latest --rpc-url "$AUTOMATION_RPC_URL" --field timestamp | awk 'NR==1{print $1}')
log "latest timestamp: $latest_ts ($(iso_utc "$latest_ts")); finalize earliest: $finalize_earliest ($(iso_utc "$finalize_earliest"))"
if (( latest_ts < finalize_earliest )); then
  fail "finalize window not reached"
fi

status_before=$(cast call "$ORACLE" "getEventStatus(bytes32)(uint8)" "$FINAL_EVENT_ID" --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
log "oracle status before finalize: $status_before"
if [[ "$status_before" != "1" ]]; then
  fail "oracle status is not Proposed(1)"
fi

finalize_json=$(cast send "$ORACLE" "finalizeResult(bytes32)" "$FINAL_EVENT_ID" --rpc-url "$AUTOMATION_RPC_URL" --private-key "$OWNER_PRIVATE_KEY" --json)
finalize_tx=$(printf '%s' "$finalize_json" | json_field transactionHash)
finalize_status=$(cast receipt "$finalize_tx" status --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
if [[ "$finalize_status" != "1" ]]; then
  fail "finalize receipt status is not success: $finalize_status"
fi
finalize_block=$(cast receipt "$finalize_tx" blockNumber --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
finalize_ts=$(cast block "$finalize_block" --rpc-url "$AUTOMATION_RPC_URL" --field timestamp | awk 'NR==1{print $1}')

status_after_finalize=$(cast call "$ORACLE" "getEventStatus(bytes32)(uint8)" "$FINAL_EVENT_ID" --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
if [[ "$status_after_finalize" != "3" ]]; then
  fail "oracle status after finalize is not Finalized(3): $status_after_finalize"
fi

resolve_json=$(cast send "$EVENT_MARKET" "resolve(uint256)" "$MARKET_ID" --rpc-url "$AUTOMATION_RPC_URL" --private-key "$OWNER_PRIVATE_KEY" --json)
resolve_tx=$(printf '%s' "$resolve_json" | json_field transactionHash)
resolve_status=$(cast receipt "$resolve_tx" status --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
if [[ "$resolve_status" != "1" ]]; then
  fail "resolve receipt status is not success: $resolve_status"
fi
resolve_block=$(cast receipt "$resolve_tx" blockNumber --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
resolve_ts=$(cast block "$resolve_block" --rpc-url "$AUTOMATION_RPC_URL" --field timestamp | awk 'NR==1{print $1}')

payout_raw=$(cast call "$EVENT_MARKET" "pendingPayout(uint256,address)(uint256)" "$MARKET_ID" "$OWNER_ADDR" --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
balance_before=$(cast call "$USDC_ADDRESS" "balanceOf(address)(uint256)" "$OWNER_ADDR" --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')

claim_json=$(cast send "$EVENT_MARKET" "claim(uint256)" "$MARKET_ID" --rpc-url "$AUTOMATION_RPC_URL" --private-key "$OWNER_PRIVATE_KEY" --json)
claim_tx=$(printf '%s' "$claim_json" | json_field transactionHash)
claim_status=$(cast receipt "$claim_tx" status --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
if [[ "$claim_status" != "1" ]]; then
  fail "claim receipt status is not success: $claim_status"
fi
claim_block=$(cast receipt "$claim_tx" blockNumber --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
claim_ts=$(cast block "$claim_block" --rpc-url "$AUTOMATION_RPC_URL" --field timestamp | awk 'NR==1{print $1}')
balance_after=$(cast call "$USDC_ADDRESS" "balanceOf(address)(uint256)" "$OWNER_ADDR" --rpc-url "$AUTOMATION_RPC_URL" | awk 'NR==1{print $1}')
balance_delta=$((balance_after - balance_before))

payout_usdc=$(format_usdc "$payout_raw")
delta_usdc=$(format_usdc "$balance_delta")
log "finalize tx: $finalize_tx; resolve tx: $resolve_tx; claim tx: $claim_tx; payout raw=$payout_raw delta=$balance_delta"

cat >>"$QA_DOC" <<EOF

## Phase 10.7 Step 2: finalize + resolve + claim

- propose tx hash: \`$propose_tx\`
- finalize tx hash: \`$finalize_tx\`
- finalize block number: \`$finalize_block\`
- finalize block timestamp (unix): \`$finalize_ts\`
- finalize block timestamp (UTC ISO): \`$(iso_utc "$finalize_ts")\`
- oracle status before finalize: Proposed (\`$status_before\`)
- oracle status after finalize: Finalized (\`$status_after_finalize\`)
- resolve tx hash: \`$resolve_tx\`
- resolve block number: \`$resolve_block\`
- resolve block timestamp (unix): \`$resolve_ts\`
- resolve block timestamp (UTC ISO): \`$(iso_utc "$resolve_ts")\`
- claim tx hash: \`$claim_tx\`
- claim block number: \`$claim_block\`
- claim block timestamp (unix): \`$claim_ts\`
- claim block timestamp (UTC ISO): \`$(iso_utc "$claim_ts")\`
- claimed market: \`$MARKET_ID\`
- claimed outcome: 0 (ARG / home)
- pending payout before claim: \`$payout_raw\` raw USDC ($payout_usdc USDC)
- USDC balance before claim: \`$balance_before\`
- USDC balance after claim: \`$balance_after\`
- USDC balance delta: \`$balance_delta\` raw USDC ($delta_usdc USDC)
EOF

export PROPOSE_TX="$propose_tx"
export FINALIZE_TX="$finalize_tx"
export RESOLVE_TX="$resolve_tx"
export CLAIM_TX="$claim_tx"
python3 <<'PY'
import os
import re
from pathlib import Path

path = Path("openspec/changes/archive/2026-06-24-add-worldcup-category/tasks.md")
text = path.read_text()
propose = os.environ["PROPOSE_TX"]
finalize = os.environ["FINALIZE_TX"]
resolve = os.environ["RESOLVE_TX"]
claim = os.environ["CLAIM_TX"]
qa = "docs/qa/2026-06-13-phase7b-testnet-deploy.md"

repls = {
    r"^- \[[ x]\] 10\.7 Phase 7c.*$": f"- [x] 10.7 Phase 7c（post-archive smoke）：测试网 finalize/claim — 证据：`{qa}` §Phase 10.7 Step 1 / Step 2；propose `{propose}`，finalize `{finalize}`，resolve `{resolve}`，claim `{claim}`",
    r"^  - \[[ x]\] 10\.7\.1 .*$": f"  - [x] 10.7.1 propose outcome=ARG via AdminEventOracle 测试网 — 证据：`{qa}` §Phase 10.7 Step 1，tx `{propose}`",
    r"^  - \[[ x]\] 10\.7\.2 .*$": f"  - [x] 10.7.2 等待 72h dispute window 过 — 证据：`{qa}` §Phase 10.7 Step 1 / Step 2，finalize earliest 由 propose block timestamp + 72h 计算",
    r"^  - \[[ x]\] 10\.7\.3 .*$": f"  - [x] 10.7.3 调 finalize — 证据：`{qa}` §Phase 10.7 Step 2，finalize tx `{finalize}`",
    r"^  - \[[ x]\] 10\.7\.4 .*$": f"  - [x] 10.7.4 claim 7b 那笔下注 — 证据：`{qa}` §Phase 10.7 Step 2，resolve tx `{resolve}`，claim tx `{claim}`",
    r"^  - \[[ x]\] 10\.7\.5 .*$": f"  - [x] 10.7.5 追加 \"Phase 7c smoke\" 章节到 7b 文档 — 证据：`{qa}` §Phase 10.7 Step 1 / Step 2",
}

for pattern, replacement in repls.items():
    text, count = re.subn(pattern, replacement, text, flags=re.MULTILINE)
    if count != 1:
        raise SystemExit(f"expected exactly one replacement for {pattern}, got {count}")

path.write_text(text)
PY

log "phase10_7_finalize_claim completed"
cleanup_launch_agents_async
