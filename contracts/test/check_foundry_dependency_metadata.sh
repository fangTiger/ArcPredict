#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

paths=(
  "contracts/lib/forge-std"
  "contracts/lib/openzeppelin-contracts"
  "contracts/lib/pyth-sdk-solidity"
)

urls=(
  "https://github.com/foundry-rs/forge-std"
  "https://github.com/OpenZeppelin/openzeppelin-contracts"
  "https://github.com/pyth-network/pyth-sdk-solidity"
)

if [[ ! -f .gitmodules ]]; then
  echo "缺少 .gitmodules"
  exit 1
fi

path_lines="$(git config -f .gitmodules --get-regexp '^submodule\..*\.path$' || true)"

for index in "${!paths[@]}"; do
  path="${paths[$index]}"
  expected_url="${urls[$index]}"

  mode="$(git ls-files --stage -- "$path" | awk 'NR == 1 { print $1 }')"
  if [[ "$mode" != "160000" ]]; then
    echo "缺少 gitlink: $path"
    exit 1
  fi

  submodule_name="$(awk -v expected_path="$path" '$2 == expected_path { name = $1; sub(/^submodule\./, "", name); sub(/\.path$/, "", name); print name }' <<<"$path_lines")"
  if [[ -z "$submodule_name" ]]; then
    echo "缺少 submodule path: $path"
    exit 1
  fi

  actual_url="$(git config -f .gitmodules --get "submodule.${submodule_name}.url" || true)"
  if [[ "$actual_url" != "$expected_url" ]]; then
    echo "submodule URL 不匹配: $path -> $actual_url"
    exit 1
  fi
done

echo "Foundry 依赖元信息已固化"
