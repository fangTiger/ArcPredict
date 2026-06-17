type Props = {
  impliedProb: number;
  fairLow: number;
  fairHigh: number;
  threshold?: number;
};

const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function AILensDriftChip({ impliedProb, fairLow, fairHigh, threshold = 0.05 }: Props) {
  const fairMid = (fairLow + fairHigh) / 2;
  const gap = impliedProb - fairMid;
  let label: string;
  let color: string;

  if (Math.abs(gap) < threshold) {
    label = '≈ aligned';
    color = 'text-ink-3 !border-hair';
  } else if (gap > 0) {
    label = '↑ rich';
    color = 'text-heat !border-heat/40';
  } else {
    label = '↓ cheap';
    color = 'text-arc-glow !border-arc-glow/40';
  }

  return (
    <span
      className={`glass inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${color}`}
      role="status"
      aria-label={`Market ${pct(impliedProb)}, AI ${pct(fairLow)}–${pct(fairHigh)}, ${label}`}
    >
      <span>Market {pct(impliedProb)}</span>
      <span className="opacity-40">/</span>
      <span>
        AI {pct(fairLow)}–{pct(fairHigh)}
      </span>
      <span className="ml-1">{label}</span>
    </span>
  );
}
