import React from 'react';
import Link from 'next/link';
import type { ThemePack } from '../lib/themes';
import type { ThemeMarketBoardEntry } from '../lib/themes/markets';
import { MarketCategoryIcon } from './MarketCategoryIcon';

function categoryFromLabel(label: string) {
  if (label === 'Macro') {
    return 'macro' as const;
  }

  if (label === 'On-chain') {
    return 'chain' as const;
  }

  if (label === 'World Cup') {
    return 'worldcup' as const;
  }

  return 'crypto' as const;
}

function leadCategoryLabel(theme: ThemePack): string {
  if (theme.leadCategory === 'chain') {
    return 'On-chain';
  }

  if (theme.leadCategory === 'macro') {
    return 'Macro';
  }

  if (theme.leadCategory === 'worldcup') {
    return 'World Cup';
  }

  return 'Crypto';
}

function marketCountLabel(count: number): string {
  return `${count} live market${count === 1 ? '' : 's'}`;
}

function renderMarket(market: ThemeMarketBoardEntry) {
  return React.createElement(
    Link,
    {
      key: market.id,
      href: market.href,
      className:
        'rounded-[26px] border border-hair bg-bg-1/45 px-4 py-4 transition hover:border-arc-glow/40 hover:bg-bg-1/70',
    },
    React.createElement(
      'div',
      { className: 'flex items-center justify-between gap-3' },
      React.createElement(
        'div',
        { className: 'inline-flex items-center gap-2' },
        React.createElement(MarketCategoryIcon, {
          category: categoryFromLabel(market.categoryLabel),
          label: market.categoryLabel,
          size: 'sm',
        }),
        React.createElement(
          'span',
          { className: 'font-mono text-[11px] uppercase text-arc-glow' },
          market.categoryLabel,
        ),
      ),
      React.createElement(
        'span',
        {
          className:
            'rounded-full border border-hair px-2.5 py-1 text-[10px] uppercase text-ink-2',
        },
        market.statusLabel,
      ),
    ),
    React.createElement(
      'div',
      { className: 'mt-4 text-base font-medium leading-7 text-ink' },
      market.title,
    ),
  );
}

export function ThemeMarketBoard({
  theme,
  markets,
}: {
  theme: ThemePack;
  markets: ThemeMarketBoardEntry[];
}) {
  const leadLabel = leadCategoryLabel(theme);

  return React.createElement(
    'section',
    { className: 'glass rounded-3xl p-6' },
    React.createElement(
      'div',
      { className: 'grid gap-4 border-b border-hair pb-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]' },
      React.createElement(
        'div',
        {
          className:
            'rounded-[28px] border border-hair bg-[radial-gradient(circle_at_top_left,rgba(97,255,189,0.14),transparent_40%),linear-gradient(180deg,rgba(14,18,41,0.95),rgba(7,10,25,0.98))] px-5 py-5',
        },
        React.createElement(
          'div',
          { className: 'flex items-start gap-3' },
          React.createElement(MarketCategoryIcon, { category: 'theme' }),
          React.createElement(
            'div',
            { className: 'min-w-0' },
            React.createElement(
              'div',
              { className: 'font-mono text-[11px] uppercase text-arc-glow' },
              'This week on ArcPredict',
            ),
            React.createElement(
              'h2',
              { className: 'mt-2 font-display text-3xl text-ink' },
              theme.title,
            ),
            React.createElement(
              'p',
              { className: 'mt-3 max-w-2xl text-sm leading-6 text-ink-2' },
              theme.description,
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'mt-4 flex flex-wrap gap-2 text-[11px] text-ink-2' },
          React.createElement(
            'span',
            { className: 'rounded-full border border-hair px-2.5 py-1 uppercase text-ink-2' },
            `${theme.status} pack`,
          ),
          React.createElement(
            'span',
            {
              className:
                'rounded-full border border-arc-glow/25 bg-arc/10 px-2.5 py-1 uppercase text-arc-glow',
            },
            leadLabel,
          ),
          React.createElement(
            'span',
            { className: 'rounded-full border border-hair px-2.5 py-1 uppercase text-ink-2' },
            marketCountLabel(markets.length),
          ),
        ),
      ),
      React.createElement(
        'div',
        { className: 'rounded-[28px] border border-hair bg-bg-1/45 px-5 py-5' },
        React.createElement(
          'div',
          { className: 'font-mono text-[11px] uppercase text-ink-3' },
          'Pack note',
        ),
        React.createElement(
          'p',
          { className: 'mt-3 text-sm leading-6 text-ink-2' },
          theme.shareCopy,
        ),
        React.createElement(
          Link,
          {
            href: `/theme/${theme.themeId}`,
            className:
              'mt-5 inline-flex rounded-full border border-arc-glow/35 bg-arc/10 px-4 py-2 text-sm text-arc-glow transition hover:border-arc-glow/55 hover:bg-arc/15 hover:text-ink',
          },
          'Open theme page',
        ),
      ),
    ),
    markets.length === 0
      ? React.createElement(
          'div',
          {
            className:
              'mt-5 rounded-[26px] border border-dashed border-hair px-4 py-5 text-sm text-ink-2',
          },
          'Theme pack is live. New markets land here as they open.',
        )
      : React.createElement(
          'div',
          { className: 'mt-5 grid gap-3 lg:grid-cols-2' },
          markets.map(renderMarket),
        ),
  );
}
