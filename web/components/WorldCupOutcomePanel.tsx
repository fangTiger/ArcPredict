'use client';

import { useState } from 'react';
import type {
  WorldCupMarketOutcome,
  WorldCupMarketType,
} from '@/lib/worldcup-markets';

function probabilityLabel(value: number): string {
  return `${value.toFixed(1)}%`;
}

function oddsLabel(value: number): string {
  if (!Number.isFinite(value)) {
    return '∞';
  }

  return `${value.toFixed(2)}x`;
}

function OutcomeTile({
  label,
  probability,
  odds,
  onSelect,
  bettingOpen = false,
}: {
  label: string;
  probability: number;
  odds: number;
  onSelect?: () => void;
  bettingOpen?: boolean;
}) {
  const content = (
    <>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-ink">{label}</div>
        {onSelect ? (
          <span className="rounded-full border border-hair bg-bg-2 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-2">
            {bettingOpen ? 'Bet' : 'Closed'}
          </span>
        ) : null}
      </div>
      <div className="mb-1 font-mono text-lg text-ink">{oddsLabel(odds)}</div>
      <div className="font-mono text-[11px] uppercase text-ink-2">
        implied {probabilityLabel(probability)}
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={onSelect}
        disabled={!bettingOpen}
        className="rounded-xl border border-hair bg-bg-0 px-3 py-3 text-left transition hover:border-arc/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-hair bg-bg-0 px-3 py-3">
      {content}
    </div>
  );
}

export function WorldCupOutcomePanel({
  marketType,
  outcomes,
  isMobile,
  homeTeamLabel,
  onSelectOutcome,
  bettingOpen = false,
}: {
  marketType: WorldCupMarketType;
  outcomes: WorldCupMarketOutcome[];
  isMobile: boolean;
  homeTeamLabel: string;
  onSelectOutcome?: (outcomeIndex: number) => void;
  bettingOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (marketType === 'winner') {
    const visibleOutcomes = expanded ? (isMobile ? outcomes.slice(0, 8) : outcomes) : outcomes.slice(0, 3);
    const showExpandButton = outcomes.length > 3;
    const expandLabel = expanded
      ? 'Collapse'
      : isMobile
        ? 'Show top 8'
        : `Show all ${outcomes.length} teams`;

    return (
      <div className="rounded-xl border border-hair bg-bg-1 p-4">
        <div
          className={`grid gap-2 ${expanded ? 'grid-cols-2' : 'grid-cols-1'} ${expanded && isMobile ? 'max-h-80 overflow-y-auto pr-1' : ''}`}
          data-scrollable-outcomes={expanded && isMobile ? 'true' : undefined}
        >
          {visibleOutcomes.map((outcome) => (
            <OutcomeTile
              key={outcome.id}
              label={outcome.label}
              probability={outcome.impliedProbability}
              odds={outcome.odds}
              onSelect={
                onSelectOutcome
                  ? () => onSelectOutcome(outcomes.indexOf(outcome))
                  : undefined
              }
              bettingOpen={bettingOpen}
            />
          ))}
        </div>
        {showExpandButton ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="mt-3 inline-flex rounded-full border border-hair bg-bg-0 px-4 py-2 text-sm font-medium text-ink transition hover:border-arc/20 hover:text-arc focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0"
          >
            {expandLabel}
          </button>
        ) : null}
      </div>
    );
  }

  if (marketType === '1x2' && isMobile && !expanded && !onSelectOutcome) {
    const homeOutcome = outcomes[0];
    const otherProbability = outcomes.slice(1).reduce((total, outcome) => total + outcome.impliedProbability, 0);
    const otherOdds = otherProbability <= 0 ? Number.POSITIVE_INFINITY : Number((100 / otherProbability).toFixed(2));

    return (
      <div className="rounded-xl border border-hair bg-bg-1 p-4">
        <div className="grid grid-cols-2 gap-2">
          <OutcomeTile
            label="Home Win"
            probability={homeOutcome?.impliedProbability ?? 0}
            odds={homeOutcome?.odds ?? Number.POSITIVE_INFINITY}
          />
          <OutcomeTile
            label="Other outcomes"
            probability={otherProbability}
            odds={otherOdds}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-ink-2">Non-{homeTeamLabel} outcomes are grouped for scanning.</span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex rounded-full border border-hair bg-bg-0 px-4 py-2 text-sm font-medium text-ink transition hover:border-arc/20 hover:text-arc focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0"
          >
            Expand
          </button>
        </div>
      </div>
    );
  }

  const gridClassName = marketType === 'spread' || marketType === 'totals' ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="rounded-xl border border-hair bg-bg-1 p-4">
      <div className={`grid ${gridClassName} gap-2`}>
        {outcomes.map((outcome, outcomeIndex) => (
          <OutcomeTile
            key={outcome.id}
            label={outcome.label}
            probability={outcome.impliedProbability}
            odds={outcome.odds}
            onSelect={
              onSelectOutcome
                ? () => onSelectOutcome(outcomeIndex)
                : undefined
            }
            bettingOpen={bettingOpen}
          />
        ))}
      </div>
      {marketType === '1x2' && isMobile ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 inline-flex rounded-full border border-hair bg-bg-0 px-4 py-2 text-sm font-medium text-ink transition hover:border-arc/20 hover:text-arc focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0"
        >
          Collapse
        </button>
      ) : null}
    </div>
  );
}
