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

const positionList = readRequiredText('components/PositionList.tsx');
const resolvedList = readRequiredText('components/ResolvedList.tsx');

assertUseClient('PositionList.tsx', positionList);
assertUseClient('ResolvedList.tsx', resolvedList);

assertIncludesAll('PositionList.tsx', positionList, [
  'DashboardRow',
  'userPositionOf',
  'OUTCOMES',
  'fmtUsdc',
  "userPositionOf(r) !== 'none'",
  "OUTCOMES[r.market.outcome] === 'Unresolved'",
  'if (userRows.length === 0) return null;',
  "pos === 'yes'",
  "pos === 'no'",
  "pos === 'both'",
  'r.yesStake + r.noStake',
]);

assertExcludesAll('PositionList.tsx', positionList, [
  'claimedFlag',
  'useWriteContract',
  'rounded-2xl',
  'rounded-xl',
  'tracking-',
  'letterSpacing',
]);

assertIncludesAll('ResolvedList.tsx', resolvedList, [
  'OUTCOMES',
  'userIsWinner',
  'fmtUsdc',
  'useWriteContract',
  'PREDICTION_MARKET_ADDRESS',
  'PredictionMarketAbi',
  "OUTCOMES[r.market.outcome] !== 'Unresolved'",
  'if (resolved.length === 0) return null;',
  '!r.claimed_ && userIsWinner(r) && r.pendingPayout > 0n',
  'PredictionMarketAbi as Abi',
  "functionName: 'claim'",
  'args: [id]',
  'chainId: arcTestnet.id',
  'fmtUsdc(r.pendingPayout)',
  'Claim',
  'pendingPayout',
  'submittedIds',
  '!submittedIds.has(r.id.toString())',
  'setSubmittedIds',
  'new Set(ids).add(id.toString())',
  '等待链上确认',
  'statusById',
  '领取已确认',
  '领取交易失败',
  'r.claimed_ || r.pendingPayout === 0n',
  'useAccount',
  'const { address } = useAccount();',
  '[address]',
  'setSubmittedIds(() => new Set())',
  'setStatusById({})',
  'setPendingId(null)',
  'usePublicClient',
  'waitForTransactionReceipt',
  'claimScopeRef',
  'claimScopeRef.current += 1',
  'if (claimScopeRef.current !== scope)',
  'next.delete(idKey)',
]);

assertExcludesAll('ResolvedList.tsx', resolvedList, [
  'claimedFlag',
  'rounded-2xl',
  'rounded-xl',
  'tracking-',
  'letterSpacing',
  'isReceiptTrackingActive',
  '!isReceiptTrackingActive',
  'useWaitForTransactionReceipt',
]);

console.log('position lists 检查通过');
