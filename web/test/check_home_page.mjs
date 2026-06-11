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
  'useMemo',
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
  'SiteHeader',
  'SiteFooter',
  'MarketFilterBar',
  'MarketCard',
  'BetModal',
  'filterMarkets',
  'PYTH_PRICE_ID_TO_ASSET',
  'visibleActiveMarkets',
  'refetch',
  'setBetting',
  '正在读取最新市场',
  '首页数据读取失败',
  '当前没有未结算市场',
  '当前筛选条件下没有未结算市场',
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
  /const visibleActiveMarkets = useMemo\(\s*\(\)\s*=>\s*filterMarkets\(\s*activeMarkets,\s*\{[\s\S]*asset,[\s\S]*cadence,[\s\S]*priceIdToAsset:\s*PYTH_PRICE_ID_TO_ASSET/u,
  'visibleActiveMarkets 必须基于 activeMarkets 与 filterMarkets 计算。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /\{\s*visibleActiveMarkets\.map\(\(row\)\s*=>[\s\S]{0,300}<MarketCard/u,
  'MarketCard 列表必须来自 visibleActiveMarkets.map。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /<>\s*<NetworkBanner \/>\s*<SiteHeader \/>\s*<main[\s\S]*<SiteFooter \/>\s*\{betting \?/u,
  '首页顺序必须是 NetworkBanner -> SiteHeader -> main -> SiteFooter -> BetModal。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /onClose=\{\(\)\s*=>\s*\{\s*setBetting\(null\);\s*void refetch\(\);\s*\}\}/u,
  'BetModal.onClose 必须关闭 modal 并触发 refetch()。',
);

assertExcludesAll('page.tsx', pageSource, [
  'ActivityBadges',
  'FaucetCard',
  'PositionList',
  'ResolvedList',
  'SummaryCard',
  'EmptyPanel',
  'shortAddress',
  '活跃总池',
  '已加载 / 总数',
  '钱包状态',
  '市场总览',
  '链上入口',
  '我的持仓',
  '已结算市场',
]);

const chineseCharCount = (pageSource.match(/[\u4e00-\u9fff]/gu) ?? []).length;
assert(chineseCharCount >= 20, 'page.tsx 仍应保留必要中文状态文案。');

console.log('home page 检查通过');
