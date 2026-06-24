// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RichMarketRef } from '../../lib/market-richness';
import { MarketDiscoveryRail, TodayBoard } from '../MarketDiscoveryRail';

function makeRef(overrides: Partial<RichMarketRef> = {}): RichMarketRef {
  return {
    id: '11',
    marketKind: 'price',
    category: 'crypto',
    href: '/market/11',
    title: 'Will BTC/USD be >= $105,000 by 2026-09-22?',
    question: 'Will BTC/USD be >= $105,000 by 2026-09-22?',
    themeLabel: 'BTC',
    categoryLabel: 'Crypto',
    deadline: 1_700_003_600n,
    liquidity: 100_000_000n,
    probabilityValue: 72,
    probabilityLabel: 'YES 72%',
    skewLabel: 'Pool skew YES 72%',
    status: 'open',
    statusLabel: 'Closing soon',
    activityLabel: 'Position live',
    hasPosition: true,
    isOpen: true,
    isClosingSoon: true,
    isSettled: false,
    isClaimable: false,
    topicKey: 'btc',
    ...overrides,
  };
}

describe('MarketDiscoveryRail', () => {
  it('renders a today board hero, supporting links, and grouped discovery lists', () => {
    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(TodayBoard, {
          board: {
            hero: makeRef(),
            secondary: [
              makeRef({
                id: '12',
                href: '/market/12?kind=event',
                title: 'Will Ethereum TVL be >= $210.00B by 2026-09-22?',
                category: 'chain',
                categoryLabel: 'On-chain',
                themeLabel: 'On-chain',
                probabilityLabel: 'Top outcome 61%',
                skewLabel: 'Leading outcome Yes',
                activityLabel: 'Theme spotlight',
              }),
            ],
          },
        }),
        React.createElement(MarketDiscoveryRail, {
          trending: [makeRef({ id: '13', title: 'Trending market', href: '/market/13' })],
          closingSoon: [makeRef({ id: '14', title: 'Closing market', href: '/market/14' })],
          recentlyResolved: [
            makeRef({
              id: '15',
              title: 'Claimable market',
              href: '/market/15',
              status: 'claimable',
              statusLabel: 'Claimable now',
              isOpen: false,
              isSettled: true,
              isClaimable: true,
            }),
          ],
        }),
      ),
    );

    expect(screen.getByText(/Today board/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Will BTC\/USD/i })).toHaveAttribute('href', '/market/11');
    expect(screen.getByText(/Theme spotlight/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Trending now/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Closing soon/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Recently resolved/i })).toBeInTheDocument();
    expect(screen.getByText(/Claimable now/i)).toBeInTheDocument();
  });
});
