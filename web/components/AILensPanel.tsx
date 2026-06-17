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

const DISCLAIMER =
  'AI estimate based on listed sources. Not financial advice. Not a settlement oracle.';

const focusRingClassName =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0';

const minutesAgo = (lastUpdatedMs: number) =>
  Math.max(0, Math.round((Date.now() - lastUpdatedMs) / 60000));

export function AILensPanel({ input, fetchImpl }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [whyOpen, setWhyOpen] = useState(false);
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
      <section className="glass rounded-xl p-8 text-center">
        <button
          type="button"
          onClick={trigger}
          className={`inline-flex items-center gap-2 rounded-full border border-arc-glow/40 bg-arc/20 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-arc-glow hover:bg-arc/25 ${focusRingClassName}`}
          aria-label="生成 AI Lens 概率分析"
        >
          Generate AI Lens
        </button>
        <p className="mt-3 text-xs leading-5 text-ink-3">
          AI 综合 Pyth 价格 / 市场状态 / 事实表给出公允概率区间，仅供参考、非投顾建议
        </p>
      </section>
    );
  }

  if (state.kind === 'loading') {
    return (
      <section className="glass rounded-xl p-6" role="status" aria-live="polite">
        <p className="text-sm text-ink-2">AI 正在分析…</p>
      </section>
    );
  }

  if (state.kind === 'error') {
    return (
      <section className="glass rounded-xl p-6" role="alert">
        <p className="text-sm text-no">AI Lens 暂不可用</p>
        <p className="mt-1 text-xs text-ink-3">
          请稍后重试。
        </p>
        <button
          type="button"
          onClick={trigger}
          className={`mt-3 text-xs text-arc-glow underline underline-offset-4 ${focusRingClassName}`}
          aria-label="重试 AI Lens"
        >
          重试
        </button>
      </section>
    );
  }

  const out = state.output;

  return (
    <section className="glass space-y-5 rounded-xl p-6" role="status" aria-live="polite">
      <header className="space-y-2">
        <p className="text-sm leading-6 text-ink">{out.summary}</p>
        <p className="text-[11px] text-ink-3">
          Confidence {out.confidence} · Updated {minutesAgo(state.lastUpdatedMs)}m ago
        </p>
      </header>

      <div>
        {out.fair_range ? (
          <AILensGauge
            variant="binary"
            impliedProb={input.market.implied_probability}
            fairLow={out.fair_range[0]}
            fairHigh={out.fair_range[1]}
          />
        ) : null}
        {out.outcome_fair_probabilities ? (
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
        ) : null}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {out.factors.map((factor, index) => (
          <li
            key={`${factor}-${index}`}
            className="rounded-lg border border-hair bg-bg-2/60 px-3 py-2 text-xs text-ink-2"
          >
            {factor}
          </li>
        ))}
      </ul>

      {out.sources.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {out.sources.map((source, index) => (
            <span
              key={`${source.name}-${source.ref}-${index}`}
              className="rounded-full border border-hair px-2 py-0.5 text-[11px] text-ink-3"
            >
              {source.name} · {source.ref}
            </span>
          ))}
        </div>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => setWhyOpen((value) => !value)}
          className={`text-xs text-arc-glow underline underline-offset-4 ${focusRingClassName}`}
          aria-expanded={whyOpen}
        >
          {whyOpen ? '收起 Why?' : '展开 Why?'}
        </button>
        {whyOpen ? <p className="mt-2 text-xs leading-relaxed text-ink-2">{out.reasoning}</p> : null}
      </div>

      {out.caveats.length > 0 ? (
        <ul className="list-inside list-disc text-[11px] text-ink-3">
          {out.caveats.map((caveat, index) => (
            <li key={`${caveat}-${index}`}>{caveat}</li>
          ))}
        </ul>
      ) : null}

      <footer className="border-t border-hair pt-3 text-[10px] text-ink-3">{DISCLAIMER}</footer>
    </section>
  );
}
