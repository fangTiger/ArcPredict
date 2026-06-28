// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const sportsDbEventIdForMatchMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/worldcup-seed', () => ({
  sportsDbEventIdForMatch: sportsDbEventIdForMatchMock,
}));

import {
  POLL_INTERVAL_MS,
  clearLiveScoreCache,
  useLiveScore,
} from '../lib/event-source';

type HookState = ReturnType<typeof useLiveScore>;

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

function Harness({
  matchId = 'group-a-1',
  containerRef,
  matchInProgress,
  onState,
}: {
  matchId?: string;
  containerRef: { current: HTMLDivElement | null };
  matchInProgress: boolean;
  onState: (state: HookState) => void;
}) {
  const state = useLiveScore(matchId, { containerRef, matchInProgress });
  onState(state);
  return null;
}

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('useLiveScore', () => {
  let root: Root;
  let host: HTMLDivElement;
  let target: HTMLDivElement;
  let containerRef: { current: HTMLDivElement | null };
  let latestState: HookState | null;

  beforeEach(() => {
    // @ts-expect-error jsdom test hook
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          events: [
            {
              intHomeScore: '1',
              intAwayScore: '0',
              strStatus: "67'",
            },
          ],
        }),
      })),
    );
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    window.history.replaceState({}, '', '/');
    setVisibility('visible');
    clearLiveScoreCache();
    sportsDbEventIdForMatchMock.mockImplementation((matchId: string) =>
      matchId === 'qf-1' ? null : '1543883',
    );
    MockIntersectionObserver.instances = [];
    latestState = null;

    host = document.createElement('div');
    target = document.createElement('div');
    host.appendChild(target);
    document.body.appendChild(host);
    root = createRoot(host);
    containerRef = { current: target };
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await flushPromises();
    });
    // @ts-expect-error jsdom test hook
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  test('切到隐藏页时暂停，恢复可见时立即补拉', async () => {
    await act(async () => {
      root.render(
        React.createElement(Harness, {
          containerRef,
          matchInProgress: true,
          onState: (state: HookState) => {
            latestState = state;
          },
        }),
      );
      await flushPromises();
    });

    await act(async () => {
      MockIntersectionObserver.instances[0].emit(true);
      await flushPromises();
    });

    const initialCalls = vi.mocked(fetch).mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1);
    expect(latestState).toMatchObject({
      status: 'success',
      score: { home: 1, away: 0, label: "67'" },
    });

    await act(async () => {
      setVisibility('hidden');
      await flushPromises();
    });

    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 2);
      await flushPromises();
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(initialCalls);

    await act(async () => {
      setVisibility('visible');
      await flushPromises();
    });
    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(initialCalls);
  });

  test('滚出视口时立即停止轮询', async () => {
    await act(async () => {
      root.render(
        React.createElement(Harness, {
          containerRef,
          matchInProgress: true,
          onState: (state: HookState) => {
            latestState = state;
          },
        }),
      );
      await flushPromises();
    });

    await act(async () => {
      MockIntersectionObserver.instances[0].emit(true);
      await flushPromises();
    });

    const initialCalls = vi.mocked(fetch).mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    await act(async () => {
      MockIntersectionObserver.instances[0].emit(false);
      await flushPromises();
    });

    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS * 2);
      await flushPromises();
    });

    expect(vi.mocked(fetch).mock.calls.length).toBe(initialCalls);
    expect(latestState?.status).toBe('success');
  });

  test('重新进入视口时立即补拉', async () => {
    await act(async () => {
      root.render(
        React.createElement(Harness, {
          containerRef,
          matchInProgress: true,
          onState: (state: HookState) => {
            latestState = state;
          },
        }),
      );
      await flushPromises();
    });

    await act(async () => {
      MockIntersectionObserver.instances[0].emit(true);
      await flushPromises();
    });

    const initialCalls = vi.mocked(fetch).mock.calls.length;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    await act(async () => {
      MockIntersectionObserver.instances[0].emit(false);
      await flushPromises();
    });

    await act(async () => {
      MockIntersectionObserver.instances[0].emit(true);
      await flushPromises();
    });

    expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(initialCalls);
  });

  test('请求失败时优雅降级为 error + null score', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network failed');
      }),
    );

    await act(async () => {
      root.render(
        React.createElement(Harness, {
          containerRef,
          matchInProgress: true,
          onState: (state: HookState) => {
            latestState = state;
          },
        }),
      );
      await flushPromises();
    });

    await act(async () => {
      MockIntersectionObserver.instances[0].emit(true);
      await flushPromises();
    });

    expect(latestState).toMatchObject({
      status: 'error',
      score: null,
    });
  });

  test('provider id 缺失时不发请求并返回 error', async () => {
    await act(async () => {
      root.render(
        React.createElement(Harness, {
          matchId: 'qf-1',
          containerRef,
          matchInProgress: true,
          onState: (state: HookState) => {
            latestState = state;
          },
        }),
      );
      await flushPromises();
    });

    await act(async () => {
      MockIntersectionObserver.instances[0].emit(true);
      await flushPromises();
    });

    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
    expect(latestState).toMatchObject({
      status: 'error',
      score: null,
    });
  });

  test('开发态 query 可强制详情页进入进行中并按 60s 轮询，隐藏后停止', async () => {
    window.history.replaceState({}, '', '/market/9001?kind=event&wcLiveScoreFixture=group-a-1');

    await act(async () => {
      root.render(
        React.createElement(Harness, {
          matchId: 'group-a-1',
          containerRef,
          matchInProgress: false,
          onState: (state: HookState) => {
            latestState = state;
          },
        }),
      );
      await flushPromises();
    });

    expect(vi.mocked(fetch).mock.calls.length).toBe(0);

    await act(async () => {
      MockIntersectionObserver.instances[0].emit(true);
      await flushPromises();
    });

    expect(vi.mocked(fetch).mock.calls.length).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS - 1);
      await flushPromises();
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(1);
      await flushPromises();
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(2);

    await act(async () => {
      setVisibility('hidden');
      await flushPromises();
    });

    await act(async () => {
      vi.advanceTimersByTime(POLL_INTERVAL_MS);
      await flushPromises();
    });
    expect(vi.mocked(fetch).mock.calls.length).toBe(2);
    expect(latestState?.status).toBe('success');
  });

  test('开发态 query 可临时覆写比分 API base URL', async () => {
    window.history.replaceState(
      {},
      '',
      '/market/9001?kind=event&wcScoreApiBase=http://127.0.0.1:3999/mock',
    );

    await act(async () => {
      root.render(
        React.createElement(Harness, {
          matchId: 'group-a-1',
          containerRef,
          matchInProgress: true,
          onState: (state: HookState) => {
            latestState = state;
          },
        }),
      );
      await flushPromises();
    });

    await act(async () => {
      MockIntersectionObserver.instances[0].emit(true);
      await flushPromises();
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'http://127.0.0.1:3999/mock/lookupevent.php?id=1543883',
    );
    expect(latestState?.status).toBe('success');
  });
});
