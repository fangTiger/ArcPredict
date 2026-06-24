// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SettlementTimeline } from '../SettlementTimeline';

afterEach(() => cleanup());

describe('SettlementTimeline', () => {
  it('renders the AdminEventOracle challenge window lifecycle for event markets', () => {
    render(
      React.createElement(SettlementTimeline, {
        kind: 'event',
        resolveAfter: 1_719_417_600,
        settledOutcome: 255,
        oracleStatus: 'proposed',
        proposedAt: 1_719_158_400,
        pendingPayout: 5_000_000n,
        claimed: false,
        sourceHref: 'https://explorer.example/address/0xadmin',
        nowSeconds: 1_719_414_800,
      }),
    );

    expect(screen.getByText(/Settlement timeline/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolution Source: AdminEventOracle/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view source on explorer/i })).toHaveAttribute(
      'href',
      'https://explorer.example/address/0xadmin',
    );
    expect(screen.getByText(/^Challenge Window$/i)).toBeInTheDocument();
    expect(screen.getByText(/1h left/i)).toBeInTheDocument();
    expect(screen.getByText(/^Claimable$/i)).toBeInTheDocument();
  });

  it('renders evidence rows for event markets while keeping the explorer source link', () => {
    render(
      React.createElement(SettlementTimeline, {
        kind: 'event',
        resolveAfter: 1_719_417_600,
        settledOutcome: 255,
        oracleStatus: 'proposed',
        proposedAt: 1_719_158_400,
        pendingPayout: 0n,
        claimed: false,
        sourceHref: 'https://explorer.example/address/0xadmin',
        evidence: [
          {
            label: 'Event ID',
            value: '0x1234',
          },
          {
            label: 'Proposal tx',
            value: '0xabcd',
            href: 'https://explorer.example/tx/0xabcd',
          },
        ],
        nowSeconds: 1_719_414_800,
      }),
    );

    expect(screen.getByText(/^Evidence$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Event ID$/i)).toBeInTheDocument();
    expect(screen.getByText('0x1234')).toBeInTheDocument();
    expect(screen.getByText(/^Proposal tx$/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '0xabcd' })).toHaveAttribute(
      'href',
      'https://explorer.example/tx/0xabcd',
    );
    expect(screen.getByRole('link', { name: /view source on explorer/i })).toHaveAttribute(
      'href',
      'https://explorer.example/address/0xadmin',
    );
  });

  it('renders the Pyth invalid lifecycle for price markets', () => {
    render(
      React.createElement(SettlementTimeline, {
        kind: 'price',
        resolveAfter: 1_719_417_600,
        outcome: 3,
        pendingPayout: 0n,
        claimed: false,
        nowSeconds: 1_719_500_000,
      }),
    );

    expect(screen.getByText(/Resolution Source: Pyth/i)).toBeInTheDocument();
    expect(screen.getByText(/^Invalid$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Claimable$/i)).toBeInTheDocument();
  });
});
