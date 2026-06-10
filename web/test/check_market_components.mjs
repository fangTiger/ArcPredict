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

const resolveCountdown = readRequiredText('components/ResolveCountdown.tsx');
const marketCard = readRequiredText('components/MarketCard.tsx');

assertUseClient('ResolveCountdown.tsx', resolveCountdown);
assertUseClient('MarketCard.tsx', marketCard);

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
  'yesPercent',
  'OUTCOMES',
  'fmtUsdc',
  'ResolveCountdown',
  'isUnresolved ? (',
  'now < m.betDeadline',
  'bettingOpen',
  '下注已关闭',
  'bettingOpen ? (',
  'onBet(row.id, true)',
  'onBet(row.id, false)',
  'm.yesPool + m.noPool',
  'Bet YES',
  'Bet NO',
]);

for (const [label, source] of [
  ['ResolveCountdown.tsx', resolveCountdown],
  ['MarketCard.tsx', marketCard],
]) {
  assertExcludesAll(label, source, ['rounded-2xl', 'rounded-xl', 'tracking-', 'letterSpacing']);
}

console.log('market components 检查通过');
