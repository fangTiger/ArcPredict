// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { clearLiveScoreCache, useLiveScore } from '../lib/event-source';

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
  onState,
  matchId = 'group-a-1',
}: {
  onState: (state: HookState) => void;
  matchId?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const state = useLiveScore(matchId, {
    containerRef,
    matchInProgress: true,
  });
  onState(state);

  return React.createElement('div', { ref: containerRef });
}

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

function response(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe('useLiveScore degradation matrix', () => {
  let root: Root;
  let host: HTMLDivElement;
  let latestState: HookState | null;

  beforeEach(() => {
    // @ts-expect-error jsdom test hook
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    setVisibility('visible');
    clearLiveScoreCache();
    MockIntersectionObserver.instances = [];
    latestState = null;

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
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

  async function renderAndEnterViewport(fetchImpl: typeof fetch) {
    vi.stubGlobal('fetch', fetchImpl);

    await act(async () => {
      root.render(
        React.createElement(Harness, {
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
  }

  test.each([
    [
      '网络错误',
      vi.fn(async () => {
        throw new Error('network failed');
      }),
    ],
    ['4xx', vi.fn(async () => response(404, { message: 'not found' }))],
    ['5xx', vi.fn(async () => response(503, { message: 'unavailable' }))],
    ['429', vi.fn(async () => response(429, { message: 'rate limited' }))],
    [
      'timeout',
      vi.fn(async () => {
        throw new DOMException('deadline exceeded', 'TimeoutError');
      }),
    ],
    ['空响应', vi.fn(async () => response(200, { events: [] }))],
    [
      '非法 JSON',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected end of JSON input');
        },
      } as unknown as Response)),
    ],
  ])('%s 时降级为 error + null score', async (_label, fetchImpl) => {
    await renderAndEnterViewport(fetchImpl as typeof fetch);

    expect(latestState).toMatchObject({
      status: 'error',
      score: null,
    });
  });
});
