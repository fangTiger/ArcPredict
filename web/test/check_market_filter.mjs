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
const marketFilterSource = readFileSync(marketFilterPath, 'utf8');
const { filterMarkets } = loadTsModule(marketFilterPath);

const priceIdToAsset = {
  '0xbtc': 'BTC',
  '0xeth': 'ETH',
  '0xsol': 'SOL',
};

const cryptoMarkets = [
  { id: 1, pythPriceId: '0xBTC', question: 'BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [weekly]' },
  { id: 2, pythPriceId: '0xeth', question: 'ETH/USD ≥ 3500 @ 2026-06-17 12:00 UTC [monthly]' },
  { id: 3, pythPriceId: '0xSOL', question: 'SOL/USD ≥ 150 @ 2026-06-17 12:00 UTC [daily]' },
  { id: 4, pythPriceId: '0xBTC', question: 'BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC' },
  { id: 5, pythPriceId: '0xDOGE', question: 'DOGE/USD ≥ 0.25 @ 2026-06-17 12:00 UTC [weekly]' },
];

const worldCupMarkets = [
  { id: 101, category: 'worldcup', stage: 'group', question: 'Argentina vs Mexico 1X2' },
  { id: 102, category: 'worldcup', stage: 'group', question: 'England -1.5 vs Wales' },
  { id: 103, category: 'worldcup', stage: 'r16', question: 'Netherlands vs United States 1X2' },
  { id: 104, category: 'worldcup', stage: 'winner', question: 'World Cup Winner' },
];

const idsOfCrypto = (asset, cadence) =>
  filterMarkets(cryptoMarkets, { asset, cadence, priceIdToAsset }).map((market) => market.id);

const idsOfWorldCup = (stage) =>
  filterMarkets(worldCupMarkets, {
    category: 'worldcup',
    stage,
    asset: 'all',
    cadence: 'all',
    priceIdToAsset,
  }).map((market) => market.id);

assert.deepEqual(idsOfCrypto('all', 'all'), [1, 2, 3, 4, 5], 'asset=all cadence=all 必须返回全部 Crypto 市场。');
assert.deepEqual(idsOfCrypto('BTC', 'all'), [1, 4], 'asset=BTC cadence=all 必须返回全部 BTC 市场，且包含无 cadence tag 的旧市场。');
assert.deepEqual(idsOfCrypto('all', 'weekly'), [1, 5], 'cadence=weekly 必须仅返回 weekly 市场，且排除无 cadence tag 的旧市场。');
assert.deepEqual(idsOfCrypto('BTC', 'weekly'), [1], 'asset=BTC cadence=weekly 必须只返回 BTC weekly 市场。');
assert.deepEqual(idsOfCrypto('all', 'monthly'), [2], 'cadence=monthly 必须只返回 ETH monthly 市场。');
assert.deepEqual(idsOfCrypto('SOL', 'weekly'), [], 'asset=SOL cadence=weekly 必须返回空数组。');
assert(
  idsOfCrypto('all', 'all').includes(5),
  '未知 priceId 在 asset=all 下不能被过滤掉。',
);
assert(
  !idsOfCrypto('BTC', 'all').includes(5),
  '未知 priceId 在指定 asset 下不应出现。',
);
assert.deepEqual(idsOfCrypto('SOL', 'daily'), [3], 'asset 过滤必须兼容大写 priceId 与 lowercase 映射。');
assert.deepEqual(idsOfWorldCup('all'), [101, 102, 103], 'World Cup All 必须只返回具体比赛，冠军盘放在 Winner tab。');
assert.deepEqual(idsOfWorldCup('group'), [101, 102], 'Stage=group 必须只返回小组赛。');
assert.deepEqual(idsOfWorldCup('r16'), [103], 'Stage=r16 必须只返回十六强。');
assert.deepEqual(idsOfWorldCup('winner'), [104], 'Stage=winner 必须只返回冠军盘。');
assert.deepEqual(idsOfWorldCup('final'), [], '缺少对应阶段时必须返回空数组。');

for (const token of [
  'Browse',
  'Trending',
  'Ending Soon',
  'showCategoryTabs',
  'onCategoryChange',
  'onStageChange',
  'World Cup',
  'Crypto',
  'Stage',
  'R16',
  'Winner',
  'rounded-xl border border-hair bg-bg-1 px-3 py-3',
  'border-ink/15 bg-bg-0 text-ink',
]) {
  assert(marketFilterSource.includes(token), `MarketFilterBar.tsx 缺少新市场浏览样式: ${token}`);
}

for (const token of [
  'border-y border-hair',
  'my-10',
  'w-px h-6 bg-hair',
  'hover:border-arc-glow/30',
  'bg-arc/15 text-arc-glow',
  'shadow-[0_0_24px_-8px_rgba(77,168,255,0.6)]',
]) {
  assert(!marketFilterSource.includes(token), `MarketFilterBar.tsx 不应保留旧霓虹筛选样式: ${token}`);
}

console.log('market filter 检查通过');
