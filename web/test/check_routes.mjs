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

const homePage = readRequiredText('app/page.tsx');
const marketPage = readRequiredText('app/market/[id]/page.tsx');
const connectPage = readRequiredText('app/connect/page.tsx');

assertUseClient('page.tsx', homePage);
assertUseClient('market/[id]/page.tsx', marketPage);
assertUseClient('connect/page.tsx', connectPage);

assertIncludesAll('market/[id]/page.tsx hooks', marketPage, [
  'useParams',
  'useSearchParams',
  'useAccount',
  'useReadContract',
  'useState',
  'zeroAddress',
]);

assert(
  marketPage.includes('MAX_MARKET_ID') || marketPage.includes('MAX_UINT256'),
  'market/[id]/page.tsx 必须声明市场编号上界常量。',
);

assert(
  marketPage.includes('parsed >= MAX_MARKET_ID') ||
    marketPage.includes('idBn >= MAX_MARKET_ID') ||
    marketPage.includes('parsed > MAX_MARKET_ID') ||
    marketPage.includes('idBn > MAX_MARKET_ID') ||
    marketPage.includes('parsed + 1n > MAX_MARKET_ID') ||
    marketPage.includes('idBn + 1n > MAX_MARKET_ID'),
  'market/[id]/page.tsx 必须对 uint256 上界做保护，避免 idBn + 1n 越界。',
);

assertExcludesAll('market/[id]/page.tsx 裸 BigInt 解析', marketPage, [
  'const idBn = BigInt(id);',
]);

assert(
  marketPage.includes('parseMarketId') ||
    marketPage.includes('try {') ||
    marketPage.includes('catch') ||
    marketPage.includes('idBn === null') ||
    marketPage.includes('idBn !== null'),
  'market/[id]/page.tsx 必须对路由 id 做安全解析与判空保护。',
);

assertIncludesAll('market/[id]/page.tsx 合约读取', marketPage, [
  "functionName: 'getDashboard'",
  'chainId: arcTestnet.id',
  'user = address ?? zeroAddress',
  'NetworkBanner',
  'WalletPill',
  'MarketDetailCard',
  'BetModal',
  'EventBetModal',
  'refetch',
  'refetchEvent',
  'setBetting',
  'setEventBetting',
  'EventMarketAbi',
  'EVENT_MARKET_ADDRESS',
  'WORLDCUP_ENABLED',
  'searchParams.get',
  'kind',
  'resolveWorldCupMarkets',
  'WORLDCUP_SKELETON_MARKETS',
]);

assertIncludesAll('market/[id]/page.tsx 详情页卡片隔离', marketPage, [
  "from '@/components/MarketDetailCard'",
  "ComponentProps<typeof MarketDetailCard>['row']",
  '<MarketDetailCard',
  'marketKind=',
]);

assertExcludesAll('market/[id]/page.tsx 禁止复用首页卡片', marketPage, [
  "from '@/components/MarketCard'",
  'ComponentProps<typeof MarketCard>',
  '<MarketCard',
]);

assert(
  marketPage.includes('args: [user, idBn, idBn + 1n]') ||
    (marketPage.includes('const readArgs = idBn === null ? undefined : [user, idBn, idBn + 1n];') &&
      marketPage.includes('args: readArgs')) ||
    (marketPage.includes('const readArgs =') &&
      marketPage.includes('contractIdBn') &&
      marketPage.includes('[user, contractIdBn, contractIdBn + 1n]') &&
      marketPage.includes('args: readArgs')),
  'market/[id]/page.tsx 必须以合法市场 id 的 [user, id, id + 1n] 作为 getDashboard 参数窗口。',
);

assertMatches(
  'market/[id]/page.tsx',
  marketPage,
  /query:\s*\{[\s\S]*enabled:\s*(?:requestedKind !== 'event' && )?idBn !== null[\s\S]*refetchInterval:\s*5_000[\s\S]*\}/u,
  'PRICE 读取必须在非法 id 时禁用，并维持 5 秒刷新。',
);

assertMatches(
  'market/[id]/page.tsx',
  marketPage,
  /searchParams\.get\('kind'\)|searchParams\.get\("kind"\)/u,
  '必须解析 kind 查询参数以区分 price/event 详情。',
);

assertMatches(
  'market/[id]/page.tsx',
  marketPage,
  /kind\s*===\s*'event'|kind\s*===\s*"event"/u,
  '必须显式处理 EVENT 详情分支。',
);

assertMatches(
  'market/[id]/page.tsx',
  marketPage,
  /enabled:\s*hasEventMarket[\s\S]*(?:idBn|contractIdBn) !== null|enabled:\s*requestedKind === 'event'[\s\S]*(?:idBn|contractIdBn) !== null/u,
  'EventMarket 读取必须受部署状态与合法 id 共同保护。',
);

assert(
  marketPage.includes("redirect('/')") || marketPage.includes('router.replace(\'/\')') || marketPage.includes('router.replace("/")'),
  'market/[id]/page.tsx 在 WORLDCUP_ENABLED=false 且 kind=event 时必须重定向首页或等价处理。',
);

assertMatches(
  'market/[id]/page.tsx',
  marketPage,
  /const row = \(\s*data\?\.\[0\] as DashboardRow\[\]\s*\)\?\.\[0\];|const row = dashboardData\?\.\[0\]\?\.\[0\];/u,
  '必须从 getDashboard 返回结果中提取首个 DashboardRow。',
);

assert(
  marketPage.includes('isInvalidMarketError') ||
    (marketPage.includes('invalidmarketid') && marketPage.includes('InvalidMarketId')),
  'market/[id]/page.tsx 必须显式识别 InvalidMarketId 类错误。',
);

assert(
  /isInvalidMarketError[\s\S]{0,240}(error === null|error !== null|!error)[\s\S]{0,240}typeof error/u.test(
    marketPage,
  ) ||
    /isInvalidMarketError[\s\S]{0,240}typeof error[\s\S]{0,240}(error === null|error !== null|!error)/u.test(
      marketPage,
    ),
  'market/[id]/page.tsx 的错误识别必须先保护 null / 非对象，避免 readError 为 null 时崩溃。',
);

assertMatches(
  'market/[id]/page.tsx',
  marketPage,
  /onClose=\{\(\)\s*=>\s*\{\s*setBetting\(null\);\s*void refetch\(\);\s*\}\}/u,
  'BetModal.onClose 必须关闭 modal 并触发 refetch()。',
);

assertMatches(
  'market/[id]/page.tsx',
  marketPage,
  /requestedKind !== 'event' && betting \?|marketKind !== 'event' && betting \?/u,
  'EVENT 详情不得渲染 PRICE 专用 BetModal。',
);

assertIncludesAll('market/[id]/page.tsx 英文状态', marketPage, [
  'Loading market details',
  'Market not found',
  'Invalid market id',
]);

assertMatches(
  'market/[id]/page.tsx',
  marketPage,
  /isError[\s\S]*Market not found/u,
  'market/[id]/page.tsx 的错误分支需要把 InvalidMarketId 显示为 Market not found。',
);

assertIncludesAll('market/[id]/page.tsx 业务文案', marketPage, [
  'Market ID',
  'Network',
  'Wallet',
]);

assertExcludesAll('market/[id]/page.tsx 去除低价值详情块', marketPage, [
  '辅助入口',
  '网络与钱包排查',
  '合约浏览器',
  'Resolution Source',
]);

assertIncludesAll('market/[id]/page.tsx event 返回链接', marketPage, [
  "const backHref = kind === 'event' ? '/?category=worldcup' : '/';",
  'href={backHref}',
]);

assertExcludesAll('market/[id]/page.tsx 禁止暴露实现细节', marketPage, [
  '单市场深链视图',
  'DashboardRow',
  '仪表盘窗口',
  '读取地址',
  '刷新频率',
  '5000 ms',
  'zeroAddress}',
  ': zeroAddress',
]);

assertIncludesAll('page.tsx 首页卡片', homePage, [
  "from '@/components/CryptoMarketCard'",
  "from '@/components/WorldCupMarketCard'",
  "from '@/components/PositionList'",
  '<SiteHeader />',
  '<CryptoMarketCard',
  '<PositionList',
]);

assertExcludesAll('page.tsx 首页禁止详情页卡片', homePage, [
  'MarketDetailCard',
]);

assertIncludesAll('connect/page.tsx Arc 网络', connectPage, [
  'arcTestnet',
  "chainId: `0x${arcTestnet.id.toString(16)}`",
  'chainName: arcTestnet.name',
  'nativeCurrency: arcTestnet.nativeCurrency',
  'rpcUrls: arcTestnet.rpcUrls.default.http',
  'blockExplorerUrls: [arcTestnet.blockExplorers!.default.url]',
  'wallet_addEthereumChain',
  'params: [params]',
]);

assert(
  connectPage.includes('window.ethereum.request') || connectPage.includes('ethereum.request'),
  'connect/page.tsx 必须调用钱包 provider.request 添加 Arc 网络。',
);

assert(
  connectPage.includes('onClick={addArcNetwork}') ||
    connectPage.includes('onClick={() => void addArcNetwork()}'),
  'connect/page.tsx 需要提供可点击按钮触发 addArcNetwork。',
);

assertIncludesAll('connect/page.tsx 手动参数与链接', connectPage, [
  'Chain ID',
  'RPC',
  'Symbol',
  'Decimals',
  'Explorer',
  'https://faucet.circle.com',
  'https://testnet.arcscan.app',
]);

assertIncludesAll('connect/page.tsx 中文状态', connectPage, [
  '未检测到钱包',
  '已请求钱包添加 Arc Testnet',
  '你已取消添加网络',
  '添加网络失败',
]);

assertExcludesAll('Phase 13.2 样式约束', `${marketPage}\n${connectPage}`, [
  'rounded-2xl',
  'rounded-xl',
  'tracking-',
  'letterSpacing',
]);

console.log('routes 检查通过');
