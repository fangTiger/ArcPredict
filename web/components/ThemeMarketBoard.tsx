import React from 'react';
import type { ThemePack } from '../lib/themes';
import type { ThemeMarketBoardEntry } from '../lib/themes/markets';

function renderMarket(market: ThemeMarketBoardEntry) {
  return React.createElement(
    'a',
    {
      key: market.id,
      href: market.href,
      className:
        'rounded-2xl border border-hair bg-bg-1/50 px-4 py-4 transition hover:border-arc-glow/40 hover:bg-bg-1/70',
    },
    React.createElement(
      'div',
      { className: 'flex items-center justify-between gap-3' },
      React.createElement(
        'span',
        { className: 'font-mono text-[11px] uppercase text-arc-glow' },
        market.categoryLabel,
      ),
      React.createElement(
        'span',
        { className: 'text-xs text-ink-2' },
        market.statusLabel,
      ),
    ),
    React.createElement(
      'div',
      { className: 'mt-3 text-base font-medium leading-7 text-ink' },
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
  return React.createElement(
    'section',
    { className: 'glass rounded-3xl p-6' },
    React.createElement(
      'div',
      {
        className:
          'flex flex-col gap-4 border-b border-hair pb-4 sm:flex-row sm:items-start sm:justify-between',
      },
      React.createElement(
        'div',
        { className: 'max-w-2xl' },
        React.createElement(
          'div',
          { className: 'text-xs uppercase text-arc-glow' },
          'Weekly Theme Pack',
        ),
        React.createElement(
          'h2',
          { className: 'mt-2 font-display text-3xl text-ink' },
          theme.title,
        ),
        React.createElement(
          'p',
          { className: 'mt-2 text-sm leading-6 text-ink-2' },
          theme.description,
        ),
      ),
      React.createElement(
        'div',
        { className: 'flex flex-col items-start gap-2 sm:items-end' },
        React.createElement(
          'span',
          {
            className:
              'rounded-full border border-hair px-3 py-1 text-[11px] uppercase text-ink-2',
          },
          theme.status,
        ),
        React.createElement(
          'a',
          {
            href: `/theme/${theme.themeId}`,
            className: 'text-sm text-arc-glow transition hover:text-ink',
          },
          'Share theme',
        ),
      ),
    ),
    markets.length === 0
      ? React.createElement(
          'div',
          {
            className:
              'mt-5 rounded-2xl border border-dashed border-hair px-4 py-5 text-sm text-ink-2',
          },
          'No markets are live in this pack yet.',
        )
      : React.createElement(
          'div',
          { className: 'mt-5 grid gap-3 lg:grid-cols-2' },
          markets.map(renderMarket),
        ),
    React.createElement(
      'p',
      { className: 'mt-4 text-xs text-ink-2' },
      theme.shareCopy,
    ),
  );
}
