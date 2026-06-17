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

const panelModule = loadTsModule(resolve(webRoot, 'components/AILensPanel.tsx'));
const AILensPanel = panelModule.AILensPanel as React.ComponentType<{
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

const multiInput: LensInput = {
  market: {
    id: 'm2',
    question: 'winner',
    type: 'event-multi',
    end_time: 9_999_999_999,
    implied_probability: 0.4,
    outcome_options: ['Brazil', 'France', 'Other'],
    outcome_implied_probabilities: {
      Brazil: 0.12,
      France: 0.28,
      Other: 0.6,
    },
  },
  context: {},
  generated_at: 1,
};

const fakeOutput: LensOutput = {
  summary: 'BTC 估算偏低。',
  factors: ['波动率高', '距阈值远', '历史空头偏多'],
  fair_range: [0.1, 0.22],
  confidence: 'med',
  reasoning: '基于 Pyth 30 天波动率推理。',
  sources: [{ name: 'Pyth', ref: 'BTC/USD', ts: 1 }],
  caveats: ['不含突发新闻'],
};

const multiOutput: LensOutput = {
  summary: '强队概率集中。',
  factors: ['阵容深度', '赛程强度', '历史表现'],
  confidence: 'low',
  reasoning: '基于事实表与市场概率分布。',
  sources: [{ name: 'WorldCupFacts', ref: 'seed', ts: 1 }],
  caveats: [],
  outcome_fair_probabilities: {
    Brazil: [0.24, 0.32],
    France: [0.18, 0.26],
    Other: [0.42, 0.58],
  },
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

describe('AILensPanel', () => {
  test('初始 idle：显示 Generate 按钮与非投顾提示', () => {
    act(() => {
      root.render(React.createElement(AILensPanel, { input: baseInput, fetchImpl: vi.fn() }));
    });

    expect(container.textContent).toContain('Generate AI Lens');
    expect(container.textContent).toContain('非投顾建议');
    expect(container.textContent).not.toContain('缓存');
    expect(container.textContent).not.toMatch(/cache/i);
  });

  test('点击后进入 loading 状态', async () => {
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>(() => {
          // 保持 pending，便于断言 loading UI。
        }),
    );

    act(() => {
      root.render(React.createElement(AILensPanel, { input: baseInput, fetchImpl: fetchMock as typeof fetch }));
    });

    const btn = container.querySelector('button');
    await act(async () => {
      btn?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('AI 正在分析');
    const status = container.querySelector('section[role="status"][aria-live="polite"]');
    expect(status?.textContent).toContain('AI 正在分析');
  });

  test('成功后显示 summary / factors / sources / 免责脚标', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          cached: false,
          output: fakeOutput,
          meta: { last_updated_ms: Date.now(), input_hash: 'h' },
        }),
        { status: 200 },
      ),
    );

    act(() => {
      root.render(React.createElement(AILensPanel, { input: baseInput, fetchImpl: fetchMock as typeof fetch }));
    });

    const btn = container.querySelector('button');
    await act(async () => {
      btn?.click();
      await flushPromises();
    });

    expect(container.textContent).toContain('BTC 估算偏低');
    expect(container.textContent).toContain('波动率高');
    expect(container.textContent).toContain('Pyth · BTC/USD');
    expect(container.textContent).toContain('AI 10%–22%');
    expect(container.textContent).toContain('Not financial advice');
    const status = container.querySelector('section[role="status"][aria-live="polite"]');
    expect(status?.textContent).toContain('BTC 估算偏低');
  });

  test('event-multi 结果显示多 outcome gauge 且不暴露缓存实现术语', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(240_000);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          cached: true,
          output: multiOutput,
          meta: { last_updated_ms: 0, input_hash: 'h2' },
        }),
        { status: 200 },
      ),
    );

    act(() => {
      root.render(React.createElement(AILensPanel, { input: multiInput, fetchImpl: fetchMock as typeof fetch }));
    });

    const btn = container.querySelector('button');
    await act(async () => {
      btn?.click();
      await flushPromises();
    });

    expect(container.textContent).toContain('Brazil');
    expect(container.textContent).toContain('市场 12% · AI 24%–32%');
    expect(container.textContent).toContain('AI 24%–32%');
    expect(container.textContent).toContain('France');
    expect(container.textContent).toContain('市场 28% · AI 18%–26%');
    expect(container.textContent).toContain('Updated 4m ago');
    expect(container.textContent).not.toContain('Cached');
    expect(container.textContent).not.toContain('Fresh');
    expect(container.textContent).not.toMatch(/cache/i);
  });

  test('错误状态显示重试按钮', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'error',
          code: 'llm_failure',
          message: '上游错误',
        }),
        { status: 502 },
      ),
    );

    act(() => {
      root.render(React.createElement(AILensPanel, { input: baseInput, fetchImpl: fetchMock as typeof fetch }));
    });

    const btn = container.querySelector('button');
    await act(async () => {
      btn?.click();
      await flushPromises();
    });

    expect(container.textContent).toContain('AI Lens 暂不可用');
    expect(container.textContent).toContain('重试');
  });
});
