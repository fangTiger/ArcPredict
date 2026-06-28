// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ThemePack } from '../../lib/themes';
import { ThemeMarketBoard } from '../ThemeMarketBoard';

const theme: ThemePack = {
  themeId: 'arc-summer-onchain',
  title: 'On-chain Summer Watch',
  description: 'Track weekly TVL milestones and liquidity rotation across core chains.',
  weekStart: '2026-06-22',
  weekEnd: '2026-06-28',
  leadCategory: 'chain',
  shareCopy: 'Follow the on-chain momentum pack on ArcPredict.',
  refs: [{ kind: 'category', category: 'chain', sourceId: 'chain-event' }],
  status: 'active',
};

function makeMarket(id: string, title: string) {
  return {
    id,
    href: `/market/${id}?kind=event`,
    title,
    categoryLabel: 'On-chain',
    statusLabel: 'Open market',
  };
}

describe('ThemeMarketBoard', () => {
  it('renders a lead theme section and direct market links when markets are available', () => {
    render(
      React.createElement(ThemeMarketBoard, {
        theme,
        markets: [
          {
            id: '77',
            href: '/market/77?kind=event',
            title: 'Will Ethereum TVL be >= $210.00B by 2026-09-22?',
            categoryLabel: 'On-chain',
            statusLabel: 'Open market',
          },
        ],
      }),
    );

    expect(screen.getByText(theme.title)).toBeInTheDocument();
    expect(screen.getByText(theme.description)).toBeInTheDocument();
    expect(screen.getByLabelText(/Weekly Theme Pack icon/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/On-chain icon/i)).toBeInTheDocument();
    expect(screen.getByText(/This week on ArcPredict/i)).toBeInTheDocument();
    expect(screen.getByText(/1 live market/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open theme page/i })).toHaveAttribute(
      'href',
      '/theme/arc-summer-onchain',
    );
    expect(screen.getByRole('link', { name: /will ethereum tvl/i })).toHaveAttribute(
      'href',
      '/market/77?kind=event',
    );
    expect(screen.getByText(/Open market/i)).toBeInTheDocument();
  });

  it('renders a graceful empty state when no pack markets are available yet', () => {
    render(React.createElement(ThemeMarketBoard, { theme, markets: [] }));

    expect(
      screen.getByText(/Theme pack is live\. New markets land here as they open\./i),
    ).toBeInTheDocument();
  });

  it('keeps the homepage preview short and links to the full theme page', () => {
    render(
      React.createElement(ThemeMarketBoard, {
        theme,
        markets: [
          makeMarket('77', 'Will Ethereum TVL be >= $210.00B by 2026-09-22?'),
          makeMarket('78', 'Will Ethereum TVL be >= $220.00B by 2026-09-23?'),
          makeMarket('79', 'Will Ethereum TVL be >= $230.00B by 2026-09-24?'),
          makeMarket('80', 'Will Arbitrum TVL be >= $18.00B by 2026-09-25?'),
          makeMarket('81', 'Will Arbitrum TVL be >= $20.00B by 2026-09-26?'),
        ],
        variant: 'preview',
      }),
    );

    expect(screen.getByText(/Showing 3 of 5/i)).toBeInTheDocument();
    expect(screen.getByText(/Will Ethereum TVL be >= \$230\.00B/i)).toBeInTheDocument();
    expect(screen.queryByText(/Will Arbitrum TVL be >= \$18\.00B/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View all 5 markets/i })).toHaveAttribute(
      'href',
      '/theme/arc-summer-onchain',
    );
  });
});
