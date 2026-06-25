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

const globalsCss = readRequiredText('app/globals.css');
const tailwindConfig = readRequiredText('tailwind.config.ts');

assertIncludesAll('globals.css', globalsCss, [
  '--bg-0: #f5f7fb;',
  '--bg-1: #ffffff;',
  '--bg-2: #eef2f6;',
  '--ink: #101828;',
  '--ink-2: #475467;',
  '--ink-3: #667085;',
  'background: linear-gradient(180deg, #f5f7fb 0%, #eef2f6 100%);',
  'background: rgba(255, 255, 255, 0.92);',
  'backdrop-filter: none;',
  'border: 1px solid rgba(15, 23, 42, 0.08);',
]);

assertExcludesAll('globals.css', globalsCss, [
  '--bg-0: #050614;',
  '--bg-1: #0A0B1E;',
  '--bg-2: #12142B;',
  '--ink: #F0F2FF;',
  '.hero-arc-band',
  '.hero-title',
  'radial-gradient(120% 80% at 78% 30%',
  'text-shadow: 0 0 24px rgba(77, 168, 255, 0.25);',
]);

assertIncludesAll('tailwind.config.ts', tailwindConfig, [
  "'bg-0': '#f5f7fb'",
  "'bg-1': '#ffffff'",
  "'bg-2': '#eef2f6'",
  "ink: '#101828'",
  "'ink-2': '#475467'",
  "'ink-3': '#667085'",
  "arc: '#1652F0'",
  "yes: '#15803D'",
  "no: '#B42318'",
  "hair: 'rgba(15,23,42,0.10)'",
]);

assertExcludesAll('tailwind.config.ts', tailwindConfig, [
  "'bg-0': '#050614'",
  "'bg-1': '#0A0B1E'",
  "'bg-2': '#12142B'",
  "ink: '#F0F2FF'",
  "'ink-2': '#9BA3C7'",
  "'ink-3': '#5B6188'",
  "'arc-glow': '#4DA8FF'",
  "violet: '#6D5BFF'",
]);

console.log('market interface style 检查通过');
