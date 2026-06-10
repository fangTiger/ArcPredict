#!/usr/bin/env bash
set -euo pipefail

command -v jq >/dev/null || {
  echo "缺少 jq"
  exit 1
}

FORGE_BIN="${FORGE_BIN:-}"
if [[ -z "$FORGE_BIN" ]]; then
  FORGE_BIN="$(command -v forge || true)"
fi
[[ -n "$FORGE_BIN" ]] || {
  echo "缺少 forge，可通过 FORGE_BIN 指定"
  exit 1
}
[[ -x "$FORGE_BIN" ]] || {
  echo "FORGE_BIN 不可执行: $FORGE_BIN"
  exit 1
}

repo_root="$(git rev-parse --show-toplevel)"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

cp -R "$repo_root/contracts" "$tmpdir/contracts"
mkdir -p "$tmpdir/web"

cd "$tmpdir/contracts"

env \
  OWNER_PRIVATE_KEY=1 \
  USDC_ADDRESS=0x1111111111111111111111111111111111111111 \
  PYTH_ADDRESS=0x2222222222222222222222222222222222222222 \
  FEE_RECIPIENT=0x3333333333333333333333333333333333333333 \
  "$FORGE_BIN" script --offline script/Deploy.s.sol

addresses_path="../web/lib/addresses.ts"
prediction_market_abi_path="../web/lib/abis/PredictionMarket.json"

[[ -f "$addresses_path" ]] || {
  echo "缺少生成文件: $addresses_path"
  exit 1
}

[[ -f "$prediction_market_abi_path" ]] || {
  echo "缺少生成文件: $prediction_market_abi_path"
  exit 1
}

rg -q "export const PREDICTION_MARKET_ADDRESS = '" "$addresses_path" || {
  echo "addresses.ts 缺少 PREDICTION_MARKET_ADDRESS 导出"
  exit 1
}

rg -q "export const USDC_ADDRESS = '" "$addresses_path" || {
  echo "addresses.ts 缺少 USDC_ADDRESS 导出"
  exit 1
}

rg -q "export const PYTH_ADDRESS = '" "$addresses_path" || {
  echo "addresses.ts 缺少 PYTH_ADDRESS 导出"
  exit 1
}

jq -e 'type == "array" and any(.[]; .name == "bet")' "$prediction_market_abi_path" >/dev/null || {
  echo "PredictionMarket.json 不是包含 bet 的 ABI 数组"
  exit 1
}

echo "Deploy cold start 检查通过"
