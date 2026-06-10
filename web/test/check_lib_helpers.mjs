import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Module from 'node:module';
import ts from 'typescript';

const repoRoot = process.cwd();
const webRoot = resolve(repoRoot, 'web');
const moduleCache = new Map();
const nodeRequire = Module.createRequire(import.meta.url);

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

const chainPath = resolve(webRoot, 'lib/chain.ts');
const formatPath = resolve(webRoot, 'lib/format.ts');

const chain = loadTsModule(chainPath);
const format = loadTsModule(formatPath);

assert.equal(chain.USDC_DECIMALS, 6);
assert.equal(chain.NATIVE_VALUE_DECIMALS, 18);
assert.equal(chain.arcTestnet.id, 5042002);
assert.equal(chain.arcTestnet.name, 'Arc Testnet');
assert.equal(chain.arcTestnet.nativeCurrency.symbol, 'USDC');
assert.equal(chain.arcTestnet.rpcUrls.default.http[0], 'https://rpc.testnet.arc.network');
assert.equal(
  chain.arcTestnet.contracts.multicall3.address,
  '0xcA11bde05977b3631167028862bE2a173976CA11',
);
assert.equal(chain.arcTestnet.testnet, true);

assert.equal(format.fmtUsdc(1234567n), '1.23');
assert.equal(format.fmtUsdc(1000000n), '1');
assert.equal(format.parseUsdc('1.5'), 1500000n);
assert.equal(
  format.truncateAddr('0x1234567890abcdef1234567890abcdef12345678'),
  '0x1234…5678',
);
assert.equal(format.fmtCountdown(90000n, 0n), '1d 1h');
assert.equal(format.fmtCountdown(3660n, 0n), '1h 1m');
assert.equal(format.fmtCountdown(60n, 0n), '1m');
assert.equal(format.fmtCountdown(0n, 0n), 'Closed');

console.log('lib helpers 检查通过');
