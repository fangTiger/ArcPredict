// @vitest-environment jsdom
import React, { act } from 'react';
import { existsSync, readFileSync } from 'node:fs';
import Module from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoot, type Root } from 'react-dom/client';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { LensInput, LensOutput } from '../lib/lens/schema';

const testDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(testDir, '..');
const repoRoot = resolve(webRoot, '..');
const nodeRequire = Module.createRequire(import.meta.url);
const moduleCache = new Map<string, unknown>();

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
    return moduleCache.get(modulePath) as Record<string, unknown>;
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

  const module = { exports: {} as Record<string, unknown> };
  moduleCache.set(modulePath, module.exports);

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

  const wrapper = new Function('exports', 'require', 'module', '__filename', '__dirname', outputText);
  wrapper(module.exports, localRequire, module, modulePath, dirname(modulePath));

  return module.exports;
};

const compactModule = loadTsModule(resolve(webRoot, 'components/AILensCompact.tsx'));
const AILensCompact = compactModule.AILensCompact as React.ComponentType<{
  input: LensInput;
  fetchImpl?: typeof fetch;
}>;

const baseInput: LensInput = {
  market: {
    id: 'm1',
    question: 'q',
    type: 'crypto-binary',
    end_time: 9_999_999_999,
    implied_probability: 0.3,
  },
  context: {},
  generated_at: 1,
};

const fakeOutput: LensOutput = {
  summary: '近一周波动率上升，AI 估算偏低于市场。',
  factors: ['a', 'b', 'c'],
  fair_range: [0.1, 0.2],
  confidence: 'med',
  reasoning: 'r',
  sources: [],
  caveats: [],
};

let container: HTMLDivElement;
let root: Root;

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  // @ts-expect-error jsdom test hook
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  // @ts-expect-error jsdom test hook
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

describe('AILensCompact', () => {
  test('初始 idle：显示按钮文字', () => {
    act(() => {
      root.render(React.createElement(AILensCompact, { input: baseInput, fetchImpl: vi.fn() }));
    });

    expect(container.textContent).toContain('Ask AI');
  });

  test('点击触发：成功后显示 summary 与 drift chip', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          cached: false,
          output: fakeOutput,
          meta: { last_updated_ms: 0, input_hash: 'h' },
        }),
        { status: 200 },
      ),
    );

    act(() => {
      root.render(
        React.createElement(AILensCompact, { input: baseInput, fetchImpl: fetchMock as typeof fetch }),
      );
    });

    const btn = container.querySelector('button');
    expect(btn).toBeTruthy();

    await act(async () => {
      btn?.click();
      await flushPromises();
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(container.textContent).toContain('近一周波动率上升');
    expect(container.textContent).toContain('市场 30%');
  });

  test('loading 状态用 polite status 宣告', async () => {
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>(() => {
          // 保持 pending，便于断言 loading UI。
        }),
    );

    act(() => {
      root.render(
        React.createElement(AILensCompact, { input: baseInput, fetchImpl: fetchMock as typeof fetch }),
      );
    });

    const btn = container.querySelector('button');
    await act(async () => {
      btn?.click();
      await Promise.resolve();
    });

    const status = container.querySelector('div[role="status"][aria-live="polite"]');
    expect(status?.textContent).toContain('Analyzing…');
    expect(status?.textContent).toContain('AI 正在分析…');
  });

  test('result 状态用 polite status 宣告', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          cached: false,
          output: fakeOutput,
          meta: { last_updated_ms: 0, input_hash: 'h' },
        }),
        { status: 200 },
      ),
    );

    act(() => {
      root.render(
        React.createElement(AILensCompact, { input: baseInput, fetchImpl: fetchMock as typeof fetch }),
      );
    });

    const btn = container.querySelector('button');
    await act(async () => {
      btn?.click();
      await flushPromises();
    });

    const status = container.querySelector('div[role="status"][aria-live="polite"]');
    expect(status?.textContent).toContain('近一周波动率上升');
  });
});
