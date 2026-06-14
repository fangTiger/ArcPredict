// @vitest-environment jsdom

import React, { act } from 'react';
import { existsSync, readFileSync } from 'node:fs';
import Module from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoot, type Root } from 'react-dom/client';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow } from '@/lib/derivePosition';

const testDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(testDir, '../..');
const repoRoot = resolve(webRoot, '..');
const nodeRequire = Module.createRequire(import.meta.url);
const moduleCache = new Map<string, Record<string, unknown>>();

const wagmiMock = {
  useAccount: () => ({
    address: '0x0000000000000000000000000000000000000000',
    chainId: 2026,
  }),
  useReadContract: () => ({ data: 0n, refetch: vi.fn() }),
  useWriteContract: () => ({ writeContractAsync: vi.fn(), isPending: false }),
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

  const module = { exports: {} as Record<string, unknown> };
  moduleCache.set(modulePath, module.exports);

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

  wrapper(module.exports, localRequire, module, modulePath, dirname(modulePath));
  return module.exports;
};

const BetForm = loadTsModule(resolve(webRoot, 'components/BetForm.tsx')).BetForm as React.ComponentType<{
  row: DashboardRow;
  side: boolean;
  onSuccess: () => void;
}>;

const mockRow = {
  id: 1n,
  market: {
    question: 'BTC > $50k?',
    pythPriceId: '0xabc',
    threshold: 50000n,
    thresholdExpo: 0,
    betDeadline: 9999999999n,
    resolveAfter: 9999999999n,
    yesPool: 1000000n,
    noPool: 1000000n,
    winnerPool: 0n,
    protocolFee: 0n,
    feeBpsSnapshot: 0,
    feeRecipientSnapshot: '0x0000000000000000000000000000000000000000',
    outcome: 0,
    settlePrice: 0n,
    settleTime: 0n,
  },
  yesStake: 0n,
  noStake: 0n,
  claimed_: false,
  pendingPayout: 0n,
} as unknown as DashboardRow;

let container: HTMLDivElement;
let root: Root;

const render = async (element: React.ReactElement) => {
  await act(async () => {
    root.render(element);
  });
};

const confirmButton = () =>
  Array.from(container.querySelectorAll('button')).find((button) =>
    /确认下注/u.test(button.textContent ?? ''),
  );

describe('BetForm', () => {
  beforeEach(() => {
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

  it('renders the form fields when given a row + side', async () => {
    await render(React.createElement(BetForm, { row: mockRow, side: true, onSuccess: () => {} }));

    expect(container.querySelector('input[placeholder*="USDC"]')).toBeTruthy();
    expect(confirmButton()).toBeTruthy();
  });

  it('shows YES style when side=true and NO style when side=false', async () => {
    await render(React.createElement(BetForm, { row: mockRow, side: true, onSuccess: () => {} }));
    expect(confirmButton()?.className).toMatch(/yes/u);

    await render(React.createElement(BetForm, { row: mockRow, side: false, onSuccess: () => {} }));
    expect(confirmButton()?.className).toMatch(/no/u);
  });
});
