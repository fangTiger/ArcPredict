import type { ReactNode } from 'react';

export function BaseMarketCard({
  renderHeader,
  renderOutcomes,
  renderFooter,
  footerSlot,
  className = '',
}: {
  renderHeader: () => ReactNode;
  renderOutcomes: () => ReactNode;
  renderFooter: () => ReactNode;
  footerSlot?: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`group rounded-xl border border-hair bg-bg-1 p-4 shadow-[0_16px_30px_-24px_rgba(15,23,42,0.12)] ${className}`.trim()}
    >
      {renderHeader()}
      {renderOutcomes()}
      {renderFooter()}
      {footerSlot ? <div className="-mx-4 mt-4">{footerSlot}</div> : null}
    </article>
  );
}
