import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();
const webRoot = cwd.endsWith('/web') ? cwd : resolve(cwd, 'web');

const readRequiredText = (relativePath) => {
  const filePath = resolve(webRoot, relativePath);

  if (!existsSync(filePath)) {
    throw new Error(`缺少文件: web/${relativePath}`);
  }

  return readFileSync(filePath, 'utf8');
};

const firstEffectiveLine = (source) =>
  source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('//') && !line.startsWith('/*'));

const assertUseClient = (label, source) => {
  assert.equal(
    firstEffectiveLine(source),
    "'use client';",
    `${label} 第一条有效语句必须是 'use client';`,
  );
};

const assertIncludesAll = (label, source, tokens) => {
  for (const token of tokens) {
    assert(source.includes(token), `${label} 缺少关键内容: ${token}`);
  }
};

const walletPill = readRequiredText('components/WalletPill.tsx');
const networkBanner = readRequiredText('components/NetworkBanner.tsx');
const faucetCard = readRequiredText('components/FaucetCard.tsx');
const erc20AbiSource = readRequiredText('lib/abis/ERC20.json');

assertUseClient('WalletPill.tsx', walletPill);
assertUseClient('NetworkBanner.tsx', networkBanner);
assertUseClient('FaucetCard.tsx', faucetCard);

assertIncludesAll('WalletPill.tsx', walletPill, [
  'ConnectButton',
  'ConnectButton.Custom',
  'useReadContract',
  'USDC_ADDRESS',
  'ERC20Abi',
  "functionName: 'balanceOf'",
  'fmtUsdc',
  'truncateAddr',
  'refetchInterval: 10_000',
  'openConnectModal',
  'openAccountModal',
  'Connect Wallet',
  'bg-ink text-paper rounded-full px-4 py-2 text-sm font-medium',
  'hover:bg-arc-deep',
  '-translate-y-px',
  'h-2 w-2 rounded-full bg-arc',
]);

assertIncludesAll('NetworkBanner.tsx', networkBanner, [
  'useSwitchChain',
  'arcTestnet.id',
  'switchChain({ chainId: arcTestnet.id })',
  'Wrong network. Switch to Arc Testnet.',
  "isPending ? 'Switching...' : 'Switch'",
  'bg-heat/10',
  'text-heat',
  'border-b border-heat/30',
]);

assertIncludesAll('FaucetCard.tsx', faucetCard, [
  'https://faucet.circle.com',
  'balBn > 0n',
  'bal === undefined',
  '需要 testnet USDC',
  '下注本金和 gas',
  '前往 Circle Faucet',
]);

assert(
  !faucetCard.includes('rounded-2xl'),
  'FaucetCard.tsx 不应使用 rounded-2xl。',
);

const erc20Abi = JSON.parse(erc20AbiSource);
assert(Array.isArray(erc20Abi), 'ERC20.json 必须是 ABI 数组。');

const functionNames = erc20Abi
  .filter((item) => item?.type === 'function')
  .map((item) => item.name);

for (const name of ['balanceOf', 'approve', 'allowance', 'decimals']) {
  assert(functionNames.includes(name), `ERC20.json 缺少函数: ${name}`);
}

const approveEntry = erc20Abi.find((item) => item?.type === 'function' && item.name === 'approve');
assert(approveEntry, 'ERC20.json 缺少 approve 函数定义。');
assert.equal(
  approveEntry.stateMutability,
  'nonpayable',
  'approve 必须是 nonpayable。',
);

console.log('wallet components 检查通过');
