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

const assertExcludesAll = (label, source, tokens) => {
  for (const token of tokens) {
    assert(!source.includes(token), `${label} 不应包含: ${token}`);
  }
};

const assertMatches = (label, source, pattern, message) => {
  assert(pattern.test(source), `${label} ${message}`);
};

const assertReadHookHasChainId = (label, source, functionName) => {
  const pattern = new RegExp(
    String.raw`useReadContract\(\{[\s\S]*?functionName: '${functionName}'[\s\S]*?chainId: arcTestnet\.id[\s\S]*?\}\);`,
    'u',
  );

  assert(
    pattern.test(source),
    `${label} 的 ${functionName} 读取必须显式指定 chainId: arcTestnet.id`,
  );
};

const assertSwitchChainReturns = (label, source) => {
  const pattern = new RegExp(
    String.raw`await switchChainAsync\(\{ chainId: arcTestnet\.id \}\);\s+setFeedback\('切换到 Arc Testnet 后，请再次确认下注。'\);\s+return;`,
    'u',
  );

  assert(
    pattern.test(source),
    `${label} 切链成功后必须停止当前提交流程，等待新链状态重算`,
  );
};

const assertNeedsApproveUsesFreshApproval = (label, source) => {
  const pattern = new RegExp(
    String.raw`const needsApprove =[\s\S]*?!hasFreshApproval[\s\S]*?allowanceRaw < parsedAmount;`,
    'u',
  );

  assert(
    pattern.test(source),
    `${label} 的 needsApprove 必须考虑 !hasFreshApproval`,
  );
};

const assertReadingAllowanceUsesFreshApproval = (label, source) => {
  const pattern = new RegExp(
    String.raw`const readingAllowance =[\s\S]*?allowanceRaw === null[\s\S]*?!hasFreshApproval;`,
    'u',
  );

  assert(
    pattern.test(source),
    `${label} 的 readingAllowance 必须考虑 !hasFreshApproval`,
  );
};

const betModal = readRequiredText('components/BetModal.tsx');
const eventBetModal = readRequiredText('components/EventBetModal.tsx');

assertUseClient('BetModal.tsx', betModal);
assertUseClient('EventBetModal.tsx', eventBetModal);
assertReadHookHasChainId('BetModal.tsx', betModal, 'allowance');
assertReadHookHasChainId('BetModal.tsx', betModal, 'balanceOf');
assertReadHookHasChainId('EventBetModal.tsx', eventBetModal, 'allowance');
assertReadHookHasChainId('EventBetModal.tsx', eventBetModal, 'balanceOf');
assertSwitchChainReturns('BetModal.tsx', betModal);
assertNeedsApproveUsesFreshApproval('BetModal.tsx', betModal);
assertReadingAllowanceUsesFreshApproval('BetModal.tsx', betModal);
assertNeedsApproveUsesFreshApproval('EventBetModal.tsx', eventBetModal);
assertReadingAllowanceUsesFreshApproval('EventBetModal.tsx', eventBetModal);

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
  '!hasFreshApproval',
]);

assertIncludesAll('BetModal.tsx balance', betModal, [
  "functionName: 'balanceOf'",
  'refetchBalance',
  'balanceRaw',
]);

assertIncludesAll('BetModal.tsx 独立交易状态', betModal, [
  'const approveWrite = useWriteContract();',
  'const betWrite = useWriteContract();',
  'currentApproveHash',
  'currentBetHash',
  'hasFreshApproval',
  'setHasFreshApproval(true)',
  'setHasFreshApproval(false)',
  'hash: currentApproveHash',
  'hash: currentBetHash',
  'setCurrentApproveHash(undefined)',
  'setCurrentBetHash(undefined)',
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
  '正在读取 USDC 余额',
  '正在确认是否需要 Approve',
  'https://faucet.circle.com',
  'Place Bet',
  'YES',
  'NO',
]);

assertIncludesAll('BetModal.tsx Phase16 样式', betModal, [
  'bg-paper',
  'border-hair',
  'bg-canvas',
  'bg-arc',
  'bg-heat/10',
  'text-ink',
  'text-ink-2',
]);

assertIncludesAll('BetModal.tsx 地址切换重置授权', betModal, [
  'setHasFreshApproval(false);',
  '[address]',
]);

assertMatches(
  'BetModal.tsx',
  betModal,
  /if \(step !== 'betting' \|\| !currentBetHash \|\| !betReceipt\.isSuccess\) \{\s+return;\s+\}[\s\S]*?setCurrentBetHash\(undefined\);[\s\S]*?setStep\('success'\);[\s\S]*?setFeedback\('下注已提交成功。'\);[\s\S]*?void refetchAllowance\(\);[\s\S]*?void refetchBalance\(\);[\s\S]*?onClose\(\);/u,
  '在 bet receipt 成功后必须直接调用 onClose()',
);

assertIncludesAll('BetModal.tsx 切链后重新确认', betModal, [
  'await switchChainAsync({ chainId: arcTestnet.id });',
  '切换到 Arc Testnet 后，请再次确认下注。',
]);

assertExcludesAll('BetModal.tsx 样式约束', betModal, [
  'rounded-2xl',
  'rounded-xl',
  'tracking-',
  'letterSpacing',
  'bg-base/80',
  'bg-elevated',
  'bg-surface',
  'bg-accent',
]);

assertExcludesAll('BetModal.tsx 不应把未就绪读数当作 0', betModal, [
  'const allowanceRaw = (allowance as bigint | undefined) ?? 0n;',
  'const balanceRaw = (balance as bigint | undefined) ?? 0n;',
  'const safeAmount = parsedAmount ?? 0n;',
  'const approveHash = approveWrite.data;',
  'const betHash = betWrite.data;',
  '正在读取 USDC 授权，请稍候。',
]);

assertIncludesAll('EventBetModal.tsx hooks', eventBetModal, [
  'EventMarketAbi',
  'EVENT_MARKET_ADDRESS',
  'useAccount',
  'useReadContract',
  'useWriteContract',
  'useWaitForTransactionReceipt',
  'useSwitchChain',
]);

assertIncludesAll('EventBetModal.tsx allowance spender', eventBetModal, [
  "functionName: 'allowance'",
  'args: address && eventMarketConfigured ? [address, EVENT_MARKET_ADDRESS] : undefined',
  'EVENT_MARKET_ADDRESS !== zeroAddress',
  'refetchAllowance',
  '!hasFreshApproval',
]);

assertIncludesAll('EventBetModal.tsx approve 写入', eventBetModal, [
  'address: USDC_ADDRESS',
  'abi: erc20Abi',
  "functionName: 'approve'",
  'args: [EVENT_MARKET_ADDRESS, maxUint256]',
  'chainId: arcTestnet.id',
]);

assertIncludesAll('EventBetModal.tsx event bet 写入', eventBetModal, [
  'address: EVENT_MARKET_ADDRESS',
  'abi: eventMarketAbi',
  "functionName: 'bet'",
  'args: [row.id, outcomeIndex, parsedAmount]',
  'chainId: arcTestnet.id',
]);

assertIncludesAll('EventBetModal.tsx UI 文案', eventBetModal, [
  'World Cup bet',
  'Selection',
  'EventMarket address is not configured',
  'Step 1/2: Approve USDC',
  'Step 2/2: Place Bet',
  'Place Bet',
]);

console.log('bet modal 检查通过');
