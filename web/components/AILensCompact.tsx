'use client';

import { useState } from 'react';

import type { LensInput, LensOutput } from '@/lib/lens/schema';
import { AILensDriftChip } from './AILensDriftChip';

type Props = {
  input: LensInput;
  fetchImpl?: typeof fetch;
};

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'result'; output: LensOutput; cached: boolean; lastUpdatedMs: number }
  | { kind: 'error'; message: string };

const focusRingClassName =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0';

export function AILensCompact({ input, fetchImpl }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const f = fetchImpl ?? fetch;

  const trigger = async () => {
    setState({ kind: 'loading' });
    try {
      const res = await f(`/api/lens/${encodeURIComponent(input.market.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json();

      if (json.status === 'ok') {
        setState({
          kind: 'result',
          output: json.output,
          cached: !!json.cached,
          lastUpdatedMs: json.meta?.last_updated_ms ?? Date.now(),
        });
        return;
      }

      setState({ kind: 'error', message: json.message ?? '调用失败' });
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  };

  if (state.kind === 'idle') {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-hair px-3 py-2 text-xs">
        <button
          type="button"
          onClick={trigger}
          className={`glass inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-ink transition hover:text-arc-glow ${focusRingClassName}`}
          aria-label="触发 AI 概率分析"
        >
          Ask AI
        </button>
        <span className="text-ink-3">AI 概率分析</span>
      </div>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div className="border-t border-hair px-3 py-2 text-xs text-ink-2" role="status" aria-live="polite">
        Analyzing…
        <span className="sr-only">AI 正在分析…</span>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="border-t border-hair px-3 py-2 text-xs text-no" role="alert">
        AI Lens 暂不可用，请稍后重试
        <button
          type="button"
          className={`ml-2 text-arc-glow underline underline-offset-4 ${focusRingClassName}`}
          onClick={trigger}
          aria-label="重试 AI Lens"
        >
          重试
        </button>
      </div>
    );
  }

  if (state.output.fair_range) {
    return (
      <div
        className="flex items-center justify-between gap-3 border-t border-hair px-3 py-2 text-xs"
        role="status"
        aria-live="polite"
      >
        <span className="min-w-0 truncate text-ink-2">{state.output.summary}</span>
        <span className="flex shrink-0 items-center gap-2">
          <AILensDriftChip
            impliedProb={input.market.implied_probability}
            fairLow={state.output.fair_range[0]}
            fairHigh={state.output.fair_range[1]}
          />
        </span>
      </div>
    );
  }

  return (
    <div className="border-t border-hair px-3 py-2 text-xs text-ink-2" role="status" aria-live="polite">
      <span className="flex items-center justify-between gap-3">
        <span className="line-clamp-1">{state.output.summary}</span>
      </span>
    </div>
  );
}
