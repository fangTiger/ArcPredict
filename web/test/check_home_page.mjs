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

const pageSource = readRequiredText('app/page.tsx');

assert.equal(
  firstEffectiveLine(pageSource),
  "'use client';",
  "page.tsx 第一条有效语句必须是 'use client';",
);

assertIncludesAll('page.tsx', pageSource, [
  'useAccount',
  'useReadContract',
  'useState',
  'PREDICTION_MARKET_ADDRESS',
  'PredictionMarketAbi',
  'PredictionMarketAbi as Abi',
  'zeroAddress',
  'arcTestnet',
  'chainId: arcTestnet.id',
  "functionName: 'getDashboardLatest'",
  'args: [user, 100n]',
  'query: { refetchInterval:',
  'NetworkBanner',
  'WalletPill',
  'FaucetCard',
  'MarketCard',
  'BetModal',
  'PositionList',
  'ResolvedList',
  'OUTCOMES',
  'fmtUsdc',
  'refetch',
  'setBetting',
]);

assertMatches(
  'page.tsx',
  pageSource,
  /const user = address \?\? zeroAddress;/u,
  '必须对未连接钱包使用 zeroAddress 回退。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /rows\.filter\(\(row\)\s*=>\s*OUTCOMES\[row\.market\.outcome\]\s*===\s*'Unresolved'\)/u,
  '必须只把 Unresolved 市场作为 active markets。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /activeMarkets\s*\.reduce\(\s*\(sum,\s*row\)\s*=>\s*sum\s*\+\s*row\.market\.yesPool\s*\+\s*row\.market\.noPool,\s*0n,\s*\)/u,
  'total pool 必须基于 active markets 的 yesPool + noPool 聚合。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /fmtUsdc\(totalActivePool\)/u,
  '总池展示必须通过 fmtUsdc 格式化。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /onClose=\{\(\)\s*=>\s*\{\s*setBetting\(null\);\s*void refetch\(\);\s*\}\}/u,
  'BetModal.onClose 必须关闭 modal 并触发 refetch()。',
);

assertExcludesAll('page.tsx', pageSource, [
  'getDashboard(user, 0, 100)',
  'claimedFlag',
  'rounded-2xl',
  'rounded-xl',
  'tracking-',
  'letterSpacing',
  '准备中',
]);

const chineseCharCount = (pageSource.match(/[\u4e00-\u9fff]/gu) ?? []).length;
assert(chineseCharCount >= 30, 'page.tsx 文案应以中文为主。');

assertMatches(
  'page.tsx',
  pageSource,
  /活跃市场/u,
  '需要包含首页 dashboard 的中文活跃市场文案。',
);

console.log('home page 检查通过');
