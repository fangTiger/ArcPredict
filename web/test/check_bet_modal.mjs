import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const webRoot = resolve(process.cwd(), 'web');

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

const assertExcludesAll = (label, source, tokens) => {
  for (const token of tokens) {
    assert(!source.includes(token), `${label} 不应包含: ${token}`);
  }
};

const betModal = readRequiredText('components/BetModal.tsx');

assertUseClient('BetModal.tsx', betModal);

assertIncludesAll('BetModal.tsx hooks', betModal, [
  'useAccount',
  'useReadContract',
  'useWriteContract',
  'useWaitForTransactionReceipt',
  'useSwitchChain',
]);

assertIncludesAll('BetModal.tsx allowance', betModal, [
  "functionName: 'allowance'",
  'args: address ? [address, PREDICTION_MARKET_ADDRESS] : undefined',
  'query: { enabled: !!address',
  'refetchAllowance',
]);

assertIncludesAll('BetModal.tsx balance', betModal, [
  "functionName: 'balanceOf'",
  'refetchBalance',
  'balanceRaw',
]);

assertIncludesAll('BetModal.tsx 独立交易状态', betModal, [
  'const approveWrite = useWriteContract();',
  'const betWrite = useWriteContract();',
  'const approveHash = approveWrite.data;',
  'const betHash = betWrite.data;',
  'hash: approveHash',
  'hash: betHash',
]);

assertIncludesAll('BetModal.tsx approve 写入', betModal, [
  'address: USDC_ADDRESS',
  'abi: erc20Abi',
  "functionName: 'approve'",
  'args: [PREDICTION_MARKET_ADDRESS, maxUint256]',
  'chainId: arcTestnet.id',
]);

assertIncludesAll('BetModal.tsx bet 写入', betModal, [
  'address: PREDICTION_MARKET_ADDRESS',
  'abi: predictionMarketAbi',
  "functionName: 'bet'",
  'args: [row.id, side, parsedAmount]',
  'chainId: arcTestnet.id',
]);

assertIncludesAll('BetModal.tsx 链切换', betModal, [
  'switchChainAsync({ chainId: arcTestnet.id })',
]);

assertIncludesAll('BetModal.tsx UI 文案', betModal, [
  'Step 1/2: Approve USDC',
  'Step 2/2: Place Bet',
  'Your Stake',
  'Implied Win',
  '赔率随新下注变化',
]);

assertIncludesAll('BetModal.tsx 最小下注与余额提示', betModal, [
  'MIN_BET_RAW = 100000n',
  '0.1 USDC',
  '余额不足',
  'https://faucet.circle.com',
  'Place Bet',
  'YES',
  'NO',
]);

assertExcludesAll('BetModal.tsx 样式约束', betModal, [
  'rounded-2xl',
  'rounded-xl',
  'tracking-',
  'letterSpacing',
]);

console.log('bet modal 检查通过');
