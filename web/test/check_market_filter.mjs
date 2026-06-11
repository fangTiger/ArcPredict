import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';
import ts from 'typescript';

const testDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(testDir, '..');
const repoRoot = resolve(webRoot, '..');
const moduleCache = new Map();
const nodeRequire = Module.createRequire(import.meta.url);

const resolveTsSpecifier = (specifier, parentDir) => {
  const directPath = specifier.startsWith('@/') ? resolve(webRoot, specifier.slice(2)) : resolve(parentDir, specifier);
  const candidates = [
    directPath,
    `${directPath}.ts`,
    `${directPath}.tsx`,
    `${directPath}.js`,
    `${directPath}.jsx`,
    resolve(directPath, 'index.ts'),
    resolve(directPath, 'index.tsx'),
    resolve(directPath, 'index.js'),
    resolve(directPath, 'index.jsx'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

const loadTsModule = (modulePath) => {
  if (moduleCache.has(modulePath)) {
    return moduleCache.get(modulePath);
  }

  if (!existsSync(modulePath)) {
    throw new Error(`缺少文件: ${modulePath}`);
  }

  const source = readFileSync(modulePath, 'utf8');
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.Node10,
    },
    fileName: modulePath,
    reportDiagnostics: true,
  });

  if (diagnostics?.length) {
    const message = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => repoRoot,
      getCanonicalFileName: (fileName) => fileName,
      getNewLine: () => '\n',
    });
    throw new Error(`TypeScript 转译失败:\n${message}`);
  }

  const module = { exports: {} };
  moduleCache.set(modulePath, module.exports);

  const localRequire = (specifier) => {
    if (specifier.startsWith('.') || specifier.startsWith('@/')) {
      const resolved = resolveTsSpecifier(specifier, dirname(modulePath));
      if (!resolved) {
        throw new Error(`无法解析本地依赖: ${specifier} from ${modulePath}`);
      }
      return loadTsModule(resolved);
    }

    return nodeRequire(specifier);
  };

  const wrapper = new Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    outputText,
  );

  wrapper(module.exports, localRequire, module, modulePath, dirname(modulePath));
  return module.exports;
};

const marketFilterPath = resolve(webRoot, 'components/MarketFilterBar.tsx');
const { filterMarkets } = loadTsModule(marketFilterPath);

const priceIdToAsset = {
  '0xBTC': 'BTC',
  '0xETH': 'ETH',
  '0xSOL': 'SOL',
};

const markets = [
  { id: 1, pythPriceId: '0xBTC', question: 'BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [weekly]' },
  { id: 2, pythPriceId: '0xETH', question: 'ETH/USD ≥ 3500 @ 2026-06-17 12:00 UTC [monthly]' },
  { id: 3, pythPriceId: '0xSOL', question: 'SOL/USD ≥ 150 @ 2026-06-17 12:00 UTC [daily]' },
  { id: 4, pythPriceId: '0xBTC', question: 'BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC' },
  { id: 5, pythPriceId: '0xDOGE', question: 'DOGE/USD ≥ 0.25 @ 2026-06-17 12:00 UTC [weekly]' },
];

const idsOf = (asset, cadence) =>
  filterMarkets(markets, { asset, cadence, priceIdToAsset }).map((market) => market.id);

assert.deepEqual(idsOf('all', 'all'), [1, 2, 3, 4, 5], 'asset=all cadence=all 必须返回全部市场。');
assert.deepEqual(idsOf('BTC', 'all'), [1, 4], 'asset=BTC cadence=all 必须返回全部 BTC 市场，且包含无 cadence tag 的旧市场。');
assert.deepEqual(idsOf('all', 'weekly'), [1, 5], 'cadence=weekly 必须仅返回 weekly 市场，且排除无 cadence tag 的旧市场。');
assert.deepEqual(idsOf('BTC', 'weekly'), [1], 'asset=BTC cadence=weekly 必须只返回 BTC weekly 市场。');
assert.deepEqual(idsOf('all', 'monthly'), [2], 'cadence=monthly 必须只返回 ETH monthly 市场。');
assert.deepEqual(idsOf('SOL', 'weekly'), [], 'asset=SOL cadence=weekly 必须返回空数组。');
assert(
  idsOf('all', 'all').includes(5),
  '未知 priceId 在 asset=all 下不能被过滤掉。',
);
assert(
  !idsOf('BTC', 'all').includes(5),
  '未知 priceId 在指定 asset 下不应出现。',
);

console.log('market filter 检查通过');
