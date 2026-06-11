import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Module from 'node:module';
import ts from 'typescript';

const cwd = process.cwd();
const repoRoot = cwd.endsWith('/web') ? resolve(cwd, '..') : cwd;
const webRoot = cwd.endsWith('/web') ? cwd : resolve(repoRoot, 'web');
const moduleCache = new Map();
const nodeRequire = Module.createRequire(import.meta.url);

const hermesState = {
  constructorArgs: [],
  latestCalls: [],
  timestampCalls: [],
};

class MockHermesClient {
  constructor(endpoint) {
    hermesState.constructorArgs.push(endpoint);
  }

  async getLatestPriceUpdates(ids, options) {
    hermesState.latestCalls.push({ ids, options });
    return {
      binary: {
        encoding: 'hex',
        data: ['aa', 'bb'],
      },
    };
  }

  async getPriceUpdatesAtTimestamp(publishTime, ids, options) {
    hermesState.timestampCalls.push({ publishTime, ids, options });
    return {
      binary: {
        encoding: 'hex',
        data: ['cc', 'dd'],
      },
    };
  }
}

const resolveTsSpecifier = (specifier, parentDir) => {
  const directPath = resolve(parentDir, specifier);
  const candidates = [
    directPath,
    `${directPath}.ts`,
    `${directPath}.tsx`,
    resolve(directPath, 'index.ts'),
    resolve(directPath, 'index.tsx'),
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
    if (specifier === '@pythnetwork/hermes-client') {
      return { HermesClient: MockHermesClient };
    }

    if (specifier.startsWith('.')) {
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

delete process.env.NEXT_PUBLIC_PYTH_HERMES_ENDPOINT;

const pythPath = resolve(webRoot, 'lib/pyth.ts');
const pyth = loadTsModule(pythPath);

const priceId = '0xabc123';

assert.equal(hermesState.constructorArgs.length, 1);
assert.equal(hermesState.constructorArgs[0], 'https://hermes.pyth.network');

const latestResult = await pyth.getLatestPriceUpdate(priceId);
assert.deepEqual(hermesState.latestCalls, [
  {
    ids: [priceId],
    options: {
      encoding: 'hex',
      parsed: false,
    },
  },
]);
assert.deepEqual(latestResult, ['0xaa', '0xbb']);

const atTimeResult = await pyth.getPriceUpdateAtTime(priceId, 123);
assert.deepEqual(hermesState.timestampCalls, [
  {
    publishTime: 123,
    ids: [priceId],
    options: {
      encoding: 'hex',
      parsed: false,
    },
  },
]);
assert.deepEqual(atTimeResult, ['0xcc', '0xdd']);

console.log('pyth helper 检查通过');
