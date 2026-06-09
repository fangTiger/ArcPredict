#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

script_path="contracts/script/VerifyAddresses.s.sol"

if [[ ! -f "$script_path" ]]; then
  echo "缺少验证脚本: $script_path"
  exit 1
fi

check_pattern() {
  local pattern="$1"
  local description="$2"

  if ! rg -q "$pattern" "$script_path"; then
    echo "脚本缺少约束: $description"
    exit 1
  fi
}

check_pattern 'contract VerifyAddresses is Script' 'VerifyAddresses 脚本合约声明'
check_pattern 'vm\.envAddress\("USDC_ADDRESS"\)' '读取 USDC_ADDRESS'
check_pattern 'vm\.envAddress\("PYTH_ADDRESS"\)' '读取 PYTH_ADDRESS'
check_pattern 'vm\.envAddress\("MULTICALL3_ADDRESS"\)' '读取 MULTICALL3_ADDRESS'
check_pattern 'require\(usdcDecimals == 6,' '校验 USDC decimals == 6'
check_pattern 'keccak256\(bytes\(usdcSymbol\)\) == keccak256\(bytes\("USDC"\)\)' '校验 USDC symbol == USDC'
check_pattern 'uint256 validTimePeriod = IPythMin\(pyth\)\.getValidTimePeriod\(\);' '读取 Pyth valid time period'
check_pattern 'require\(validTimePeriod > 0,' '校验 Pyth valid time period 非零'
check_pattern 'extcodesize\(multicall3\)' '检查 Multicall3 code size'
check_pattern 'require\(multicall3CodeSize > 0,' '校验 Multicall3 已部署'

echo "VerifyAddresses 脚本静态约束通过"
