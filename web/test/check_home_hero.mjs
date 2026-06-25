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

const heroSource = readRequiredText('components/HomeHero.tsx');
const globalStyles = readRequiredText('app/globals.css');

assertIncludesAll('HomeHero.tsx', heroSource, [
  'MarketCategory',
  'Record<MarketCategory',
  'Browse live prediction markets',
  'Open markets',
  'Open interest',
  'Pending',
  'Arc Testnet',
  'Quick links',
  'Crypto',
  'World Cup',
  'Macro',
  'On-chain',
  'Record<MarketCategory',
]);

assertExcludesAll('HomeHero.tsx', heroSource, [
  'HeroParticleCanvas',
  'hero-arc-band',
  'hero-content',
  'hero-gradient-mask',
  'hero-title',
  'live-dot',
  'Predict the next tick',
  'Pick the next winner',
  'Trade the next macro surprise',
  'Track the next liquidity rotation',
]);

assertIncludesAll('globals.css', globalStyles, [
  '.glass {',
  '.glass-hover {',
  '@keyframes arc-ring-pulse',
]);

assertExcludesAll('globals.css', globalStyles, [
  '.hero-arc-band',
  '.hero-canvas',
  '.hero-gradient-mask',
  '.hero-content',
  '.hero-title',
  '.live-dot',
  '@keyframes live-pulse',
]);

console.log('home hero 检查通过');
