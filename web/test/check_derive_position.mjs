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

const derivePositionPath = resolve(webRoot, 'lib/derivePosition.ts');
const derivePosition = loadTsModule(derivePositionPath);

const baseMarket = {
  pythPriceId: '0x1234',
  threshold: 1000n,
  thresholdExpo: -8,
  betDeadline: 100n,
  resolveAfter: 200n,
  yesPool: 0n,
  noPool: 0n,
  winnerPool: 0n,
  protocolFee: 0n,
  feeBpsSnapshot: 100,
  feeRecipientSnapshot: '0x0000000000000000000000000000000000000001',
  outcome: 0,
  settlePrice: 0n,
  settleTime: 0n,
  question: 'Will Arc close above threshold?',
};

const makeMarket = (overrides = {}) => ({
  ...baseMarket,
  ...overrides,
});

const makeRow = (overrides = {}) => ({
  id: 1n,
  market: makeMarket(),
  yesStake: 0n,
  noStake: 0n,
  claimed_: false,
  pendingPayout: 0n,
  ...overrides,
});

assert.deepEqual(derivePosition.OUTCOMES, ['Unresolved', 'Yes', 'No', 'Invalid']);

assert.equal(derivePosition.deriveStatus(makeRow(), 199n), 'active');
assert.equal(derivePosition.deriveStatus(makeRow(), 200n), 'resolving');
assert.equal(derivePosition.deriveStatus(makeRow(), 500n), 'awaiting');
assert.equal(derivePosition.deriveStatus(makeRow(), 200n + 7n * 24n * 3600n), 'force-invalidatable');
assert.equal(
  derivePosition.deriveStatus(makeRow({ market: makeMarket({ outcome: 1 }) }), 0n),
  'resolved',
);
assert.equal(
  derivePosition.deriveStatus(makeRow({ market: makeMarket({ outcome: 2 }) }), 0n),
  'resolved',
);
assert.equal(
  derivePosition.deriveStatus(makeRow({ market: makeMarket({ outcome: 3 }) }), 0n),
  'resolved',
);

assert.equal(derivePosition.userPositionOf(makeRow()), 'none');
assert.equal(derivePosition.userPositionOf(makeRow({ yesStake: 1n })), 'yes');
assert.equal(derivePosition.userPositionOf(makeRow({ noStake: 1n })), 'no');
assert.equal(derivePosition.userPositionOf(makeRow({ yesStake: 1n, noStake: 1n })), 'both');

assert.equal(derivePosition.userIsWinner(makeRow()), false);
assert.equal(
  derivePosition.userIsWinner(makeRow({ market: makeMarket({ outcome: 3 }), yesStake: 1n })),
  true,
);
assert.equal(
  derivePosition.userIsWinner(makeRow({ market: makeMarket({ outcome: 3 }), noStake: 1n })),
  true,
);
assert.equal(
  derivePosition.userIsWinner(
    makeRow({ market: makeMarket({ outcome: 1 }), yesStake: 1n, noStake: 1n }),
  ),
  true,
);
assert.equal(
  derivePosition.userIsWinner(makeRow({ market: makeMarket({ outcome: 1 }), noStake: 1n })),
  false,
);
assert.equal(
  derivePosition.userIsWinner(
    makeRow({ market: makeMarket({ outcome: 2 }), yesStake: 1n, noStake: 1n }),
  ),
  true,
);
assert.equal(
  derivePosition.userIsWinner(makeRow({ market: makeMarket({ outcome: 2 }), yesStake: 1n })),
  false,
);

assert.equal(derivePosition.yesPercent(makeMarket()), 50);
assert.equal(derivePosition.yesPercent(makeMarket({ yesPool: 5n, noPool: 5n })), 50);
assert.equal(derivePosition.yesPercent(makeMarket({ yesPool: 1n, noPool: 3n })), 25);
assert.equal(derivePosition.yesPercent(makeMarket({ yesPool: 2n, noPool: 1n })), 66.66);

console.log('derivePosition 检查通过');
