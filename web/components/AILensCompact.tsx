'use client';

import { useState } from 'react';

import type { LensInput, LensOutput } from '@/lib/lens/schema';
import { AILensGauge } from './AILensGauge';

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

const minutesAgo = (lastUpdatedMs: number) =>
  Math.max(0, Math.round((Date.now() - lastUpdatedMs) / 60000));

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

      setState({ kind: 'error', message: json.message ?? 'Request failed' });
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
          aria-label="Run AI probability analysis"
        >
          ✨ Ask AI
        </button>
        <span className="text-ink-3">AI probability analysis</span>
      </div>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div className="border-t border-hair px-3 py-2 text-xs text-ink-2" role="status" aria-live="polite">
        Analyzing…
        <span className="sr-only">AI is analyzing</span>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="border-t border-hair px-3 py-2 text-xs text-no" role="alert">
        AI Lens unavailable — please retry
        <button
          type="button"
          className={`ml-2 text-arc-glow underline underline-offset-4 ${focusRingClassName}`}
          onClick={trigger}
          aria-label="Retry AI Lens"
        >
          Retry
        </button>
      </div>
    );
  }

  const out = state.output;
  const updatedMinutesAgo = minutesAgo(state.lastUpdatedMs);

  return (
    <div
      className="flex flex-col gap-3 border-t border-hair px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-wider text-ink-3">AI Lens</span>
        <button
          type="button"
          onClick={() => setState({ kind: 'idle' })}
          className={`text-xs text-arc-glow underline underline-offset-4 ${focusRingClassName}`}
        >
          Hide
        </button>
      </div>

      <p className="text-sm leading-snug text-ink">{out.summary}</p>

      {out.fair_range ? (
        <div className="my-1" data-ai-lens-gauge="binary">
          <AILensGauge
            variant="binary"
            impliedProb={input.market.implied_probability}
            fairLow={out.fair_range[0]}
            fairHigh={out.fair_range[1]}
          />
        </div>
      ) : null}

      {out.outcome_fair_probabilities ? (
        <div className="my-1" data-ai-lens-gauge="multi">
          <AILensGauge
            variant="multi"
            rows={Object.entries(out.outcome_fair_probabilities).map(([outcome, range]) => ({
              outcome,
              impliedProb:
                input.market.type === 'event-multi'
                  ? input.market.outcome_implied_probabilities[outcome] ?? 0
                  : 0,
              fairLow: range[0],
              fairHigh: range[1],
            }))}
          />
        </div>
      ) : null}

      <ul className="list-inside list-disc space-y-1 text-xs text-ink-2">
        {out.factors.slice(0, 3).map((factor, index) => (
          <li key={`${factor}-${index}`}>{factor}</li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3 text-[10px] text-ink-3">
        <span>Updated {updatedMinutesAgo}m ago</span>
        <span>Reference only — not financial advice</span>
      </div>
    </div>
  );
}
