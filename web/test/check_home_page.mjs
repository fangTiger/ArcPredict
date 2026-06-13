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
  'useRouter',
  'useSearchParams',
  'PREDICTION_MARKET_ADDRESS',
  'EVENT_MARKET_ADDRESS',
  'PredictionMarketAbi',
  'EventMarketAbi',
  'PredictionMarketAbi as Abi',
  'zeroAddress',
  'arcTestnet',
  'chainId: arcTestnet.id',
  "functionName: 'getDashboardLatest'",
  'args: [user, 100n]',
  'query: { refetchInterval:',
  'enabled:',
  'NetworkBanner',
  'SiteHeader',
  'SiteFooter',
  'MarketFilterBar',
  'CryptoMarketCard',
  'WorldCupMarketCard',
  'PositionList',
  'BetModal',
  'filterMarkets',
  'PYTH_PRICE_ID_TO_ASSET',
  'WORLDCUP_ENABLED',
  'category',
  'stage',
  'positions',
  'all',
  'router.replace',
  'searchParams.get',
  'refetch',
  'setBetting',
  'Loading the latest markets...',
  'Unable to load markets. Please try again shortly.',
  'No unresolved markets are available yet.',
  'No unresolved markets match these filters.',
  'No World Cup markets match this stage.',
  'World Cup',
  '<ArcBackground variant=',
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
  /filterMarkets\(\s*activeMarkets,\s*\{[\s\S]*category:\s*'crypto'[\s\S]*asset,[\s\S]*cadence,[\s\S]*priceIdToAsset:\s*PYTH_PRICE_ID_TO_ASSET/u,
  'Crypto 可见列表必须继续基于 activeMarkets 与 filterMarkets 计算。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /useReadContract\(\{[\s\S]*address:\s*EVENT_MARKET_ADDRESS[\s\S]*functionName:\s*'getDashboardLatest'/u,
  '首页必须并行准备 EventMarket getDashboardLatest 读取。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /category=worldcup|['"]worldcup['"]/u,
  '首页必须支持 World Cup URL category。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /const categoryParam = searchParams\.get\('category'\);/u,
  '首页必须先读取 category 查询参数再计算默认品类。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /categoryParam === 'crypto'\s*\?\s*'crypto'\s*:\s*'worldcup'/u,
  'World Cup 开启时首页空查询必须默认进入 World Cup，只有 category=crypto 才切回 Crypto。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /<MarketFilterBar[\s\S]*category=\{category\}[\s\S]*stage=\{stage\}/u,
  '首页必须把 category/stage 传给 MarketFilterBar。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /\},\s*\[\s*categoryFromQuery\s*,\s*showCategoryTabs\s*,\s*stageFromQuery\s*\]\s*\);/u,
  'URL -> state 同步 effect 只能依赖 query 派生值，不能依赖本地 category/stage 造成点击回滚。',
);

assertExcludesAll('page.tsx', pageSource, [
  '[category, categoryFromQuery, showCategoryTabs, stage, stageFromQuery]',
  "searchParams.get('category') === 'worldcup' && WORLDCUP_ENABLED ? 'worldcup' : 'crypto'",
]);

assertMatches(
  'page.tsx',
  pageSource,
  /effectiveCategory === 'crypto'[\s\S]*nextQuery\.set\('category', 'crypto'\)/u,
  '切换到 Crypto 时必须写入 category=crypto，避免空查询又回到 World Cup。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /effectiveCategory === 'worldcup'[\s\S]*nextQuery\.delete\('category'\)/u,
  'World Cup 是首页默认品类，Stage=all 时 URL 可保持空查询。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /<CryptoMarketCard|<WorldCupMarketCard/u,
  '首页必须按品类渲染 CryptoMarketCard 或 WorldCupMarketCard。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /<SiteHeader[\s\S]*allPositionsHref=|<SiteHeader[\s\S]*allPositionsActive=/u,
  '首页必须把“全部持仓”入口状态传给 SiteHeader。',
);

assertMatches(
  'page.tsx',
  pageSource,
  /<PositionList[\s\S]*kindFilter=\{[^}]+\}/u,
  '首页必须把 kindFilter 接给 PositionList。',
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
  '正在准备',
  '正在读取',
  '读取失败',
  '当前没有',
  '当前筛选',
  '当前阶段',
  '仍未部署',
  '已结算市场',
]);

const chineseCharCount = (pageSource.match(/[\u4e00-\u9fff]/gu) ?? []).length;
assert.equal(chineseCharCount, 0, 'page.tsx 首页可见状态文案应保持英文。');

console.log('home page 检查通过');
