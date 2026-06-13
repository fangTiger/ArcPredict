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

const layout = readRequiredText('app/layout.tsx');
const siteHeader = readRequiredText('components/SiteHeader.tsx');
const siteFooter = readRequiredText('components/SiteFooter.tsx');
const arcBackground = readRequiredText('components/ArcBackground.tsx');

assertIncludesAll('layout.tsx', layout, [
  'ArcBackground',
  '<ArcBackground />',
  '<Providers>{children}</Providers>',
]);

assertIncludesAll('SiteHeader.tsx', siteHeader, [
  'WalletPill',
  'ArcPredict',
  'Arc Testnet',
  '5042002',
  '@keyframes pulse',
  'sticky top-0 z-50',
  'border-b border-hair',
  'px-5 sm:px-8',
  'hidden sm:inline',
  'hidden md:inline',
  'shrink-0',
  'px-2 sm:px-3',
]);

assertIncludesAll('SiteFooter.tsx', siteFooter, [
  'Built on Arc Testnet',
  'Settled by Pyth Network',
  'USDC parimutuel',
  'Arcscan',
  'Contract',
  'Faucet',
]);

assertIncludesAll('ArcBackground.tsx', arcBackground, [
  'pointer-events-none',
  'fixed inset-0',
  'viewBox="0 0 900 900"',
  'viewBox="0 0 700 700"',
  'stroke="#1652F0"',
  'variant',
  'pitch',
  'data-arc-background-variant',
  '#3D8B5B',
]);

console.log('site chrome 检查通过');
