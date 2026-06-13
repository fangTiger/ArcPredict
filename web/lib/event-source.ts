'use client';

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';

import { sportsDbEventIdForMatch } from './worldcup-seed';

export type LiveScore = {
  home: number | null;
  away: number | null;
  label: string | null;
};

export type LiveScoreSuccess = {
  status: 'success';
  score: LiveScore;
  ts: number;
};

export type LiveScoreError = {
  status: 'error';
  score: null;
  ts: number;
};

export type LiveScoreState =
  | LiveScoreSuccess
  | LiveScoreError
  | {
      status: 'idle' | 'loading';
      score: LiveScore | null;
      ts: number | null;
    };

export type UseLiveScoreOptions = {
  containerRef: RefObject<Element | null>;
  matchInProgress: boolean;
};

type FetchLike = typeof fetch;
type CacheEntry = LiveScoreSuccess;

export const DEFAULT_SPORTSDB_API_BASE =
  'https://www.thesportsdb.com/api/v1/json/123' as const;
export const SPORTSDB_API_BASE =
  process.env.NEXT_PUBLIC_SPORTSDB_API_BASE ??
  process.env.SPORTSDB_API_BASE ??
  DEFAULT_SPORTSDB_API_BASE;
export const POLL_INTERVAL_MS = 60_000;
export const LIVE_SCORE_CACHE_TTL_MS = 60_000;

const liveScoreCache = new Map<string, CacheEntry>();
const activeInstances = new Map<string, number>();
const DEV_SCORE_API_BASE_QUERY = 'wcScoreApiBase';
const DEV_ACTIVE_MATCH_QUERY = 'wcLiveScoreFixture';

function normalizeApiBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/u, '');
}

function readDevQueryParam(name: string): string | null {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get(name)?.trim();
  return value ? value : null;
}

function resolveSportsDbApiBase(): string {
  const override = readDevQueryParam(DEV_SCORE_API_BASE_QUERY);
  if (!override) {
    return SPORTSDB_API_BASE;
  }

  try {
    return normalizeApiBase(new URL(override, window.location.origin).toString());
  } catch {
    return SPORTSDB_API_BASE;
  }
}

function isDevLiveScoreFixtureEnabled(matchId: string): boolean {
  const target = readDevQueryParam(DEV_ACTIVE_MATCH_QUERY);
  if (!target || !matchId) {
    return false;
  }

  return target === '1' || target === 'all' || target === matchId;
}

function toScoreValue(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseScorePayload(payload: unknown): LiveScore {
  const events = Array.isArray((payload as { events?: unknown[] })?.events)
    ? (payload as { events: Record<string, unknown>[] }).events
    : [];
  const current = events[0] ?? {};

  return {
    home: toScoreValue(current.intHomeScore),
    away: toScoreValue(current.intAwayScore),
    label:
      typeof current.strStatus === 'string'
        ? current.strStatus
        : typeof current.strProgress === 'string'
          ? current.strProgress
          : null,
  };
}

export function resolveSportsDbEventId(matchId: string): string | null {
  return sportsDbEventIdForMatch(matchId);
}

export function buildSportsDbEventUrlForProviderId(providerEventId: string): string {
  return `${resolveSportsDbApiBase()}/lookupevent.php?id=${encodeURIComponent(providerEventId)}`;
}

export function buildSportsDbEventUrl(matchId: string): string | null {
  const providerEventId = resolveSportsDbEventId(matchId);
  return providerEventId ? buildSportsDbEventUrlForProviderId(providerEventId) : null;
}

export function readLiveScoreCache(
  matchId: string,
  now = Date.now(),
): CacheEntry | null {
  const cached = liveScoreCache.get(matchId);
  if (!cached) {
    return null;
  }

  if (now - cached.ts >= LIVE_SCORE_CACHE_TTL_MS) {
    liveScoreCache.delete(matchId);
    return null;
  }

  return cached;
}

export function writeLiveScoreCache(matchId: string, entry: CacheEntry): void {
  liveScoreCache.set(matchId, entry);
}

export function clearLiveScoreCache(): void {
  liveScoreCache.clear();
}

async function requestLiveScore(
  matchId: string,
  fetchImpl: FetchLike,
  now = Date.now(),
  opts: { forceRefresh?: boolean } = {},
): Promise<LiveScoreSuccess | LiveScoreError> {
  if (!opts.forceRefresh) {
    const cached = readLiveScoreCache(matchId, now);
    if (cached) {
      return cached;
    }
  }

  const providerEventId = resolveSportsDbEventId(matchId);
  if (!providerEventId) {
    return { status: 'error', score: null, ts: now };
  }

  try {
    const response = await fetchImpl(
      buildSportsDbEventUrlForProviderId(providerEventId),
    );
    if (!response.ok) {
      return { status: 'error', score: null, ts: now };
    }

    const payload = await response.json();
    const next: LiveScoreSuccess = {
      status: 'success',
      score: parseScorePayload(payload),
      ts: now,
    };

    writeLiveScoreCache(matchId, next);
    return next;
  } catch {
    return { status: 'error', score: null, ts: now };
  }
}

function devWarnMultipleInstances(matchId: string): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const count = (activeInstances.get(matchId) ?? 0) + 1;
  activeInstances.set(matchId, count);

  if (count > 1) {
    console.warn(`[useLiveScore] 同一 matchId 存在多个并发实例: ${matchId}`);
  }
}

function releaseInstance(matchId: string): void {
  const current = activeInstances.get(matchId);
  if (!current) {
    return;
  }

  if (current === 1) {
    activeInstances.delete(matchId);
    return;
  }

  activeInstances.set(matchId, current - 1);
}

export function useLiveScore(
  matchId: string,
  opts: UseLiveScoreOptions,
): LiveScoreState {
  const matchInProgress =
    opts.matchInProgress || isDevLiveScoreFixtureEnabled(matchId);
  const [state, setState] = useState<LiveScoreState>(() => {
    const cached = readLiveScoreCache(matchId);
    return cached ?? { status: 'idle', score: null, ts: null };
  });
  const [isVisible, setIsVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  const [isInView, setIsInView] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasActivatedRef = useRef(false);

  useEffect(() => {
    devWarnMultipleInstances(matchId);
    return () => {
      releaseInstance(matchId);
    };
  }, [matchId]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const onVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    hasActivatedRef.current = false;
  }, [matchId]);

  useEffect(() => {
    const target = opts.containerRef.current;
    if (!target) {
      setIsInView(false);
      return undefined;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      setIsInView(entry?.isIntersecting === true);
    });

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [opts.containerRef, matchId]);

  useEffect(() => {
    if (intervalRef.current != null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!matchInProgress || !isVisible || !isInView) {
      return undefined;
    }

    let cancelled = false;

    const refresh = async () => {
      if (cancelled || typeof fetch !== 'function') {
        return;
      }

      setState((current) =>
        current.status === 'success'
          ? current
          : { status: 'loading', score: current.score, ts: current.ts },
      );

      const next = await requestLiveScore(matchId, fetch, Date.now());
      if (!cancelled) {
        setState(next);
      }
    };

    const refreshNow = async (forceRefresh: boolean) => {
      if (cancelled || typeof fetch !== 'function') {
        return;
      }

      const next = await requestLiveScore(matchId, fetch, Date.now(), {
        forceRefresh,
      });
      if (!cancelled) {
        setState(next);
      }
    };

    const cached = readLiveScoreCache(matchId);
    if (cached) {
      setState(cached);
    }

    const forceRefresh = hasActivatedRef.current;
    hasActivatedRef.current = true;
    void refreshNow(forceRefresh);
    intervalRef.current = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isInView, isVisible, matchId, matchInProgress]);

  return state;
}
