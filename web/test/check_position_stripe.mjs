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

const stripe = readRequiredText('components/PositionStripe.tsx');

assert.equal(
  firstEffectiveLine(stripe),
  "'use client';",
  "PositionStripe.tsx 第一条有效语句必须是 'use client';",
);

assertIncludesAll('PositionStripe.tsx', stripe, [
  "from '@/lib/position-items'",
  'filterPositionRows',
  'getActivePositionCount',
  'toPositionItems',
  '持仓 ·',
  '查看全部',
  'rounded-xl border border-hair bg-bg-1/55 backdrop-blur px-4 py-3',
  'max-h-[180px] overflow-y-auto',
  'truncate',
  'fmtUsdc',
  'return null;',
]);

assert(
  stripe.includes('href={allPositionsHref}') || stripe.includes('href={props.allPositionsHref}'),
  'PositionStripe.tsx 的“查看全部”链接必须复用 allPositionsHref。',
);

console.log('position stripe 检查通过');
