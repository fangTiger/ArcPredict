import React from 'react';
import Link from 'next/link';
import type { RichMarketRef } from '@/lib/market-richness';

function RelatedMarketItem({ market }: { market: RichMarketRef }) {
  return React.createElement(
    Link,
    {
      href: market.href,
      className:
        'block rounded-xl border border-hair bg-bg-0 px-4 py-4 transition hover:border-arc/20 hover:bg-white',
    },
    React.createElement(
      'div',
      { className: 'flex items-start justify-between gap-3' },
      React.createElement(
        'div',
        { className: 'min-w-0' },
        React.createElement(
          'div',
          { className: 'font-mono text-[11px] uppercase text-ink-3' },
          market.categoryLabel,
        ),
        React.createElement(
          'div',
          { className: 'mt-2 text-sm font-medium leading-6 text-ink' },
          market.title,
        ),
      ),
      React.createElement(
        'div',
        {
          className:
            'shrink-0 rounded-full border border-hair px-2.5 py-1 text-[10px] uppercase text-ink-2',
        },
        market.statusLabel,
      ),
    ),
    React.createElement(
      'div',
      { className: 'mt-3 flex flex-wrap gap-2 text-[11px] text-ink-2' },
      React.createElement('span', null, market.probabilityLabel),
      React.createElement('span', null, '·'),
      React.createElement('span', null, market.activityLabel),
    ),
  );
}

export function RelatedMarketsPanel({ markets }: { markets: RichMarketRef[] }) {
  if (markets.length === 0) {
    return null;
  }

  return React.createElement(
    'section',
    { className: 'rounded-xl border border-hair bg-bg-1 p-5' },
    React.createElement(
      'div',
      { className: 'flex items-center justify-between gap-3' },
      React.createElement(
        'h2',
        { className: 'text-xl font-semibold text-ink' },
        'Related markets',
      ),
      React.createElement(
        'span',
        { className: 'font-mono text-[11px] uppercase text-ink-3' },
        `${markets.length} ideas`,
      ),
    ),
    React.createElement(
      'div',
      { className: 'mt-5 space-y-3' },
      markets.map((market) => React.createElement(RelatedMarketItem, { key: market.id, market })),
    ),
  );
}
