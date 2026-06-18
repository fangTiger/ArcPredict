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
};

const fakeWriter = {
  openMarket: vi.fn().mockResolvedValue(`0x${'1'.repeat(64)}`),
  proposeOutcome: vi.fn().mockResolvedValue(`0x${'1'.repeat(64)}`),
  finalizeOutcome: vi.fn().mockResolvedValue(`0x${'1'.repeat(64)}`),
  settleMarket: vi.fn().mockResolvedValue(`0x${'1'.repeat(64)}`),
};

const fakeSeed = { seed: vi.fn().mockResolvedValue(undefined) };
const fakePreloader = { warm: vi.fn().mockResolvedValue(undefined) };

beforeEach(() => {
  resetRegistry();
  Object.values(fakeReader).forEach((m) => m.mockClear());
  Object.values(fakeWriter).forEach((m) => m.mockClear());
  fakeSeed.seed.mockClear();
  fakePreloader.warm.mockClear();
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
    });
    expect(report.perSource['fred-macro'].opened).toBe(1);
  });

  it('skips draft when eventId already on chain', async () => {
    const draft = makeDraft('CPIAUCSL:2026-07-15');
    registerSource(makeSource('fred-macro', [draft]));
    fakeReader.marketIdForEventId.mockResolvedValue(99n);

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

  it('localizes failure so one source does not block another', async () => {
    registerSource({
      id: 'broken',
      category: 'macro',
      enabled: true,
      async fetchUpcoming() {
        throw new Error('boom');
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

    expect(report.perSource.broken.error).toMatch(/boom/);
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
});
