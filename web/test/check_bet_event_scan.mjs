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
  const directPath = specifier.startsWith('@/')
    ? resolve(webRoot, specifier.slice(2))
    : resolve(parentDir, specifier);
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

const betEventScanPath = resolve(webRoot, 'lib/bet-event-scan.ts');
const { LOG_SCAN_BLOCK_STEP, fetchLogsPaged } = loadTsModule(betEventScanPath);

assert.equal(LOG_SCAN_BLOCK_STEP, 10_000n, 'LOG_SCAN_BLOCK_STEP 必须固定为 10_000n。');
assert.equal(typeof fetchLogsPaged, 'function', 'bet-event-scan.ts 必须导出 fetchLogsPaged 函数。');

const event = { type: 'event Bet(uint256 indexed id)' };
const address = '0x00000000000000000000000000000000000000aa';

{
  const getLogsCalls = [];
  const client = {
    async getLogs(params) {
      getLogsCalls.push(params);
      return [`${params.fromBlock}-${params.toBlock}`];
    },
  };

  const logs = await fetchLogsPaged(client, {
    address,
    event,
    args: { id: 7n },
    fromBlock: 100n,
    toBlock: 20_250n,
  });

  assert.deepEqual(
    getLogsCalls.map(({ fromBlock, toBlock }) => [fromBlock, toBlock]),
    [
      [100n, 10_099n],
      [10_100n, 20_099n],
      [20_100n, 20_250n],
    ],
    '必须按 10,000 block 分页扫描，并覆盖尾段。',
  );
  assert.deepEqual(
    logs,
    ['100-10099', '10100-20099', '20100-20250'],
    '必须把每一页的日志结果按顺序聚合返回。',
  );
}

{
  let getBlockNumberCalls = 0;
  const getLogsCalls = [];
  const client = {
    async getBlockNumber() {
      getBlockNumberCalls += 1;
      return 23_456n;
    },
    async getLogs(params) {
      getLogsCalls.push(params);
      return [];
    },
  };

  await fetchLogsPaged(client, {
    address,
    event,
    args: { id: 8n },
    fromBlock: 20_000n,
    toBlock: 'latest',
  });

  assert.equal(getBlockNumberCalls, 1, "toBlock='latest' 时必须先调用 getBlockNumber。");
  assert.deepEqual(
    getLogsCalls.map(({ toBlock }) => typeof toBlock),
    ['bigint'],
    "传给 getLogs 的 toBlock 必须是 bigint，不能保留 'latest'。",
  );
  assert.deepEqual(
    getLogsCalls.map(({ fromBlock, toBlock }) => [fromBlock, toBlock]),
    [[20_000n, 23_456n]],
    'latest 解析后应按解析出的最新区块分页扫描。',
  );
}

{
  let getLogsCalls = 0;
  const client = {
    async getLogs() {
      getLogsCalls += 1;
      return ['unexpected'];
    },
  };

  const logs = await fetchLogsPaged(client, {
    address,
    event,
    args: { id: 9n },
    fromBlock: 30n,
    toBlock: 20n,
  });

  assert.deepEqual(logs, [], 'fromBlock 大于 toBlock 时必须直接返回空数组。');
  assert.equal(getLogsCalls, 0, 'fromBlock 大于 toBlock 时不应调用 getLogs。');
}

console.log('bet event scan 检查通过');
