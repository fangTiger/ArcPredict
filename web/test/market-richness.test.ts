import { describe, expect, it } from 'vitest';
import type { DashboardRow } from '../lib/derivePosition';
import type { WorldCupMarketRow } from '../lib/worldcup-markets';
import { EVENT_UNRESOLVED_OUTCOME } from '../lib/worldcup-markets';
import {
  deriveMarketStory,
  selectClosingSoon,
  selectRecentlyResolved,
  selectRelatedMarkets,
  selectTodayBoard,
  selectTrendingMarkets,
  toRichMarketRef,
} from '../lib/market-richness';

function makePriceRow(
  overrides: Partial<Omit<DashboardRow, 'market'>> & {
    market?: Partial<DashboardRow['market']>;
  } = {},
): DashboardRow {
  const base: DashboardRow = {
    id: 11n,
    market: {
      pythPriceId: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      threshold: 105000n,
      thresholdExpo: 0,
      betDeadline: 1_700_003_600n,
      resolveAfter: 1_700_007_200n,
      yesPool: 72_000_000n,
      noPool: 28_000_000n,
      winnerPool: 0n,
      protocolFee: 0n,
      feeBpsSnapshot: 0,
      feeRecipientSnapshot: '0x0000000000000000000000000000000000000000',
      outcome: 0,
      settlePrice: 0n,
      settleTime: 0n,
      question: 'Will BTC/USD be >= $105,000 by 2026-09-22?',
    },
    yesStake: 0n,
    noStake: 0n,
    claimed_: false,
    pendingPayout: 0n,
  };

  return {
    ...base,
    ...overrides,
    market: {
      ...base.market,
      ...(overrides.market ?? {}),
    },
  };
}

function makeEventRow(
  overrides: Partial<Omit<WorldCupMarketRow, 'homeTeam' | 'outcomes' | 'userOutcomeStakes' | 'outcomePools' | 'themeVisual'>> & {
    homeTeam?: Partial<WorldCupMarketRow['homeTeam']>;
    outcomes?: WorldCupMarketRow['outcomes'];
    userOutcomeStakes?: WorldCupMarketRow['userOutcomeStakes'];
    outcomePools?: WorldCupMarketRow['outcomePools'];
    themeVisual?: WorldCupMarketRow['themeVisual'];
  } = {},
): WorldCupMarketRow {
  const base: WorldCupMarketRow = {
    id: 77n,
    deploymentId: 'automated-v1',
    eventMarketAddress: '0x0000000000000000000000000000000000000000',
    oracleAddress: '0x0000000000000000000000000000000000000000',
    marketKind: 'event',
    category: 'chain',
    sourceId: 'chain-event',
    externalKey: 'eth:tvl:gte:210000000000:2026-09-22',
    themeId: 'arc-summer-onchain',
    matchId: null,
    stage: 'winner',
    stageLabel: 'On-chain',
    marketType: 'winner',
    question: 'Will Ethereum TVL be >= $210.00B by 2026-09-22?',
    kickoffTime: '2026-09-22T00:00:00Z',
    betDeadline: 1_700_002_100n,
    eventId: '0x1111111111111111111111111111111111111111111111111111111111111111',
    outcomePools: [61_000_000n, 39_000_000n],
    userOutcomeStakes: [0n, 0n],
    claimed_: false,
    pendingPayout: 0n,
    settledOutcome: EVENT_UNRESOLVED_OUTCOME,
    homeTeam: {
      shortCode: 'CHAIN',
      nameZh: 'On-chain',
      nameEn: 'On-chain',
    },
    awayTeam: null,
    outcomes: [
      {
        id: 'yes',
        label: 'Yes',
        openingProbability: 58,
        impliedProbability: 61,
        odds: 1.64,
      },
      {
        id: 'no',
        label: 'No',
        openingProbability: 42,
        impliedProbability: 39,
        odds: 2.56,
      },
    ],
    liquidity: 100_000_000n,
    positionLabel: 'No position',
    themeVisual: {
      id: 'onchain-flow',
      imageUrl: '/theme/onchain.png',
      alt: 'On-chain market',
      title: 'On-chain',
      subtitle: 'Layer-2 liquidity',
    },
  };

  return {
    ...base,
    ...overrides,
    homeTeam: {
      ...base.homeTeam,
      ...(overrides.homeTeam ?? {}),
    },
    marketKind: 'event',
    outcomes: overrides.outcomes ?? base.outcomes,
    userOutcomeStakes: overrides.userOutcomeStakes ?? base.userOutcomeStakes,
    outcomePools: overrides.outcomePools ?? base.outcomePools,
    themeVisual: overrides.themeVisual ?? base.themeVisual,
  };
}

describe('market richness', () => {
  const now = 1_700_000_000n;

  it('normalizes price and event rows into rich market refs', () => {
    const priceRef = toRichMarketRef(makePriceRow({ yesStake: 8_000_000n }), now);
    const eventRef = toRichMarketRef(makeEventRow(), now);

    expect(priceRef).toMatchObject({
      id: '11',
      marketKind: 'price',
      category: 'crypto',
      href: '/market/11',
      probabilityLabel: 'YES 72%',
      activityLabel: 'Position live',
      skewLabel: 'Pool skew YES 72%',
      themeLabel: 'BTC',
    });
    expect(eventRef).toMatchObject({
      id: '77',
      marketKind: 'event',
      category: 'chain',
      href: '/market/77?kind=event&deployment=automated-v1',
      probabilityLabel: 'Top outcome 61%',
      activityLabel: 'Theme spotlight',
      skewLabel: 'Leading outcome Yes',
      themeLabel: 'On-chain',
    });
  });

  it('picks a today board hero and supporting markets from open refs', () => {
    const refs = [
      toRichMarketRef(makePriceRow({ id: 1n, market: { betDeadline: now + 86_400n, yesPool: 35_000_000n, noPool: 25_000_000n } }), now),
      toRichMarketRef(makeEventRow({ id: 2n, betDeadline: now + 1_200n, liquidity: 180_000_000n, themeId: 'arc-summer-onchain' }), now),
      toRichMarketRef(makePriceRow({ id: 3n, yesStake: 15_000_000n, market: { betDeadline: now + 4_000n, yesPool: 68_000_000n, noPool: 22_000_000n } }), now),
      toRichMarketRef(makeEventRow({ id: 4n, betDeadline: now + 14_400n, liquidity: 120_000_000n }), now),
      toRichMarketRef(makePriceRow({ id: 5n, market: { outcome: 1 } }), now),
    ];

    const board = selectTodayBoard(refs, now);

    expect(board.hero?.id).toBe('3');
    expect(board.secondary.map((item) => item.id)).toEqual(['2', '4', '1']);
  });

  it('sorts trending and closing soon using real liquidity and deadline signals', () => {
    const refs = [
      toRichMarketRef(makePriceRow({ id: 10n, market: { betDeadline: now + 18_000n, yesPool: 55_000_000n, noPool: 45_000_000n } }), now),
      toRichMarketRef(makeEventRow({ id: 11n, liquidity: 240_000_000n, betDeadline: now + 6_000n, themeId: 'arc-summer-onchain' }), now),
      toRichMarketRef(makePriceRow({ id: 12n, market: { betDeadline: now + 1_200n, yesPool: 10_000_000n, noPool: 10_000_000n } }), now),
      toRichMarketRef(makeEventRow({ id: 13n, liquidity: 90_000_000n, betDeadline: now - 10n, settledOutcome: 0 }), now),
    ];

    expect(selectTrendingMarkets(refs, now).map((item) => item.id)).toEqual(['11', '10', '12']);
    expect(selectClosingSoon(refs, now).map((item) => item.id)).toEqual(['12', '11', '10']);
  });

  it('surfaces claimable and settled markets without inventing activity', () => {
    const refs = [
      toRichMarketRef(makePriceRow({ id: 20n, pendingPayout: 14_000_000n, market: { outcome: 1, settleTime: now - 900n } }), now),
      toRichMarketRef(makeEventRow({ id: 21n, settledOutcome: 0, pendingPayout: 0n, betDeadline: now - 3_600n }), now),
      toRichMarketRef(makePriceRow({ id: 22n, market: { outcome: 0 } }), now),
    ];

    expect(selectRecentlyResolved(refs).map((item) => item.id)).toEqual(['20', '21']);
    expect(selectRecentlyResolved(refs)[0]?.statusLabel).toBe('Claimable now');
  });

  it('derives a market story and related markets from category, theme, asset, and stage', () => {
    const current = toRichMarketRef(
      makeEventRow({
        id: 31n,
        themeId: 'arc-summer-onchain',
        liquidity: 210_000_000n,
        question: 'Will Ethereum TVL be >= $210.00B by 2026-09-22?',
      }),
      now,
    );
    const related = [
      current,
      toRichMarketRef(makeEventRow({ id: 32n, themeId: 'arc-summer-onchain', question: 'Will Arbitrum TVL be >= $11.00B by 2026-09-22?' }), now),
      toRichMarketRef(makeEventRow({ id: 33n, themeId: 'arc-summer-onchain', question: 'Will Base TVL be >= $6.00B by 2026-09-22?' }), now),
      toRichMarketRef(makeEventRow({ id: 34n, themeId: undefined, question: 'Will Ethereum TVL be >= $220.00B by 2026-09-29?' }), now),
      toRichMarketRef(makePriceRow({ id: 35n, market: { question: 'Will BTC/USD be >= $110,000 by 2026-09-29?' } }), now),
    ];

    const story = deriveMarketStory(current);

    expect(story.whyItMatters).toContain('on-chain');
    expect(story.whatMovesIt).toContain('liquidity');
    expect(story.whatToWatch).toContain('deadline');
    expect(selectRelatedMarkets(current, related).map((item) => item.id)).toEqual(['32', '33', '34']);
  });
});
