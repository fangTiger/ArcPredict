import type { ReactNode } from 'react';

export function BaseMarketCard({
  renderHeader,
  renderOutcomes,
  renderFooter,
  className = '',
}: {
  renderHeader: () => ReactNode;
  renderOutcomes: () => ReactNode;
  renderFooter: () => ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`group relative overflow-hidden rounded-[16px] border border-hair bg-paper p-6 shadow-[0_1px_0_rgba(10,11,15,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-arc/25 hover:shadow-[0_12px_32px_rgba(10,11,15,0.08)] ${className}`.trim()}
    >
      <svg
        className="pointer-events-none absolute right-0 top-0 h-[120px] w-[120px] opacity-60"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="120" cy="0" r="110" stroke="#1652F0" strokeOpacity="0.06" strokeWidth="1" />
        <circle cx="120" cy="0" r="80" stroke="#1652F0" strokeOpacity="0.05" strokeWidth="1" />
        <circle cx="120" cy="0" r="50" stroke="#1652F0" strokeOpacity="0.04" strokeWidth="1" />
      </svg>

      <div className="relative z-10">
        {renderHeader()}
        {renderOutcomes()}
        {renderFooter()}
      </div>
    </article>
  );
}
