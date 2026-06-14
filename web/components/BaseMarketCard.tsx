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
      className={`group relative overflow-hidden rounded-3xl glass glass-hover p-6 hover:-translate-y-0.5 ${className}`.trim()}
    >
      {/* 右上装饰渐变同心圆（代替旧蓝色描边） */}
      <svg
        className="pointer-events-none absolute right-0 top-0 h-[120px] w-[120px] opacity-70"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="bmc-gradient" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4DA8FF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6D5BFF" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="0" r="110" stroke="url(#bmc-gradient)" strokeWidth="1" />
        <circle cx="120" cy="0" r="80" stroke="url(#bmc-gradient)" strokeWidth="1" />
        <circle cx="120" cy="0" r="50" stroke="url(#bmc-gradient)" strokeWidth="1" />
      </svg>

      <div className="relative z-10">
        {renderHeader()}
        {renderOutcomes()}
        {renderFooter()}
      </div>
    </article>
  );
}
