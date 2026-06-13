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

const resolveCountdown = readRequiredText('components/ResolveCountdown.tsx');
const baseMarketCard = readRequiredText('components/BaseMarketCard.tsx');
const cryptoMarketCard = readRequiredText('components/CryptoMarketCard.tsx');
const marketCardShim = readRequiredText('components/MarketCard.tsx');
const worldCupMarketCard = readRequiredText('components/WorldCupMarketCard.tsx');
const worldCupOutcomePanel = readRequiredText('components/WorldCupOutcomePanel.tsx');
const marketDetailCard = readRequiredText('components/MarketDetailCard.tsx');
const eventInfoPanel = readRequiredText('components/EventInfoPanel.tsx');
const impliedProbabilityChart = readRequiredText('components/ImpliedProbabilityChart.tsx');
const siteHeader = readRequiredText('components/SiteHeader.tsx');

assertUseClient('ResolveCountdown.tsx', resolveCountdown);
assertUseClient('CryptoMarketCard.tsx', cryptoMarketCard);
assertUseClient('MarketCard.tsx', marketCardShim);
assertUseClient('WorldCupMarketCard.tsx', worldCupMarketCard);
assertUseClient('WorldCupOutcomePanel.tsx', worldCupOutcomePanel);
assertUseClient('MarketDetailCard.tsx', marketDetailCard);
assertUseClient('EventInfoPanel.tsx', eventInfoPanel);
assertUseClient('ImpliedProbabilityChart.tsx', impliedProbabilityChart);

assertIncludesAll('ResolveCountdown.tsx', resolveCountdown, [
  'useEffect',
  'setInterval',
  'deriveStatus',
  'fmtCountdown',
  'row.market.resolveAfter',
  '距结算窗口',
  '结算窗口开启',
  '等待结算',
  '可强制作废',
  '已结算',
  'text-heat',
  'text-ink-2',
]);

assert(
  !resolveCountdown.includes('row.market.betDeadline'),
  'ResolveCountdown.tsx active 分支不应再使用 betDeadline。',
);

assertIncludesAll('BaseMarketCard.tsx', baseMarketCard, [
  'renderHeader',
  'renderOutcomes',
  'renderFooter',
  'className',
  'rounded-[16px] border border-hair bg-paper p-6',
  'hover:-translate-y-0.5',
  'relative z-10',
]);

assertIncludesAll('CryptoMarketCard.tsx', cryptoMarketCard, [
  "import Link from 'next/link';",
  'BaseMarketCard',
  "import Link from 'next/link';",
  'DashboardRow',
  'PYTH_PRICE_ID_TO_ASSET',
  'parseCadenceTag',
  'yesPercent',
  'fmtUsdc',
  'fmtCountdown',
  'OUTCOMES',
  'font-display',
  'bg-paper',
  'border-hair',
  'bg-canvas',
  'Closes in',
  'View details',
  'Monthly · closing',
  'now < m.betDeadline',
  'bettingOpen',
  'm.yesPool + m.noPool',
  'Bet YES',
  'Bet NO',
  'betDeadline - now < 24n * 60n * 60n',
]);

assertExcludesAll('CryptoMarketCard.tsx 需移除 article 导航方案', cryptoMarketCard, [
  "import { useRouter } from 'next/navigation';",
  'role="link"',
  'tabIndex={0}',
  'router.push(detailHref)',
]);

assertMatches(
  'CryptoMarketCard.tsx',
  cryptoMarketCard,
  /const detailHref = `\/market\/\$\{row\.id\.toString\(\)\}`;/u,
  '必须声明详情地址 detailHref',
);

assertMatches(
  'CryptoMarketCard.tsx',
  cryptoMarketCard,
  /<Link[\s\S]*?href=\{detailHref\}/u,
  '必须使用 Link href={detailHref} 提供详情导航',
);

const firstDetailLinkMatch = cryptoMarketCard.match(/<Link[\s\S]*?href=\{detailHref\}[\s\S]*?<\/Link>/u);

assert(firstDetailLinkMatch, 'CryptoMarketCard.tsx 必须存在一个详情 Link 片段');
assertExcludesAll('CryptoMarketCard.tsx 主体 Link 不能包含按钮', firstDetailLinkMatch[0], [
  '<button',
  'Bet YES',
  'Bet NO',
]);

assertMatches(
  'CryptoMarketCard.tsx',
  cryptoMarketCard,
  /<Link[\s\S]*?href=\{detailHref\}[\s\S]*?<\/Link>[\s\S]*?<div className="grid grid-cols-2 gap-2">/u,
  '主体 Link 必须在按钮区域之前结束',
);

assertMatches(
  'CryptoMarketCard.tsx',
  cryptoMarketCard,
  /onClick=\{\(\) => onBet\(row\.id, true\)\}/u,
  'Bet YES 按钮必须保持直接下注行为',
);

assertMatches(
  'CryptoMarketCard.tsx',
  cryptoMarketCard,
  /onClick=\{\(\) => onBet\(row\.id, false\)\}/u,
  'Bet NO 按钮必须保持直接下注行为',
);

assertMatches(
  'CryptoMarketCard.tsx',
  cryptoMarketCard,
  />\s*(View details|查看详情)\s*</u,
  '必须提供明确的详情可见文案',
);

assertMatches(
  'CryptoMarketCard.tsx',
  cryptoMarketCard,
  /<Link[\s\S]*?href=\{detailHref\}[\s\S]*?>[\s\S]*?(View details|查看详情)[\s\S]*?<\/Link>/u,
  '必须保留清晰的 View details 详情入口',
);

assertExcludesAll('CryptoMarketCard.tsx', cryptoMarketCard, [
  'ResolveCountdown',
  'bg-surface',
  '下注已关闭',
  'Seed disclosure on market page',
]);

assertIncludesAll('MarketCard.tsx shim', marketCardShim, [
  "export { CryptoMarketCard as MarketCard }",
]);

assertIncludesAll('WorldCupMarketCard.tsx', worldCupMarketCard, [
  "import Link from 'next/link';",
  'BaseMarketCard',
  'WorldCupOutcomePanel',
  'onBet',
  'useMediaQuery',
  'flagIconUrlForTeam',
  '⚽',
  'stageLabel',
  'kickoffLabel',
  'liquidityLabel',
  'positionLabel',
  'backgroundImage',
  '?kind=event',
  'View details',
]);

assertExcludesAll('WorldCupMarketCard.tsx', worldCupMarketCard, ['BetModal', 'router.push']);

assertIncludesAll('WorldCupOutcomePanel.tsx', worldCupOutcomePanel, [
  'onSelectOutcome',
  'Home Win',
  'Other outcomes',
  'Show top 8',
  'Show all',
  'Collapse',
  'Bet',
  'grid-cols-3',
  'grid-cols-2',
  'implied',
  'isMobile',
  'overflow-y-auto',
  'max-h-',
]);

assertIncludesAll('MarketDetailCard.tsx', marketDetailCard, [
  'DashboardRow',
  'ResolveCountdown',
  'yesPercent',
  'fmtUsdc',
  'OUTCOMES',
  'bg-paper',
  'border-hair',
  'bg-canvas',
  'm.question',
  'Total Pool',
  'YES Share',
  'Betting closed',
  'Outcome:',
  'Bet YES',
  'Bet NO',
  'marketKind',
  'EventInfoPanel',
  'ImpliedProbabilityChart',
  'WorldCupOutcomePanel',
  'onBet',
]);

assertExcludesAll('MarketDetailCard.tsx', marketDetailCard, [
  'Seed disclosure on market page',
  'parseCadenceTag',
  'PYTH_PRICE_ID_TO_ASSET',
  'bg-surface',
  'bg-white/5',
  'border-white/10',
]);

assertMatches(
  'MarketDetailCard.tsx',
  marketDetailCard,
  /marketKind\s*===\s*'event'|row\.marketKind\s*===\s*'event'/u,
  '必须按 marketKind 区分 EVENT 详情视图',
);

assertMatches(
  'MarketDetailCard.tsx',
  marketDetailCard,
  /marketKind\s*===\s*'price'|row\.marketKind\s*!==\s*'event'/u,
  '必须保留 PRICE 详情分支',
);

assertIncludesAll('EventInfoPanel.tsx', eventInfoPanel, [
  'useLiveScore',
  'containerRef',
  'matchInProgress',
  'kickoffTime',
  'stageLabel',
  'Live score',
  'Match note',
]);

assertExcludesAll('EventInfoPanel.tsx 精简低价值信息', eventInfoPanel, [
  'Resolution Source',
  'ADMIN_EVENT_ORACLE_ADDRESS',
  'testnet.arcscan.app/address/',
]);

assertExcludesAll('EventInfoPanel.tsx', eventInfoPanel, ['BetModal', 'writeContract', 'placeBet']);

assertIncludesAll('ImpliedProbabilityChart.tsx', impliedProbabilityChart, [
  '<svg',
  'polyline',
  'outcomes',
  'openingProbability',
  'impliedProbability',
  'Outcome',
]);

assertExcludesAll('ImpliedProbabilityChart.tsx', impliedProbabilityChart, [
  'recharts',
  'lightweight-charts',
  'chart.js',
]);

assertIncludesAll('SiteHeader.tsx', siteHeader, [
  "import Link from 'next/link';",
  'allPositionsHref',
  'allPositionsActive',
  'WalletPill',
  'All Positions',
  'Positions',
]);

assertMatches(
  'SiteHeader.tsx',
  siteHeader,
  /allPositionsHref[\s\S]*?<Link[\s\S]*?href=\{allPositionsHref\}/u,
  'All Positions 入口必须存在可点击 Link。',
);

assertExcludesAll('SiteHeader.tsx 全部持仓入口移动端不可隐藏', siteHeader, [
  'hidden rounded-full border px-3 py-1.5 text-xs transition sm:inline-flex',
]);

for (const [label, source] of [
  ['ResolveCountdown.tsx', resolveCountdown],
  ['BaseMarketCard.tsx', baseMarketCard],
  ['CryptoMarketCard.tsx', cryptoMarketCard],
  ['MarketCard.tsx', marketCardShim],
  ['WorldCupMarketCard.tsx', worldCupMarketCard],
  ['WorldCupOutcomePanel.tsx', worldCupOutcomePanel],
  ['MarketDetailCard.tsx', marketDetailCard],
  ['EventInfoPanel.tsx', eventInfoPanel],
  ['ImpliedProbabilityChart.tsx', impliedProbabilityChart],
  ['SiteHeader.tsx', siteHeader],
]) {
  assertExcludesAll(label, source, ['rounded-2xl', 'rounded-xl', 'tracking-', 'letterSpacing']);
}

console.log('market components 检查通过');
