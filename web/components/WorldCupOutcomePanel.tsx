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
}: {
  label: string;
  probability: number;
  odds: number;
}) {
  return (
    <div className="rounded-[14px] border border-hair bg-canvas px-3 py-3">
      <div className="mb-2 text-sm font-semibold text-ink">{label}</div>
      <div className="mb-1 font-mono text-lg text-arc">{oddsLabel(odds)}</div>
      <div className="font-mono text-[11px] uppercase text-ink-2">
        implied {probabilityLabel(probability)}
      </div>
    </div>
  );
}

export function WorldCupOutcomePanel({
  marketType,
  outcomes,
  isMobile,
  homeTeamLabel,
}: {
  marketType: WorldCupMarketType;
  outcomes: WorldCupMarketOutcome[];
  isMobile: boolean;
  homeTeamLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (marketType === 'winner') {
    const visibleOutcomes = expanded ? (isMobile ? outcomes.slice(0, 8) : outcomes) : outcomes.slice(0, 3);
    const showExpandButton = outcomes.length > 3;
    const expandLabel = expanded
      ? '收起'
      : isMobile
        ? '查看前 8 队'
        : `查看全部 ${outcomes.length} 队`;

    return (
      <div className="mb-5">
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
            />
          ))}
        </div>
        {showExpandButton ? (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="mt-3 inline-flex rounded-full border border-hair px-4 py-2 text-sm font-medium text-ink transition hover:border-arc/30 hover:text-arc"
          >
            {expandLabel}
          </button>
        ) : null}
      </div>
    );
  }

  if (marketType === '1x2' && isMobile && !expanded) {
    const homeOutcome = outcomes[0];
    const otherProbability = outcomes.slice(1).reduce((total, outcome) => total + outcome.impliedProbability, 0);
    const otherOdds = otherProbability <= 0 ? Number.POSITIVE_INFINITY : Number((100 / otherProbability).toFixed(2));

    return (
      <div className="mb-5">
        <div className="grid grid-cols-2 gap-2">
          <OutcomeTile
            label="主队 WIN"
            probability={homeOutcome?.impliedProbability ?? 0}
            odds={homeOutcome?.odds ?? Number.POSITIVE_INFINITY}
          />
          <OutcomeTile
            label="其他"
            probability={otherProbability}
            odds={otherOdds}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-ink-2">{homeTeamLabel} 以外的结果合并展示</span>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex rounded-full border border-hair px-4 py-2 text-sm font-medium text-ink transition hover:border-arc/30 hover:text-arc"
          >
            展开
          </button>
        </div>
      </div>
    );
  }

  const gridClassName = marketType === 'spread' ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="mb-5">
      <div className={`grid ${gridClassName} gap-2`}>
        {outcomes.map((outcome) => (
          <OutcomeTile
            key={outcome.id}
            label={outcome.label}
            probability={outcome.impliedProbability}
            odds={outcome.odds}
          />
        ))}
      </div>
      {marketType === '1x2' && isMobile ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mt-3 inline-flex rounded-full border border-hair px-4 py-2 text-sm font-medium text-ink transition hover:border-arc/30 hover:text-arc"
        >
          收起
        </button>
      ) : null}
    </div>
  );
}
