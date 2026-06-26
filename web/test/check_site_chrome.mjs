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
const walletPill = readRequiredText('components/WalletPill.tsx');

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
  'arc-ring-pulse',
  'sticky top-0 z-50',
  'border-b border-hair',
  'px-5 sm:px-8',
  'hidden sm:inline',
  'hidden md:inline',
  'shrink-0',
  'px-2 sm:px-3',
  'All Positions',
  'Positions',
]);

assertIncludesAll('WalletPill.tsx', walletPill, [
  'Connect Wallet',
  'Switch to Arc',
]);

for (const [label, source] of [
  ['SiteHeader.tsx', siteHeader],
  ['WalletPill.tsx', walletPill],
]) {
  for (const token of ['全部持仓', '持仓', '连接钱包', '切换到 Arc']) {
    assert(!source.includes(token), `${label} 不应再显示中文顶部文案: ${token}`);
  }
}

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
  'arc-stroke-tr',
  'arc-stroke-bl',
  'variant',
  'pitch',
  'data-arc-background-variant',
  'rgba(155,163,199,0.04)',
]);

console.log('site chrome 检查通过');
