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

const cadenceTagPath = resolve(webRoot, 'lib/cadence-tag.ts');
const phase16FlagPath = resolve(webRoot, 'lib/phase16-flag.ts');

const { parseCadenceTag } = loadTsModule(cadenceTagPath);
const { isPhase16Enabled } = loadTsModule(phase16FlagPath);

const cadenceCases = [
  ['BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [daily]', 'daily'],
  ['BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [weekly]', 'weekly'],
  ['BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [monthly]', 'monthly'],
  ['BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [quarterly]', 'quarterly'],
  ['BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [weeky]', 'unknown'],
  ['BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC', 'unknown'],
  ['BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [weekly] extra', 'unknown'],
];

for (const [input, expected] of cadenceCases) {
  assert.equal(parseCadenceTag(input), expected, `parseCadenceTag(${input}) 应返回 ${expected}`);
}

const originalPhase16Enabled = process.env.NEXT_PUBLIC_PHASE16_ENABLED;

try {
  process.env.NEXT_PUBLIC_PHASE16_ENABLED = 'true';
  assert.equal(isPhase16Enabled(), true, 'NEXT_PUBLIC_PHASE16_ENABLED 为 true 时必须启用');

  process.env.NEXT_PUBLIC_PHASE16_ENABLED = 'false';
  assert.equal(isPhase16Enabled(), false, 'NEXT_PUBLIC_PHASE16_ENABLED 为 false 时不能启用');

  process.env.NEXT_PUBLIC_PHASE16_ENABLED = 'TRUE';
  assert.equal(isPhase16Enabled(), false, 'NEXT_PUBLIC_PHASE16_ENABLED 大小写不匹配时不能启用');

  delete process.env.NEXT_PUBLIC_PHASE16_ENABLED;
  assert.equal(isPhase16Enabled(), false, 'NEXT_PUBLIC_PHASE16_ENABLED 未设置时不能启用');
} finally {
  if (originalPhase16Enabled === undefined) {
    delete process.env.NEXT_PUBLIC_PHASE16_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_PHASE16_ENABLED = originalPhase16Enabled;
  }
}

console.log('cadence tag 检查通过');
