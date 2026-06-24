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

describe('ThemeMarketBoard', () => {
  it('renders a share entry and direct market links when markets are available', () => {
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
    expect(screen.getByRole('link', { name: /share theme/i })).toHaveAttribute(
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

    expect(screen.getByText(/No markets are live in this pack yet\./i)).toBeInTheDocument();
  });
});
