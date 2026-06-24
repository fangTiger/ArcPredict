// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityTimeline } from '../ActivityTimeline';
import { MarketStoryPanel } from '../MarketStoryPanel';
import { RelatedMarketsPanel } from '../RelatedMarketsPanel';

describe('rich market detail panels', () => {
  it('renders story sections, related markets, and activity items', () => {
    render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(MarketStoryPanel, {
          story: {
            eyebrow: 'On-chain flow',
            whyItMatters: 'This on-chain market tracks whether liquidity can hold.',
            whatMovesIt: 'liquidity migration and bridge demand move the board.',
            whatToWatch: 'Watch the deadline and whether the lead outcome holds.',
          },
        }),
        React.createElement(RelatedMarketsPanel, {
          markets: [
            {
              id: '88',
              marketKind: 'event',
              category: 'chain',
              href: '/market/88?kind=event',
              title: 'Will Arbitrum TVL be >= $11.00B by 2026-09-22?',
              question: 'Will Arbitrum TVL be >= $11.00B by 2026-09-22?',
              themeLabel: 'On-chain',
              categoryLabel: 'On-chain',
              deadline: 1_700_100_000n,
              liquidity: 120_000_000n,
              probabilityValue: 58,
              probabilityLabel: 'Top outcome 58%',
              skewLabel: 'Leading outcome Yes',
              status: 'open',
              statusLabel: 'Open market',
              activityLabel: 'Theme spotlight',
              hasPosition: false,
              isOpen: true,
              isClosingSoon: false,
              isSettled: false,
              isClaimable: false,
              topicKey: 'arbitrum tvl',
            },
          ],
        }),
        React.createElement(ActivityTimeline, {
          items: [
            {
              id: 'bet-close',
              label: 'Betting closes',
              detail: 'Watch the deadline for the final price lock.',
            },
            {
              id: 'claim-window',
              label: 'Claim window',
              detail: 'Payout becomes claimable after settlement finalizes.',
            },
          ],
        }),
      ),
    );

    expect(screen.getByText(/Why it matters/i)).toBeInTheDocument();
    expect(screen.getByText(/What moves it/i)).toBeInTheDocument();
    expect(screen.getByText(/What to watch/i)).toBeInTheDocument();
    expect(screen.getByText(/Related markets/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Will Arbitrum TVL/i })).toHaveAttribute(
      'href',
      '/market/88?kind=event',
    );
    expect(screen.getByText(/Activity timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Betting closes/i)).toBeInTheDocument();
    expect(screen.getByText(/Claim window/i)).toBeInTheDocument();
  });
});
