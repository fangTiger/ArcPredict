'use client';

import type { WorldCupMarketOutcome, WorldCupMarketRow } from '@/lib/worldcup-markets';

const CHART_WIDTH = 120;
const CHART_HEIGHT = 36;
const OUTCOME_COLORS = [
  '#1652F0',
  '#0F9D58',
  '#E37400',
  '#A142F4',
  '#C5221F',
  '#00897B',
] as const;

function clampProbability(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function buildCurvePoints(
  outcome: Pick<WorldCupMarketOutcome, 'openingProbability' | 'impliedProbability'>,
): string {
  const openingProbability = clampProbability(outcome.openingProbability);
  const impliedProbability = clampProbability(outcome.impliedProbability);
  const midProbability = (openingProbability + impliedProbability) / 2;
  const curve = [
    { x: 0, y: openingProbability },
    { x: CHART_WIDTH * 0.35, y: (openingProbability * 0.7) + (midProbability * 0.3) },
    { x: CHART_WIDTH * 0.7, y: (midProbability * 0.4) + (impliedProbability * 0.6) },
    { x: CHART_WIDTH, y: impliedProbability },
  ];

  return curve
    .map(({ x, y }) => `${x},${(1 - (y / 100)) * CHART_HEIGHT}`)
    .join(' ');
}

function formatProbability(value: number): string {
  return `${value.toFixed(1)}%`;
}

function deltaLabel(
  outcome: Pick<WorldCupMarketOutcome, 'openingProbability' | 'impliedProbability'>,
): string {
  const delta = outcome.impliedProbability - outcome.openingProbability;

  if (Math.abs(delta) < 0.05) {
    return 'flat';
  }

  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pts`;
}

export function ImpliedProbabilityChart({ row }: { row: WorldCupMarketRow }) {
  const rankedOutcomes = [...row.outcomes].sort(
    (left, right) => right.impliedProbability - left.impliedProbability,
  );

  return (
    <section className="rounded-[18px] border border-hair bg-paper p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-arc">Implied Probability</div>
          <h3 className="mt-2 text-lg font-semibold text-ink">Outcome Trend</h3>
        </div>
        <div className="text-xs text-ink-2">opening vs current pool ratio</div>
      </div>

      <div className="space-y-3">
        {rankedOutcomes.map((outcome, index) => {
          const accent = OUTCOME_COLORS[index % OUTCOME_COLORS.length];
          const polyline = buildCurvePoints(outcome);

          return (
            <article
              key={outcome.id}
              className="grid gap-3 rounded-[14px] border border-hair bg-canvas px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="text-xs text-ink-2">Outcome {index + 1}</div>
                <div className="truncate text-sm font-medium text-ink">{outcome.label}</div>
              </div>

              <div className="min-w-0">
                <svg
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                  className="h-10 w-full overflow-visible"
                  aria-label={`${outcome.label} implied probability curve`}
                  role="img"
                >
                  <line
                    x1="0"
                    y1={CHART_HEIGHT}
                    x2={CHART_WIDTH}
                    y2={CHART_HEIGHT}
                    stroke="#D5D7DE"
                    strokeDasharray="3 3"
                  />
                  <polyline
                    fill="none"
                    stroke={accent}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    points={polyline}
                  />
                </svg>
              </div>

              <div className="text-left md:text-right">
                <div className="font-mono text-sm text-ink">
                  {formatProbability(outcome.impliedProbability)}
                </div>
                <div className="text-xs text-ink-2">
                  {formatProbability(outcome.openingProbability)} → {deltaLabel(outcome)}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
