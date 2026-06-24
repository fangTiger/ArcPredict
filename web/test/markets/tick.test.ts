import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeMarketId } from '../../lib/markets/external-key';
import { registerSource, resetRegistry } from '../../lib/markets/registry';
import { runTick } from '../../lib/markets/scheduler/tick';
import { ResolveStillOpen, type MarketDraft, type MarketSource } from '../../lib/markets/sources/base';

const makeDraft = (externalKey: string, outcomeCount = 2): MarketDraft => ({
  externalKey,
  category: 'macro',
  question: 'Q',
  outcomes: Array.from({ length: outcomeCount }, (_, i) => ({
    id: `o${i}`,
    label: `Outcome ${i}`,
  })),
  betDeadline: Math.floor(Date.now() / 1000) + 10_000,
  resolveAfter: Math.floor(Date.now() / 1000) + 20_000,
  resolveSourceMeta: {},
  themeId: 'macro-weekly-radar',
});

const makeSource = (id: string, drafts: MarketDraft[]): MarketSource => ({
  id,
  category: 'macro',
  enabled: true,
  async fetchUpcoming() {
    return drafts;
  },
  async resolve() {
    return ResolveStillOpen;
  },
});

const fakeReader = {
  marketIdForEventId: vi.fn().mockResolvedValue(null),
  oracleStatus: vi.fn().mockResolvedValue('pending'),
  marketSettled: vi.fn().mockResolvedValue(false),
  marketHasLiquidity: vi.fn().mockResolvedValue(false),
  pendingMarketsForSource: vi.fn().mockResolvedValue([]),
};

const fakeWriter = {
  openMarket: vi.fn().mockResolvedValue(`0x${'1'.repeat(64)}`),
  proposeOutcome: vi.fn().mockResolvedValue(`0x${'1'.repeat(64)}`),
  finalizeOutcome: vi.fn().mockResolvedValue(`0x${'1'.repeat(64)}`),
  settleMarket: vi.fn().mockResolvedValue(`0x${'1'.repeat(64)}`),
};

const fakeSeed = {
  seed: vi.fn().mockResolvedValue({
    status: 'seeded',
    approveTxHash: `0x${'2'.repeat(64)}`,
    betTxHashes: [`0x${'3'.repeat(64)}`, `0x${'4'.repeat(64)}`],
  }),
};
const fakePreloader = { warm: vi.fn().mockResolvedValue({ status: 'warmed' }) };

beforeEach(() => {
  resetRegistry();
  Object.values(fakeReader).forEach((m) => m.mockClear());
  Object.values(fakeWriter).forEach((m) => m.mockClear());
  fakeSeed.seed.mockClear();
  fakePreloader.warm.mockClear();
  fakeReader.marketHasLiquidity.mockResolvedValue(false);
});

describe('runTick', () => {
  it('opens new market when reader says eventId is unknown', async () => {
    const draft = makeDraft('CPIAUCSL:2026-07-15', 3);
    registerSource(makeSource('fred-macro', [draft]));
    fakeReader.marketIdForEventId.mockResolvedValueOnce(null);
    fakeReader.marketIdForEventId.mockResolvedValueOnce(42n);

    const report = await runTick({
      now: new Date(),
      reader: fakeReader,
      writer: fakeWriter,
      seedLiquidity: fakeSeed,
      preloader: fakePreloader,
    });

    expect(fakeWriter.openMarket).toHaveBeenCalledWith({
      eventId: computeMarketId('fred-macro', draft.externalKey),
      question: draft.question,
      outcomeCount: 3,
      betDeadline: draft.betDeadline,
      resolveAfter: draft.resolveAfter,
    });
    expect(fakeSeed.seed).toHaveBeenCalledWith(42n, 3);
    expect(fakePreloader.warm).toHaveBeenCalledWith({
      eventId: computeMarketId('fred-macro', draft.externalKey),
      category: draft.category,
      question: draft.question,
      externalKey: draft.externalKey,
      outcomes: draft.outcomes,
      themeId: draft.themeId,
    });
    expect(report.perSource['fred-macro'].opened).toBe(1);
    expect(report.perSource['fred-macro'].seeded).toBe(1);
    expect(report.perSource['fred-macro'].markets[0]).toMatchObject({
      externalKey: draft.externalKey,
      themeId: 'macro-weekly-radar',
      openTxHash: `0x${'1'.repeat(64)}`,
      seed: {
        status: 'seeded',
        approveTxHash: `0x${'2'.repeat(64)}`,
        betTxHashes: [`0x${'3'.repeat(64)}`, `0x${'4'.repeat(64)}`],
      },
      lensPreload: { status: 'warmed' },
    });
  });

  it('skips draft when eventId already on chain', async () => {
    const draft = makeDraft('CPIAUCSL:2026-07-15');
    registerSource(makeSource('fred-macro', [draft]));
    fakeReader.marketIdForEventId.mockResolvedValue(99n);
    fakeReader.marketHasLiquidity.mockResolvedValue(true);

    const report = await runTick({
      now: new Date(),
      reader: fakeReader,
      writer: fakeWriter,
      seedLiquidity: fakeSeed,
      preloader: fakePreloader,
    });

    expect(fakeWriter.openMarket).not.toHaveBeenCalled();
    expect(report.perSource['fred-macro'].opened).toBe(0);
    expect(report.perSource['fred-macro'].skipped).toBe(1);
  });

  it('seeds an existing market when it has no liquidity yet', async () => {
    const draft = makeDraft('CPIAUCSL:2026-07-15', 3);
    registerSource(makeSource('fred-macro', [draft]));
    fakeReader.marketIdForEventId.mockResolvedValue(99n);
    fakeReader.marketHasLiquidity.mockResolvedValue(false);

    const report = await runTick({
      now: new Date(),
      reader: fakeReader,
      writer: fakeWriter,
      seedLiquidity: fakeSeed,
      preloader: fakePreloader,
    });

    expect(fakeWriter.openMarket).not.toHaveBeenCalled();
    expect(fakeSeed.seed).toHaveBeenCalledWith(99n, 3);
    expect(report.perSource['fred-macro'].skipped).toBe(1);
  });

  it('localizes failure so one source does not block another', async () => {
    registerSource({
      id: 'broken',
      category: 'macro',
      enabled: true,
      async fetchUpcoming() {
        throw new Error(
          'boom AUTOMATION_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef Bearer super-secret sk-live-secret',
        );
      },
      async resolve() {
        return ResolveStillOpen;
      },
    });
    registerSource(makeSource('healthy', []));

    const report = await runTick({
      now: new Date(),
      reader: fakeReader,
      writer: fakeWriter,
      seedLiquidity: fakeSeed,
      preloader: fakePreloader,
    });

    expect(report.perSource.broken.errors[0]).toMatch(/boom/);
    expect(report.perSource.broken.errors[0]).not.toContain('AUTOMATION_PRIVATE_KEY');
    expect(report.perSource.broken.errors[0]).not.toContain('super-secret');
    expect(report.perSource.broken.errors[0]).not.toContain('sk-live-secret');
    expect(report.perSource.healthy).toBeDefined();
  });

  it('respects per-tick limit: max 5 new markets per source', async () => {
    const drafts = Array.from({ length: 8 }, (_, i) => makeDraft(`key-${i}`));
    registerSource(makeSource('fred-macro', drafts));
    fakeReader.marketIdForEventId.mockImplementation(async () => {
      if (fakeWriter.openMarket.mock.calls.length > fakeSeed.seed.mock.calls.length) {
        return BigInt(fakeWriter.openMarket.mock.calls.length);
      }
      return null;
    });

    const report = await runTick({
      now: new Date(),
      reader: fakeReader,
      writer: fakeWriter,
      seedLiquidity: fakeSeed,
      preloader: fakePreloader,
    });

    expect(fakeWriter.openMarket).toHaveBeenCalledTimes(5);
    expect(report.perSource['fred-macro'].opened).toBe(5);
  });

  it('records needs_funding seed status and lens preload warnings without failing the source', async () => {
    const draft = makeDraft('CPIAUCSL:2026-07-16', 2);
    registerSource(makeSource('fred-macro', [draft]));
    fakeReader.marketIdForEventId.mockResolvedValueOnce(null);
    fakeReader.marketIdForEventId.mockResolvedValueOnce(43n);
    fakeSeed.seed.mockResolvedValueOnce({
      status: 'needs_funding',
      error: 'automation wallet needs funding',
    });
    fakePreloader.warm.mockResolvedValueOnce({
      status: 'warning',
      warning: 'Lens preload unavailable',
    });

    const report = await runTick({
      now: new Date(),
      reader: fakeReader,
      writer: fakeWriter,
      seedLiquidity: fakeSeed,
      preloader: fakePreloader,
    });

    expect(report.perSource['fred-macro'].opened).toBe(1);
    expect(report.perSource['fred-macro'].seeded).toBe(0);
    expect(report.perSource['fred-macro'].markets[0]).toMatchObject({
      themeId: 'macro-weekly-radar',
      seed: {
        status: 'needs_funding',
        error: 'automation wallet needs funding',
      },
      lensPreload: {
        status: 'warning',
        warning: 'Lens preload unavailable',
      },
    });
  });

  it('uses a per-source deployment runtime when sources live on different EventMarket contracts', async () => {
    const macroDraft = makeDraft('CPIAUCSL:2026-07-15', 3);
    const chainDraft = makeDraft('eth:tvl:gte:100:2026-09-17', 2);
    registerSource(makeSource('fred-macro', [macroDraft]));
    registerSource(makeSource('chain-event', [chainDraft]));

    const macroReader = {
      ...fakeReader,
      marketIdForEventId: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(41n),
      pendingMarketsForSource: vi.fn().mockResolvedValue([]),
    };
    const chainReader = {
      ...fakeReader,
      marketIdForEventId: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(42n),
      pendingMarketsForSource: vi.fn().mockResolvedValue([]),
    };
    const macroWriter = {
      ...fakeWriter,
      openMarket: vi.fn().mockResolvedValue(`0x${'a'.repeat(64)}`),
    };
    const chainWriter = {
      ...fakeWriter,
      openMarket: vi.fn().mockResolvedValue(`0x${'b'.repeat(64)}`),
    };
    const macroSeed = {
      seed: vi.fn().mockResolvedValue({ status: 'seeded', betTxHashes: [] }),
    };
    const chainSeed = {
      seed: vi.fn().mockResolvedValue({ status: 'seeded', betTxHashes: [] }),
    };

    const report = await runTick({
      now: new Date(),
      runtimeForSource(source) {
        if (source.id === 'fred-macro') {
          return {
            deploymentId: 'automated-v1',
            reader: macroReader,
            writer: macroWriter,
            seedLiquidity: macroSeed,
            preloader: fakePreloader,
          };
        }

        return {
          deploymentId: 'worldcup-v1',
          reader: chainReader,
          writer: chainWriter,
          seedLiquidity: chainSeed,
          preloader: fakePreloader,
        };
      },
    });

    expect(macroWriter.openMarket).toHaveBeenCalledWith(expect.objectContaining({
      eventId: computeMarketId('fred-macro', macroDraft.externalKey),
    }));
    expect(chainWriter.openMarket).toHaveBeenCalledWith(expect.objectContaining({
      eventId: computeMarketId('chain-event', chainDraft.externalKey),
    }));
    expect(fakeWriter.openMarket).not.toHaveBeenCalled();
    expect(report.perSource['fred-macro'].deploymentId).toBe('automated-v1');
    expect(report.perSource['chain-event'].deploymentId).toBe('worldcup-v1');
  });
});
