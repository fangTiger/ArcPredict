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

const NOW = 1_760_000_000;
const WEEK = 7 * 24 * 3600;

const makeMarket = ({
  outcome = 0,
  betDeadline = NOW + WEEK + 1,
  resolveAfter = NOW + WEEK + 1,
  yesPool = 0n,
  noPool = 0n,
} = {}) => ({
  outcome,
  betDeadline: BigInt(betDeadline),
  resolveAfter: BigInt(resolveAfter),
  yesPool: BigInt(yesPool),
  noPool: BigInt(noPool),
});

const activityBadgesPath = resolve(webRoot, 'components/ActivityBadges.tsx');
const { computeBadges } = loadTsModule(activityBadgesPath);

assert.equal(typeof computeBadges, 'function', 'ActivityBadges.tsx 必须导出 computeBadges 纯函数。');

const mixedMarkets = [
  makeMarket({
    betDeadline: NOW + 3_600,
    resolveAfter: NOW,
    yesPool: 5_000_000n,
    noPool: 1_000_000n,
  }),
  makeMarket({
    betDeadline: NOW + 7_200,
    resolveAfter: NOW + WEEK,
    yesPool: 2_000_000n,
    noPool: 3_000_000n,
  }),
  makeMarket({
    betDeadline: NOW + 180,
    resolveAfter: NOW + WEEK + 1,
    yesPool: 4_000_000n,
    noPool: 0n,
  }),
  makeMarket({
    outcome: 1,
    betDeadline: NOW + 5_400,
    resolveAfter: NOW + WEEK + 10,
    yesPool: 7_000_000n,
    noPool: 8_000_000n,
  }),
  makeMarket({
    outcome: 2,
    betDeadline: NOW - 1,
    resolveAfter: NOW - 10,
    yesPool: 1_000_000n,
    noPool: 4_000_000n,
  }),
];

assert.deepEqual(
  computeBadges(mixedMarkets, NOW),
  {
    activeCount: 3,
    resolvingThisWeek: 2,
    tvlUsdc6: 35_000_000n,
  },
  'computeBadges 必须按 spec §7.4 统计 3 个 active、2 个 resolving this week，并累计 35 USDC TVL。',
);

assert.equal(
  computeBadges(
    [
      makeMarket({ betDeadline: NOW + 1, resolveAfter: NOW }),
      makeMarket({ betDeadline: NOW + 1, resolveAfter: NOW + WEEK }),
      makeMarket({ betDeadline: NOW + 1, resolveAfter: NOW + WEEK + 1 }),
    ],
    NOW,
  ).resolvingThisWeek,
  2,
  'resolveAfter 位于 now 与 now+7d 两端时都必须计入 resolving this week。',
);

assert.deepEqual(
  computeBadges(
    [
      makeMarket({
        outcome: 1,
        betDeadline: NOW + 9_999,
        resolveAfter: NOW + WEEK + 99,
        yesPool: 11_000_000n,
        noPool: 9_000_000n,
      }),
    ],
    NOW,
  ),
  {
    activeCount: 0,
    resolvingThisWeek: 0,
    tvlUsdc6: 20_000_000n,
  },
  'outcome 非 0 的市场不能计入 active，但它的 yesPool + noPool 仍必须计入 TVL。',
);

console.log('activity badges 检查通过');
