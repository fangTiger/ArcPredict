import { describe, expect, it } from 'vitest';
import { computeMarketId } from '../../lib/markets/external-key';
import {
  getThemePackById,
  getThemePackForDraft,
  listThemePacks,
  type ThemePack,
} from '../../lib/themes';
import { getThemePackMarkets, toThemeMarketBoardEntries } from '../../lib/themes/markets';
import { resolveWorldCupMarkets } from '../../lib/worldcup-markets';

describe('theme manifests', () => {
  it('marks packs as active or archived from a stable themeId', () => {
    const packs = listThemePacks(new Date('2026-06-24T12:00:00Z'));

    expect(packs.map((pack) => [pack.themeId, pack.status])).toContainEqual([
      'arc-summer-onchain',
      'active',
    ]);
    expect(packs.map((pack) => [pack.themeId, pack.status])).toContainEqual([
      'macro-catalyst-archive',
      'archived',
    ]);
  });

  it('resolves the active pack for matching chain drafts and leaves unrelated drafts untagged', () => {
    const activeWeekCases = [
      ['2026-06-22T12:00:00Z', 'eth:tvl:gte:199000000000:2026-09-20'],
      ['2026-06-24T12:00:00Z', 'arb:tvl:gte:12345678901:2026-09-22'],
      ['2026-06-28T12:00:00Z', 'eth:tvl:gte:250000000000:2026-09-26'],
    ] as const;

    for (const [now, externalKey] of activeWeekCases) {
      expect(
        getThemePackForDraft(
          {
            category: 'chain',
            sourceId: 'chain-event',
            externalKey,
          },
          new Date(now),
        )?.themeId,
      ).toBe('arc-summer-onchain');
    }

    expect(
      getThemePackForDraft(
        {
          category: 'chain',
          sourceId: 'chain-event',
          externalKey: 'eth:tvl:gte:210000000000:2026-10-01',
        },
        new Date('2026-06-24T12:00:00Z'),
      ),
    ).toBeUndefined();
  });

  it('returns a stable manifest record by themeId', () => {
    expect(getThemePackById('arc-summer-onchain')?.title).toContain('On-chain');
  });

  it('real active manifest carries explicit refs and does not absorb unrelated chain markets', () => {
    const theme = getThemePackById('arc-summer-onchain', new Date('2026-06-24T12:00:00Z'));
    expect(theme).toBeDefined();
    expect(theme?.refs.some((ref) => ref.externalKeyPatterns?.length)).toBe(true);
    expect(theme?.refs.some((ref) => ref.questionPatterns?.length)).toBe(true);

    const markets = [
      {
        id: 101n,
        category: 'chain' as const,
        sourceId: 'chain-event',
        externalKey: 'eth:tvl:gte:210000000000:2026-09-22',
        eventId: computeMarketId('chain-event', 'eth:tvl:gte:210000000000:2026-09-22'),
        question: 'Will Ethereum TVL be >= $210.00B by 2026-09-22?',
        betDeadline: 1_792_000_000n,
        settledOutcome: 255,
        pendingPayout: 0n,
        claimed_: false,
      },
      {
        id: 202n,
        category: 'chain' as const,
        eventId: computeMarketId('chain-event', 'arb:tvl:gte:10500000000:2026-10-01'),
        question: 'Will Arbitrum TVL be >= $10.50B by 2026-10-01?',
        betDeadline: 1_792_000_100n,
        settledOutcome: 255,
        pendingPayout: 0n,
        claimed_: false,
      },
      {
        id: 303n,
        category: 'chain' as const,
        question: 'Will Ethereum TVL be >= $210.00B by 2026-09-22?',
        betDeadline: 1_792_000_200n,
        settledOutcome: 255,
        pendingPayout: 0n,
        claimed_: false,
      },
    ];

    expect(getThemePackMarkets(theme!, markets).map((market) => market.id.toString())).toEqual([
      '101',
    ]);
    expect(markets.map((market) => market.id.toString())).toEqual(['101', '202', '303']);
  });

  it('does not absorb question-only chain markets when the theme ref requires chain-event identity', () => {
    const theme = getThemePackById('arc-summer-onchain', new Date('2026-06-24T12:00:00Z'));
    expect(theme).toBeDefined();

    const markets = [
      {
        id: 401n,
        category: 'chain' as const,
        sourceId: 'chain-event',
        externalKey: 'eth:tvl:gte:210000000000:2026-09-22',
        question: 'Will Ethereum TVL be >= $210.00B by 2026-09-22?',
        betDeadline: 1_792_000_000n,
        settledOutcome: 255,
        pendingPayout: 0n,
        claimed_: false,
      },
      {
        id: 402n,
        category: 'chain' as const,
        question: 'Will Ethereum TVL be >= $210.00B by 2026-09-22?',
        betDeadline: 1_792_000_100n,
        settledOutcome: 255,
        pendingPayout: 0n,
        claimed_: false,
      },
    ];

    expect(getThemePackMarkets(theme!, markets).map((market) => market.id.toString())).toEqual([
      '401',
    ]);
  });

  it('supports exact marketIds and eventIds without falling back to category-only matching', () => {
    const theme: ThemePack = {
      themeId: 'precision-pack',
      title: 'Precision Pack',
      description: 'Exact membership only.',
      weekStart: '2026-06-22',
      weekEnd: '2026-06-28',
      leadCategory: 'chain',
      shareCopy: 'Exact matching only.',
      refs: [
        {
          kind: 'category',
          category: 'chain',
          marketIds: ['303'],
          eventIds: [computeMarketId('chain-event', 'eth:tvl:gte:220000000000:2026-09-22')],
        },
      ],
      status: 'active',
    };

    const markets = [
      {
        id: 303n,
        category: 'chain' as const,
        eventId: computeMarketId('chain-event', 'unused'),
        question: 'Exact marketId match',
        betDeadline: 1_792_000_000n,
        settledOutcome: 255,
        pendingPayout: 0n,
        claimed_: false,
      },
      {
        id: 404n,
        category: 'chain' as const,
        eventId: computeMarketId('chain-event', 'eth:tvl:gte:220000000000:2026-09-22'),
        question: 'Exact eventId match',
        betDeadline: 1_792_000_100n,
        settledOutcome: 255,
        pendingPayout: 0n,
        claimed_: false,
      },
      {
        id: 505n,
        category: 'chain' as const,
        eventId: computeMarketId('chain-event', 'arb:tvl:gte:11000000000:2026-09-22'),
        question: 'Same category but not referenced',
        betDeadline: 1_792_000_200n,
        settledOutcome: 255,
        pendingPayout: 0n,
        claimed_: false,
      },
    ];

    expect(getThemePackMarkets(theme, markets).map((market) => market.id.toString())).toEqual([
      '303',
      '404',
    ]);
  });

  it('resolves chain-event source identity and externalKey from TVL questions', () => {
    const [market] = resolveWorldCupMarkets([
      {
        id: 707n,
        market: {
          eventId: computeMarketId('chain-event', 'eth:tvl:gte:210000000000:2026-09-22'),
          outcomeCount: 2,
          betDeadline: 1_791_913_600n,
          resolveAfter: 1_792_000_000n,
          outcomePools: [60_000_000n, 40_000_000n],
          winnerPool: 0n,
          protocolFee: 0n,
          feeBpsSnapshot: 0,
          feeRecipientSnapshot: `0x${'00'.repeat(20)}` as `0x${string}`,
          settledOutcome: 255,
          settleTime: 0n,
          question: 'Will Ethereum TVL be >= $210.00B by 2026-09-22?',
        },
        userOutcomeStakes: [0n, 0n],
        claimed_: false,
        pendingPayout: 0n,
      },
    ]);

    expect(market.category).toBe('chain');
    expect(market.sourceId).toBe('chain-event');
    expect(market.externalKey).toBe('eth:tvl:gte:210000000000:2026-09-22');
  });

  it('preserves deployment routing in theme board detail links', () => {
    const [entry] = toThemeMarketBoardEntries(
      [
        {
          id: 101n,
          category: 'chain',
          sourceId: 'chain-event',
          externalKey: 'eth:tvl:gte:210000000000:2026-09-22',
          deploymentId: 'automated-v1',
          question: 'Will Ethereum TVL be >= $210.00B by 2026-09-22?',
          betDeadline: 1_792_000_000n,
          settledOutcome: 255,
          pendingPayout: 0n,
          claimed_: false,
        },
      ],
      1_791_000_000n,
    );

    expect(entry.href).toBe('/market/101?kind=event&deployment=automated-v1');
  });
});
