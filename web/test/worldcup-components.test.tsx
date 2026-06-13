// @vitest-environment jsdom

import React, { act } from 'react';
import { existsSync, readFileSync } from 'node:fs';
import Module from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoot, type Root } from 'react-dom/client';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(testDir, '..');
const repoRoot = resolve(webRoot, '..');
const nodeRequire = Module.createRequire(import.meta.url);
const moduleCache = new Map<string, unknown>();

type LoadedWorldCupRow = {
  marketKind: string;
  matchId: string | null;
  stage: string;
  stageLabel: string;
  kickoffTime: string;
  userOutcomeStakes: bigint[];
  homeTeam: {
    shortCode: string;
    teamId?: string;
  };
  awayTeam: {
    shortCode: string;
    teamId?: string;
  } | null;
  outcomes: Array<{
    id: string;
    openingProbability: number;
    impliedProbability: number;
    teamId?: string;
  }>;
};

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

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
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
    if (specifier === '@/lib/flag-icons' || specifier.endsWith('/lib/flag-icons')) {
      return {
        flagIconUrlForTeam: () => 'test://flag.svg',
      };
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

const marketFilterModule = loadTsModule(resolve(webRoot, 'components/MarketFilterBar.tsx'));
const eventInfoPanelModule = loadTsModule(resolve(webRoot, 'components/EventInfoPanel.tsx'));
const worldCupCardModule = loadTsModule(resolve(webRoot, 'components/WorldCupMarketCard.tsx'));
const worldCupMarketsModule = loadTsModule(resolve(webRoot, 'lib/worldcup-markets.ts'));

const MarketFilterBar = marketFilterModule.MarketFilterBar as React.ComponentType<Record<string, unknown>>;
const EventInfoPanel = eventInfoPanelModule.EventInfoPanel as React.ComponentType<Record<string, unknown>>;
const WorldCupMarketCard = worldCupCardModule.WorldCupMarketCard as React.ComponentType<Record<string, unknown>>;
const WORLDCUP_SKELETON_MARKETS = worldCupMarketsModule.WORLDCUP_SKELETON_MARKETS as Array<Record<string, unknown>>;
const resolveWorldCupMarkets = worldCupMarketsModule.resolveWorldCupMarkets as (
  rows: Array<Record<string, unknown>>,
) => LoadedWorldCupRow[];

const MATCH_LENGTH_SECONDS = 150 * 60;

const toAsciiBytes32 = (value: string): `0x${string}` =>
  `0x${Buffer.from(value, 'utf8').toString('hex').padEnd(64, '0')}` as `0x${string}`;

const secondsForIso = (value: string) => BigInt(Math.floor(Date.parse(value) / 1000));

const makeEventRow = ({
  eventId,
  outcomeCount,
  question,
  resolveAfter,
  outcomePools,
}: {
  eventId: `0x${string}`;
  outcomeCount: number;
  question: string;
  resolveAfter: bigint;
  outcomePools: bigint[];
}) => ({
  id: 77n,
  market: {
    eventId,
    outcomeCount,
    betDeadline: resolveAfter - 900n,
    resolveAfter,
    outcomePools,
    winnerPool: 0n,
    protocolFee: 0n,
    feeBpsSnapshot: 0,
    feeRecipientSnapshot: '0x0000000000000000000000000000000000000000',
    settledOutcome: 255,
    settleTime: 0n,
    question,
  },
  userOutcomeStakes: Array.from({ length: outcomeCount }, () => 0n),
  claimed_: false,
  pendingPayout: 0n,
});

const setMatchMedia = (matches: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
};

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  observe() {}

  unobserve() {}

  disconnect() {}

  emit(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('worldcup components', () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    // @ts-expect-error jsdom test hook
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    vi.useRealTimers();
    vi.unstubAllGlobals();
    // @ts-expect-error jsdom test hook
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    document.body.innerHTML = '';
  });

  test('World Cup 1X2 卡片在移动端默认折叠，展开后显示完整三栏', async () => {
    setMatchMedia(true);
    const row = WORLDCUP_SKELETON_MARKETS.find((market) => market.marketType === '1x2');

    expect(row).toBeTruthy();

    await act(async () => {
      root.render(React.createElement(WorldCupMarketCard, { row: row! }));
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Home Win');
    expect(host.textContent).toContain('Other outcomes');
    expect(host.textContent).toContain('Expand');

    const button = host.querySelector('button');
    expect(button?.textContent).toContain('Expand');

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Draw');
    expect(host.textContent).toContain('Away Win');
    expect(host.textContent).toContain('Collapse');
  });

  test('World Cup outcome tiles can open the event betting flow directly', async () => {
    setMatchMedia(true);
    const row = WORLDCUP_SKELETON_MARKETS.find((market) => market.marketType === '1x2');
    const onBet = vi.fn();

    expect(row).toBeTruthy();

    await act(async () => {
      root.render(React.createElement(WorldCupMarketCard, { row: row!, onBet }));
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Bet');
    expect(host.textContent).toContain('Home Win');
    expect(host.textContent).toContain('Draw');
    expect(host.textContent).toContain('Away Win');

    const homeWinButton = Array.from(host.querySelectorAll('button')).find((node) =>
      node.textContent?.includes('Home Win'),
    );
    expect(homeWinButton).toBeTruthy();

    await act(async () => {
      homeWinButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(onBet).toHaveBeenCalledWith(row, 0);
  });

  test('冠军盘默认只显示前三，移动端展开后最多显示前八并保留滚动容器', async () => {
    setMatchMedia(true);
    const row = WORLDCUP_SKELETON_MARKETS.find((market) => market.marketType === 'winner');

    expect(row).toBeTruthy();

    await act(async () => {
      root.render(React.createElement(WorldCupMarketCard, { row: row! }));
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Show top 8');
    expect(host.textContent).not.toContain('Show all 32 teams');
    expect(host.textContent).not.toContain('Cameroon');

    const button = Array.from(host.querySelectorAll('button')).find((node) =>
      node.textContent?.includes('Show top 8'),
    );
    expect(button).toBeTruthy();

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Cameroon');
    expect(host.textContent).not.toContain('Netherlands');

    const scrollContainer = host.querySelector('[data-scrollable-outcomes="true"]');
    expect(scrollContainer).toBeTruthy();
    expect(scrollContainer?.className).toContain('overflow-y-auto');
    expect(scrollContainer?.className).toContain('max-h-');
  });

  test('冠军盘桌面端仍显示查看全部 32 队按钮', async () => {
    setMatchMedia(false);
    const row = WORLDCUP_SKELETON_MARKETS.find((market) => market.marketType === 'winner');

    expect(row).toBeTruthy();

    await act(async () => {
      root.render(React.createElement(WorldCupMarketCard, { row: row! }));
      await Promise.resolve();
    });

    expect(host.textContent).toContain('Show all 32 teams');
  });

  test('World Cup 过滤栏在赛事品类下显示阶段按钮，关闭 tabs 时只保留 Crypto 过滤', async () => {
    setMatchMedia(false);
    const onChange = vi.fn();
    const onCategoryChange = vi.fn();
    const onStageChange = vi.fn();

    await act(async () => {
      root.render(
        React.createElement(MarketFilterBar, {
          asset: 'all',
          cadence: 'all',
          category: 'worldcup',
          stage: 'group',
          showCategoryTabs: true,
          onCategoryChange,
          onStageChange,
          onChange,
        }),
      );
      await Promise.resolve();
    });

    expect(host.textContent).toContain('World Cup');
    expect(host.textContent).toContain('Stage');
    expect(host.textContent).toContain('R16');

    const finalButton = Array.from(host.querySelectorAll('button')).find((node) =>
      node.textContent?.includes('Final'),
    );
    expect(finalButton).toBeTruthy();

    await act(async () => {
      finalButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(onStageChange).toHaveBeenCalledWith('final');

    await act(async () => {
      root.render(
        React.createElement(MarketFilterBar, {
          asset: 'BTC',
          cadence: 'weekly',
          category: 'crypto',
          stage: 'all',
          showCategoryTabs: false,
          onCategoryChange,
          onStageChange,
          onChange,
        }),
      );
      await Promise.resolve();
    });

    expect(host.textContent).not.toContain('World Cup');
    expect(host.textContent).toContain('Asset');
    expect(host.textContent).toContain('Cadence');
  });

  test('比分服务失败时详情面板隐藏数值比分并回退到赛程文案', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network failed');
      }),
    );
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    MockIntersectionObserver.instances = [];

    const row = WORLDCUP_SKELETON_MARKETS.find((market) => market.marketType === '1x2');
    expect(row).toBeTruthy();

    const activeRow = {
      ...row!,
      kickoffTime: new Date(Date.now() - 60_000).toISOString(),
    };

    await act(async () => {
      root.render(React.createElement(EventInfoPanel, { row: activeRow }));
      await flushPromises();
    });

    await act(async () => {
      MockIntersectionObserver.instances[0]?.emit(true);
      await flushPromises();
    });

    expect(host.textContent).toContain('Live score is unavailable; schedule data is shown instead.');
    expect(host.textContent).toContain('Syncing live score...');
    expect(host.textContent).not.toContain('1 - 0');
  });

  test('ASCII bytes32 eventId 会映射到 seed match，而不是按 skeleton 下标套数据', () => {
    const kickoffTime = '2022-11-26T19:00:00Z';
    const resolveAfter = secondsForIso(kickoffTime) + BigInt(MATCH_LENGTH_SECONDS);
    const [row] = resolveWorldCupMarkets([
      makeEventRow({
        eventId: toAsciiBytes32('worldcup:group-c-4:1x2'),
        outcomeCount: 3,
        question: 'Argentina vs Mexico 1X2',
        resolveAfter,
        outcomePools: [45_000_000n, 30_000_000n, 25_000_000n],
      }),
    ]);

    expect(row.stage).toBe('group');
    expect(row.marketKind).toBe('event');
    expect(row.matchId).toBe('group-c-4');
    expect(row.stageLabel).toBe('Group C');
    expect(row.kickoffTime).toBe(kickoffTime);
    expect(row.homeTeam.shortCode).toBe('ARG');
    expect(row.awayTeam?.shortCode).toBe('MEX');
    expect(row.outcomes).toHaveLength(3);
    expect(row.userOutcomeStakes).toEqual([0n, 0n, 0n]);
    expect(row.outcomes.map((outcome: { impliedProbability: number }) => outcome.impliedProbability)).toEqual([
      45,
      30,
      25,
    ]);
    expect(row.outcomes[0]?.openingProbability).toBeGreaterThan(0);
  });

  test('未知 eventId 且 question 无法匹配时，会安全降级为 generic event row', () => {
    const resolveAfter = secondsForIso('2026-07-05T15:00:00Z');
    const [row] = resolveWorldCupMarkets([
      makeEventRow({
        eventId: `0x${'ab'.repeat(32)}` as `0x${string}`,
        outcomeCount: 3,
        question: 'Knockout special market',
        resolveAfter,
        outcomePools: [0n, 0n, 0n],
      }),
    ]);

    expect(row.homeTeam.shortCode).not.toBe('ARG');
    expect(row.awayTeam?.shortCode).not.toBe('MEX');
    expect(row.homeTeam.teamId).toBeUndefined();
    expect(row.awayTeam?.teamId).toBeUndefined();
    expect(row.kickoffTime).toBe(new Date(Number((resolveAfter - BigInt(MATCH_LENGTH_SECONDS)) * 1000n)).toISOString());
  });

  test('readable knockout eventId 命中 placeholder seed 时，会优先使用 question 中的真实球队', () => {
    const kickoffTime = '2022-12-09T15:00:00Z';
    const resolveAfter = secondsForIso(kickoffTime) + BigInt(MATCH_LENGTH_SECONDS);
    const [row] = resolveWorldCupMarkets([
      makeEventRow({
        eventId: toAsciiBytes32('worldcup:qf-1:1x2'),
        outcomeCount: 3,
        question: 'Brazil vs Croatia 1X2',
        resolveAfter,
        outcomePools: [52_000_000n, 24_000_000n, 24_000_000n],
      }),
    ]);

    expect(row.stage).toBe('qf');
    expect(row.homeTeam.shortCode).toBe('BRA');
    expect(row.awayTeam?.shortCode).toBe('CRO');
    expect(row.homeTeam.shortCode).not.toContain('R16');
    expect(row.awayTeam?.shortCode).not.toContain('R16');
  });

  test('readable final eventId 命中 placeholder seed 时，会优先使用 question 中的真实球队', () => {
    const kickoffTime = '2022-12-18T15:00:00Z';
    const resolveAfter = secondsForIso(kickoffTime) + BigInt(MATCH_LENGTH_SECONDS);
    const [row] = resolveWorldCupMarkets([
      makeEventRow({
        eventId: toAsciiBytes32('worldcup:final-1:1x2'),
        outcomeCount: 3,
        question: 'Argentina vs France Final 1X2',
        resolveAfter,
        outcomePools: [38_000_000n, 29_000_000n, 33_000_000n],
      }),
    ]);

    expect(row.stage).toBe('final');
    expect(row.homeTeam.shortCode).toBe('ARG');
    expect(row.awayTeam?.shortCode).toBe('FRA');
    expect(row.homeTeam.shortCode).not.toContain('SF');
    expect(row.awayTeam?.shortCode).not.toContain('SF');
  });

  test('真实 seeded final-1 keccak eventId 也会稳定映射到 final match，并保留 question 中的 ARG/FRA 球队', () => {
    const kickoffTime = '2022-12-18T15:00:00Z';
    const resolveAfter = secondsForIso(kickoffTime) + BigInt(MATCH_LENGTH_SECONDS);
    const [row] = resolveWorldCupMarkets([
      makeEventRow({
        eventId: '0x2b902d6a9c3a763f380d5c1af8475ea4efa1142488ebc730dc7c1c8851b061b1',
        outcomeCount: 3,
        question: 'ARG vs FRA 1X2',
        resolveAfter,
        outcomePools: [38_000_000n, 29_000_000n, 33_000_000n],
      }),
    ]);

    expect(row.matchId).toBe('final-1');
    expect(row.stage).toBe('final');
    expect(row.kickoffTime).toBe(kickoffTime);
    expect(row.homeTeam.shortCode).toBe('ARG');
    expect(row.homeTeam.teamId).toBe('ARG');
    expect(row.awayTeam?.shortCode).toBe('FRA');
    expect(row.awayTeam?.teamId).toBe('FRA');
    expect(row.outcomes.map((outcome) => outcome.id)).toEqual(['arg-win', 'draw', 'fra-win']);
    expect(row.outcomes[0]?.teamId).toBe('ARG');
    expect(row.outcomes[2]?.teamId).toBe('FRA');
  });
});
