type BinaryProps = {
  variant: 'binary';
  impliedProb: number;
  fairLow: number;
  fairHigh: number;
};

type MultiProps = {
  variant: 'multi';
  rows: {
    outcome: string;
    impliedProb: number;
    fairLow: number;
    fairHigh: number;
  }[];
};

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function AILensGauge(props: BinaryProps | MultiProps) {
  if (props.variant === 'binary') return <BinaryBar {...props} />;
  return <MultiStack rows={props.rows} />;
}

function BinaryBar({ impliedProb, fairLow, fairHigh }: BinaryProps) {
  return (
    <div className="space-y-2">
      <div
        className="relative h-3 overflow-hidden rounded-full bg-bg-2"
        aria-label={`市场 ${pct(impliedProb)}，AI ${pct(fairLow)} 到 ${pct(fairHigh)}`}
      >
        <div
          className="absolute bottom-0 top-0 bg-arc-glow/30"
          style={{ left: `${fairLow * 100}%`, width: `${(fairHigh - fairLow) * 100}%` }}
          aria-hidden
        />
        <div
          className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-ink"
          style={{ left: `${impliedProb * 100}%` }}
          aria-hidden
        />
      </div>
      <div className="flex justify-between text-xs text-ink-3">
        <span>市场 {pct(impliedProb)}</span>
        <span>
          AI {pct(fairLow)}–{pct(fairHigh)}
        </span>
      </div>
    </div>
  );
}

function MultiStack({ rows }: { rows: MultiProps['rows'] }) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.outcome}>
          <div className="mb-1 flex justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-ink-2">{row.outcome}</span>
            <span className="shrink-0 text-ink-3">
              市场 {pct(row.impliedProb)} · AI {pct(row.fairLow)}–{pct(row.fairHigh)}
            </span>
          </div>
          <div
            className="relative h-2 overflow-hidden rounded-full bg-bg-2"
            aria-label={`${row.outcome}：市场 ${pct(row.impliedProb)}，AI ${pct(row.fairLow)} 到 ${pct(
              row.fairHigh,
            )}`}
          >
            <div
              className="absolute bottom-0 top-0 bg-arc-glow/30"
              style={{
                left: `${row.fairLow * 100}%`,
                width: `${(row.fairHigh - row.fairLow) * 100}%`,
              }}
              aria-hidden
            />
            <div
              className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-ink"
              style={{ left: `${row.impliedProb * 100}%` }}
              aria-hidden
            />
          </div>
        </div>
      ))}
    </div>
  );
}
