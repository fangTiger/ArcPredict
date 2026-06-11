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
  'text-heat',
  'text-ink-2',
]);

assert(
  !resolveCountdown.includes('row.market.betDeadline'),
  'ResolveCountdown.tsx active 分支不应再使用 betDeadline。',
);

assertIncludesAll('MarketCard.tsx', marketCard, [
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

assertExcludesAll('MarketCard.tsx 需移除 article 导航方案', marketCard, [
  "import { useRouter } from 'next/navigation';",
  'role="link"',
  'tabIndex={0}',
  'router.push(detailHref)',
]);

assertMatches(
  'MarketCard.tsx',
  marketCard,
  /const detailHref = `\/market\/\$\{row\.id\.toString\(\)\}`;/u,
  '必须声明详情地址 detailHref',
);

assertMatches(
  'MarketCard.tsx',
  marketCard,
  /<Link[\s\S]*?href=\{detailHref\}/u,
  '必须使用 Link href={detailHref} 提供详情导航',
);

const firstDetailLinkMatch = marketCard.match(/<Link[\s\S]*?href=\{detailHref\}[\s\S]*?<\/Link>/u);

assert(firstDetailLinkMatch, 'MarketCard.tsx 必须存在一个详情 Link 片段');
assertExcludesAll('MarketCard.tsx 主体 Link 不能包含按钮', firstDetailLinkMatch[0], [
  '<button',
  'Bet YES',
  'Bet NO',
]);

assertMatches(
  'MarketCard.tsx',
  marketCard,
  /<Link[\s\S]*?href=\{detailHref\}[\s\S]*?<\/Link>[\s\S]*?<div className="grid grid-cols-2 gap-2">/u,
  '主体 Link 必须在按钮区域之前结束',
);

assertMatches(
  'MarketCard.tsx',
  marketCard,
  /onClick=\{\(\) => onBet\(row\.id, true\)\}/u,
  'Bet YES 按钮必须保持直接下注行为',
);

assertMatches(
  'MarketCard.tsx',
  marketCard,
  /onClick=\{\(\) => onBet\(row\.id, false\)\}/u,
  'Bet NO 按钮必须保持直接下注行为',
);

assertMatches(
  'MarketCard.tsx',
  marketCard,
  />\s*(View details|查看详情)\s*</u,
  '必须提供明确的详情可见文案',
);

assertMatches(
  'MarketCard.tsx',
  marketCard,
  /<Link[\s\S]*?href=\{detailHref\}[\s\S]*?>[\s\S]*?(View details|查看详情)[\s\S]*?<\/Link>/u,
  '必须保留清晰的 View details 详情入口',
);

assertExcludesAll('MarketCard.tsx', marketCard, [
  'ResolveCountdown',
  'bg-surface',
  '下注已关闭',
  'Seed disclosure on market page',
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
  'bg-surface',
  'bg-white/5',
  'border-white/10',
]);

for (const [label, source] of [
  ['ResolveCountdown.tsx', resolveCountdown],
  ['MarketCard.tsx', marketCard],
  ['MarketDetailCard.tsx', marketDetailCard],
]) {
  assertExcludesAll(label, source, ['rounded-2xl', 'rounded-xl', 'tracking-', 'letterSpacing']);
}

console.log('market components 检查通过');
