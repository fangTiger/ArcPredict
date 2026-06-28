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
const marketFilterSource = readRequiredText('components/MarketFilterBar.tsx');
const worldCupCardSource = readRequiredText('components/WorldCupMarketCard.tsx');
const worldCupOutcomeSource = readRequiredText('components/WorldCupOutcomePanel.tsx');
const worldCupMarketsSource = readRequiredText('lib/worldcup-markets.ts');
const useMediaQuerySource = readRequiredText('lib/use-media-query.ts');

assertIncludesAll('page.tsx', pageSource, [
  'category',
  'stage',
  'WORLDCUP_ENABLED',
  'WorldCupMarketCard',
  'worldcup',
  'router.replace',
  'searchParams.get',
]);

assertIncludesAll('MarketFilterBar.tsx', marketFilterSource, [
  'Crypto',
  'World Cup',
  'Stage',
  'Group',
  'R16',
  'QF',
  'SF',
  'Final',
  'Winner',
]);

assertIncludesAll('WorldCupMarketCard.tsx', worldCupCardSource, [
  "import Link from 'next/link';",
  'flagIconUrlForTeam',
  'stageLabel',
  'kickoffLabel',
  '⚽',
  'WorldCupOutcomePanel',
  'onBet',
  'backgroundImage',
  '?kind=event',
  'View details',
]);

assertIncludesAll('WorldCupOutcomePanel.tsx', worldCupOutcomeSource, [
  'onSelectOutcome',
  'Home Win',
  'Other outcomes',
  'Show top 8',
  'Show all',
  'Collapse',
  'Bet',
  'implied',
  'isMobile',
  'overflow-y-auto',
  'max-h-',
]);

assertIncludesAll('worldcup-markets.ts', worldCupMarketsSource, [
  'WORLDCUP_SKELETON_MARKETS',
  'winner',
  'spread',
  "'worldcup'",
  "marketKind: 'event'",
  'matchId',
  'eventId',
  'question',
  'MATCH_BY_ID',
  'skeletonOutcomes',
  'buildTemplateOutcomes',
  'userOutcomeStakes',
]);

assertMatches(
  'worldcup-markets.ts',
  worldCupMarketsSource,
  /createOutcome\([\s\S]*impliedProbability/u,
  'skeleton 数据必须通过 createOutcome 生成 impliedProbability。',
);

assertExcludesAll('worldcup-markets.ts', worldCupMarketsSource, [
  'WORLDCUP_SKELETON_MARKETS[index]',
  'kickoffTime: new Date(Number(row.market.resolveAfter) * 1000).toISOString()',
]);

assertIncludesAll('use-media-query.ts', useMediaQuerySource, [
  'window.matchMedia',
  'addEventListener',
  'removeEventListener',
  'matches',
]);

console.log('worldcup ui 检查通过');
