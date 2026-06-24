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
const canvasSource = readRequiredText('components/HeroParticleCanvas.tsx');
const globalStyles = readRequiredText('app/globals.css');

assertIncludesAll('HomeHero.tsx', heroSource, [
  'MarketCategory',
  'hero-arc-band',
  'hero-content',
  'hero-gradient-mask',
  'HeroParticleCanvas',
  'Predict the next tick',
  'Pick the next winner',
  'Trade the next macro surprise',
  'Track the next liquidity rotation',
  'Crypto board',
  'World Cup board',
  'Macro board',
  'On-chain board',
  'live-dot',
  'Record<MarketCategory',
]);

assertExcludesAll('HomeHero.tsx copy 不能只做 worldcup/crypto 二分', heroSource, [
  "const isWorldCup = category === 'worldcup';\n  const copy = isWorldCup",
]);

assertExcludesAll('HomeHero.tsx', heroSource, [
  'market-context-band',
  'market-context-ribbon',
  'market-context-visual',
  'market-context-photo',
  'market-context-signal-line',
]);

assertIncludesAll('HeroParticleCanvas.tsx', canvasSource, [
  "'use client'",
  'requestAnimationFrame',
  'devicePixelRatio',
  'prefers-reduced-motion',
  'IntersectionObserver',
  'ResizeObserver',
  'quadraticCurveTo',
]);

assertIncludesAll('globals.css', globalStyles, [
  '.hero-arc-band',
  '.hero-canvas',
  '.hero-gradient-mask',
  '.hero-content',
  '.hero-title',
  '.live-dot',
  '@keyframes live-pulse',
]);

assertExcludesAll('globals.css', globalStyles, [
  '.market-context-band',
  '.market-context-ribbon',
  '.market-context-visual',
  '.market-context-photo',
  '.market-context-signal-line',
  '@keyframes context-line-pan',
  '@keyframes context-signal-pulse',
]);

console.log('home hero 检查通过');
