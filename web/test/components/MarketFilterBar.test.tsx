// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { existsSync, readFileSync } from 'node:fs';
import Module from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen } from '@testing-library/react';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(testDir, '../..');
const repoRoot = resolve(webRoot, '..');
const nodeRequire = Module.createRequire(import.meta.url);
const moduleCache = new Map<string, Record<string, unknown>>();

const resolveTsSpecifier = (specifier: string, parentDir: string) => {
  const directPath = specifier.startsWith('@/') ? resolve(webRoot, specifier.slice(2)) : resolve(parentDir, specifier);
  const candidates = [
    directPath,
    `${directPath}.ts`,
    `${directPath}.tsx`,
    `${directPath}.js`,
    `${directPath}.jsx`,
    resolve(directPath, 'index.ts'),
    resolve(directPath, 'index.tsx'),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

const loadTsModule = (modulePath: string): Record<string, unknown> => {
  if (moduleCache.has(modulePath)) {
    return moduleCache.get(modulePath)!;
  }

  const source = readFileSync(modulePath, 'utf8');
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: modulePath,
    reportDiagnostics: true,
  });

  if (diagnostics?.length) {
    const message = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => repoRoot,
      getNewLine: () => '\n',
    });
    throw new Error(`TypeScript 转译失败:\n${message}`);
  }

  const loadedModule = { exports: {} as Record<string, unknown> };
  moduleCache.set(modulePath, loadedModule.exports);

  const localRequire = (specifier: string) => {
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

  wrapper(loadedModule.exports, localRequire, loadedModule, modulePath, dirname(modulePath));
  return loadedModule.exports;
};

const MarketFilterBar = loadTsModule(resolve(webRoot, 'components/MarketFilterBar.tsx')).MarketFilterBar as React.ComponentType<Record<string, unknown>>;

describe('MarketFilterBar', () => {
  it('renders 4 category tabs', () => {
    render(React.createElement(MarketFilterBar, {
      asset: 'all',
      cadence: 'all',
      category: 'crypto',
      showCategoryTabs: true,
      onCategoryChange: () => undefined,
      onChange: () => undefined,
    }));

    expect(screen.getByRole('tab', { name: /crypto/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /world cup/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /macro/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /on-?chain/i })).toBeInTheDocument();
  });
});
