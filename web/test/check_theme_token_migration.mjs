import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const cwd = process.cwd();
const webRoot = existsSync(resolve(cwd, 'app')) ? cwd : resolve(cwd, 'web');
const scanRoots = ['app', 'components'];
const forbiddenPatterns = [
  {
    label: '旧主题 token',
    test: /\b(?:bg|border)-(?:base|surface|elevated|accent|warning)(?:\/[0-9[\].]+)?\b|\btext-(?:surface|elevated|accent|warning)(?:\/[0-9[\].]+)?\b/gu,
  },
  {
    label: '旧暗色边框',
    test: /\b(?:border-white\/10|hover:border-white\/20|divide-white\/10)\b/gu,
  },
  {
    label: '旧暗色底色',
    test: /\b(?:bg-white\/5|hover:bg-white\/10)\b/gu,
  },
  {
    label: '旧暗色文字',
    test: /\b(?:text-white|text-zinc-(?:300|400|500|950))\b/gu,
  },
];

function listTsxFiles(dir) {
  const entries = readdirSync(dir).sort();
  const files = [];

  for (const entry of entries) {
    const fullPath = resolve(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listTsxFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
}

const violations = [];

for (const root of scanRoots) {
  const rootPath = resolve(webRoot, root);

  for (const filePath of listTsxFiles(rootPath)) {
    const source = readFileSync(filePath, 'utf8');
    const matches = [];

    for (const { label, test } of forbiddenPatterns) {
      test.lastIndex = 0;
      for (const match of source.matchAll(test)) {
        matches.push(`${label}: ${match[0]}`);
      }
    }

    if (matches.length > 0) {
      violations.push(`${relative(webRoot, filePath)} -> ${matches.join(', ')}`);
    }
  }
}

assert.equal(
  violations.length,
  0,
  `仍存在旧 Tailwind 颜色类残留:\n${violations.join('\n')}`,
);

console.log('旧颜色类迁移检查通过');
