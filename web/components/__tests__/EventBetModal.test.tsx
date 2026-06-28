// @vitest-environment jsdom

import React, { act } from 'react';
import { existsSync, readFileSync } from 'node:fs';
import Module from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoot, type Root } from 'react-dom/client';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorldCupMarketRow } from '@/lib/worldcup-markets';

const testDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(testDir, '../..');
const repoRoot = resolve(webRoot, '..');
const nodeRequire = Module.createRequire(import.meta.url);
const moduleCache = new Map<string, Record<string, unknown>>();
const writeContractAsync = vi.fn();

const wagmiMock = {
  useAccount: () => ({
    address: '0x0000000000000000000000000000000000000001',
    chainId: 5042002,
  }),
  useReadContract: () => ({ data: 1_000_000_000n, refetch: vi.fn() }),
  useWriteContract: () => ({ writeContractAsync, isPending: false }),
  useWaitForTransactionReceipt: () => ({
    data: undefined,
    isLoading: false,
    isSuccess: false,
    isError: false,
  }),
  useSwitchChain: () => ({ switchChainAsync: vi.fn() }),
};

const resolveTsSpecifier = (specifier: string, parentDir: string) => {
  const directPath = specifier.startsWith('@/') ? resolve(webRoot, specifier.slice(2)) : resolve(parentDir, specifier);
  const candidates = [
    directPath,
    `${directPath}.ts`,
    `${directPath}.tsx`,
    `${directPath}.js`,
    `${directPath}.jsx`,
    `${directPath}.json`,
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

const loadTsModule = (modulePath: string): Record<string, unknown> => {
  if (moduleCache.has(modulePath)) {
    return moduleCache.get(modulePath)!;
  }

  if (extname(modulePath) === '.json') {
    return nodeRequire(modulePath) as Record<string, unknown>;
  }

  const source = readFileSync(modulePath, 'utf8');
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      resolveJsonModule: true,
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

  const loadedModule = { exports: {} as Record<string, unknown> };
  moduleCache.set(modulePath, loadedModule.exports);

  const localRequire = (specifier: string) => {
    if (specifier === 'wagmi') {
      return wagmiMock;
    }

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

const EventBetModal = loadTsModule(resolve(webRoot, 'components/EventBetModal.tsx')).EventBetModal as React.ComponentType<{
  row: WorldCupMarketRow;
  outcomeIndex: number;
  onClose: () => void;
}>;
const worldCupMarkets = loadTsModule(resolve(webRoot, 'lib/worldcup-markets.ts'));
const WORLDCUP_SKELETON_MARKETS = worldCupMarkets.WORLDCUP_SKELETON_MARKETS as WorldCupMarketRow[];

let container: HTMLDivElement;
let root: Root;

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const render = async (element: React.ReactElement) => {
  await act(async () => {
    root.render(element);
    await flushPromises();
  });
};

const placeBetButton = () =>
  Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent?.includes('Place Bet'),
  );

describe('EventBetModal', () => {
  beforeEach(() => {
    writeContractAsync.mockReset();
    writeContractAsync.mockResolvedValue(
      '0x0000000000000000000000000000000000000000000000000000000000000001',
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('32 强 fallback 行没有链上 backing 时不能提交展示 id', async () => {
    const row = WORLDCUP_SKELETON_MARKETS.find(
      (market) => market.matchId === 'r32-1' && market.marketType === '1x2',
    );

    expect(row).toBeTruthy();

    await render(React.createElement(EventBetModal, { row: row!, outcomeIndex: 0, onClose: vi.fn() }));

    expect(placeBetButton()).toBeTruthy();
    expect(placeBetButton()?.disabled).toBe(true);
    expect(container.textContent).toContain('This event market is not available on-chain yet.');

    await act(async () => {
      placeBetButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(writeContractAsync).not.toHaveBeenCalled();
  });
});
