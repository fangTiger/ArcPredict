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

const resolveCountdown = readRequiredText('components/ResolveCountdown.tsx');
const marketCard = readRequiredText('components/MarketCard.tsx');
const marketDetailCard = readRequiredText('components/MarketDetailCard.tsx');

assertUseClient('ResolveCountdown.tsx', resolveCountdown);
assertUseClient('MarketCard.tsx', marketCard);
assertUseClient('MarketDetailCard.tsx', marketDetailCard);

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
]);

assert(
  !resolveCountdown.includes('row.market.betDeadline'),
  'ResolveCountdown.tsx active 分支不应再使用 betDeadline。',
);

assertIncludesAll('MarketCard.tsx', marketCard, [
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
  'Seed disclosure on market page',
  'Monthly · closing',
  'now < m.betDeadline',
  'bettingOpen',
  'onBet(row.id, true)',
  'onBet(row.id, false)',
  'm.yesPool + m.noPool',
  'Bet YES',
  'Bet NO',
  'betDeadline - now < 24n * 60n * 60n',
]);

assertExcludesAll('MarketCard.tsx', marketCard, [
  'ResolveCountdown',
  'bg-surface',
  '下注已关闭',
]);

assertIncludesAll('MarketDetailCard.tsx', marketDetailCard, [
  'DashboardRow',
  'ResolveCountdown',
  'yesPercent',
  'fmtUsdc',
  'OUTCOMES',
  'bg-surface',
  'm.question',
  '总池',
  'YES 比例',
  '下注已关闭',
  'Outcome:',
  'Bet YES',
  'Bet NO',
]);

assertExcludesAll('MarketDetailCard.tsx', marketDetailCard, [
  'Seed disclosure on market page',
  'parseCadenceTag',
  'PYTH_PRICE_ID_TO_ASSET',
  'bg-paper',
]);

for (const [label, source] of [
  ['ResolveCountdown.tsx', resolveCountdown],
  ['MarketCard.tsx', marketCard],
  ['MarketDetailCard.tsx', marketDetailCard],
]) {
  assertExcludesAll(label, source, ['rounded-2xl', 'rounded-xl', 'tracking-', 'letterSpacing']);
}

console.log('market components 检查通过');
