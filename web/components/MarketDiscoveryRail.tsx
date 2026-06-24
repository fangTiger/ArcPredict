import React from 'react';
import Link from 'next/link';
import type { RichMarketRef, TodayBoardSelection } from '@/lib/market-richness';

type MarketDiscoveryRailProps = {
  trending: RichMarketRef[];
  closingSoon: RichMarketRef[];
  recentlyResolved: RichMarketRef[];
};

function RailItem({ market }: { market: RichMarketRef }) {
  return React.createElement(
    Link,
    {
      href: market.href,
      className:
        'block rounded-2xl border border-hair bg-bg-1/45 px-4 py-3 transition hover:border-arc-glow/40 hover:bg-bg-1/70',
    },
    React.createElement(
      'div',
      { className: 'flex items-start justify-between gap-3' },
      React.createElement(
        'div',
        { className: 'min-w-0' },
        React.createElement(
          'div',
          { className: 'font-mono text-[11px] uppercase text-arc-glow' },
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
      React.createElement('span', null, market.activityLabel),
      React.createElement('span', null, '·'),
      React.createElement('span', null, market.probabilityLabel),
    ),
  );
}

export function TodayBoard({ board }: { board: TodayBoardSelection }) {
  if (!board.hero) {
    return null;
  }

  return React.createElement(
    'section',
    { className: 'glass mb-6 rounded-3xl p-6' },
    React.createElement(
      'div',
      { className: 'mb-4 flex items-center justify-between gap-3' },
      React.createElement(
        'div',
        null,
        React.createElement(
          'div',
          { className: 'font-mono text-[11px] uppercase text-arc-glow' },
          'Today board',
        ),
        React.createElement(
          'h2',
          { className: 'mt-2 font-display text-2xl text-ink' },
          'Markets with the strongest signal right now.',
        ),
      ),
      React.createElement(
        'div',
        { className: 'rounded-full border border-hair px-3 py-1 text-[11px] uppercase text-ink-2' },
        board.hero.statusLabel,
      ),
    ),
    React.createElement(
      'div',
      { className: 'grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]' },
      React.createElement(
        Link,
        {
          href: board.hero.href,
          className:
            'rounded-[28px] border border-hair bg-[radial-gradient(circle_at_top_left,rgba(77,168,255,0.22),transparent_45%),linear-gradient(180deg,rgba(17,21,48,0.92),rgba(9,12,28,0.96))] p-5 transition hover:border-arc-glow/45 hover:shadow-[0_20px_60px_-40px_rgba(77,168,255,0.8)]',
        },
        React.createElement(
          'div',
          { className: 'flex flex-wrap items-center gap-2 text-[11px] uppercase text-ink-2' },
          React.createElement(
            'span',
            {
              className:
                'rounded-full border border-arc-glow/25 bg-arc/10 px-2.5 py-1 text-arc-glow',
            },
            board.hero.categoryLabel,
          ),
          React.createElement('span', null, board.hero.activityLabel),
        ),
        React.createElement(
          'h3',
          { className: 'mt-4 font-display text-[28px] leading-[1.12] text-ink' },
          board.hero.title,
        ),
        React.createElement(
          'p',
          { className: 'mt-3 max-w-2xl text-sm leading-6 text-ink-2' },
          `${board.hero.skewLabel}. ${board.hero.probabilityLabel}. ${board.hero.themeLabel} remains one of the busiest boards on the page.`,
        ),
        React.createElement(
          'div',
          { className: 'mt-4 flex flex-wrap gap-3 text-xs text-ink-2' },
          React.createElement('span', null, board.hero.statusLabel),
          React.createElement('span', null, '·'),
          React.createElement('span', null, board.hero.probabilityLabel),
          React.createElement('span', null, '·'),
          React.createElement('span', null, board.hero.skewLabel),
        ),
      ),
      React.createElement(
        'div',
        { className: 'grid gap-3' },
        board.secondary.map((market) => React.createElement(RailItem, { key: market.id, market })),
      ),
    ),
  );
}

export function MarketDiscoveryRail({
  trending,
  closingSoon,
  recentlyResolved,
}: MarketDiscoveryRailProps) {
  const groups = [
    { title: 'Trending now', items: trending },
    { title: 'Closing soon', items: closingSoon },
    { title: 'Recently resolved', items: recentlyResolved },
  ].filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return null;
  }

  return React.createElement(
    'section',
    { className: 'mb-8 grid gap-4 lg:grid-cols-3' },
    groups.map((group) =>
      React.createElement(
        'div',
        { key: group.title, className: 'glass rounded-3xl p-5' },
        React.createElement(
          'div',
          { className: 'flex items-center justify-between gap-3' },
          React.createElement(
            'h3',
            { className: 'font-display text-xl text-ink' },
            group.title,
          ),
          React.createElement(
            'span',
            { className: 'font-mono text-[11px] uppercase text-ink-3' },
            `${group.items.length} picks`,
          ),
        ),
        React.createElement(
          'div',
          { className: 'mt-4 space-y-3' },
          group.items.map((market) => React.createElement(RailItem, { key: market.id, market })),
        ),
      ),
    ),
  );
}
