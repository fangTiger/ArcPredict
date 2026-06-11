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

const seedDisclosurePath = resolve(webRoot, 'components/SeedDisclosure.tsx');
const { sumSeedContribution } = loadTsModule(seedDisclosurePath);

assert.equal(
  typeof sumSeedContribution,
  'function',
  'SeedDisclosure.tsx 必须导出 sumSeedContribution 纯函数。',
);

const seeds = ['0xaaa', '0xbbb'];
const events = [
  { user: '0xaaa', amount: 3_000_000n },
  { user: '0xbbb', amount: 5_000_000n },
  { user: '0xfff', amount: 100_000_000n },
  { user: '0xAAA', amount: 2_000_000n },
];

assert.equal(
  sumSeedContribution(events, seeds),
  10_000_000n,
  'seed 地址累计金额必须大小写不敏感，并忽略非 seed 事件。',
);

assert.equal(
  sumSeedContribution([], seeds),
  0n,
  'events 为空时必须返回 0。',
);

assert.equal(
  sumSeedContribution(events, []),
  0n,
  'seeds 为空时必须返回 0。',
);

assert.equal(
  sumSeedContribution(
    [
      { user: '0xfff', amount: 7_000_000n },
      { user: '0xccc', amount: 9_000_000n },
      { user: '0xBBB0', amount: 1_000_000n },
    ],
    seeds,
  ),
  0n,
  '全部为非 seed 地址时必须返回 0。',
);

console.log('seed disclosure 检查通过');
