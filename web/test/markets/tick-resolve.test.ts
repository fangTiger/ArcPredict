import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeMarketId } from '../../lib/markets/external-key';
import { registerSource, resetRegistry } from '../../lib/markets/registry';
import { runTick } from '../../lib/markets/scheduler/tick';
import { ResolveStillOpen, type MarketDraft, type MarketSource, type ResolvedOutcome } from '../../lib/markets/sources/base';

const DAY = 86_400;
const NOW = new Date('2026-07-20T00:00:00Z');
const nowSec = Math.floor(NOW.getTime() / 1000);
const externalKey = 'CPIAUCSL:2026-07-15';
const eventId = computeMarketId('fred-macro', externalKey);

const draft: MarketDraft = {
  externalKey,
  category: 'macro',
  question: 'US CPI YoY released on 2026-07-15 - what range?',
  outcomes: [
    { id: 'lt25', label: '< 2.5%' },
    { id: 'mid', label: '2.5%-3.5%' },
    { id: 'gt35', label: '> 3.5%' },
  ],
  betDeadline: nowSec - 2 * DAY,
  resolveAfter: nowSec - DAY,
  resolveSourceMeta: {},
};

const makeSource = (resolveResults: ResolvedOutcome[], drafts: MarketDraft[] = [draft]): MarketSource => ({
  id: 'fred-macro',
  category: 'macro',
  enabled: true,
  async fetchUpcoming() {
    return drafts;
  },
  async resolve(market) {
    expect(market.externalKey).toBe(externalKey);
    return resolveResults.shift() ?? ResolveStillOpen;
  },
});

const fakeReader = {
  marketIdForEventId: vi.fn().mockResolvedValue(1n),
  oracleStatus: vi.fn().mockResolvedValue('pending'),
  marketSettled: vi.fn().mockResolvedValue(false),
  marketHasLiquidity: vi.fn().mockResolvedValue(true),
  pendingMarketsForSource: vi.fn(),
};

const fakeWriter = {
  openMarket: vi.fn().mockResolvedValue(`0x${'1'.repeat(64)}`),
  proposeOutcome: vi.fn().mockResolvedValue(`0x${'1'.repeat(64)}`),
  finalizeOutcome: vi.fn().mockResolvedValue(`0x${'1'.repeat(64)}`),
  settleMarket: vi.fn().mockResolvedValue(`0x${'1'.repeat(64)}`),
};

beforeEach(() => {
  resetRegistry();
  Object.values(fakeReader).forEach((m) => m.mockReset());
  Object.values(fakeWriter).forEach((m) => m.mockReset());
  fakeReader.marketIdForEventId.mockResolvedValue(1n);
  fakeReader.marketHasLiquidity.mockResolvedValue(true);
});

describe('runTick resolve branch', () => {
  it('proposes when oracle is pending and source returns a settled outcome', async () => {
    registerSource(makeSource([
      { kind: 'settled', settledOutcomeIndex: 1, publishedAt: nowSec },
    ]));
    fakeReader.pendingMarketsForSource.mockResolvedValue([
      { marketId: 1n, eventId, resolveAfter: nowSec - DAY, oracleStatus: 'pending', settled: false },
    ]);

    const report = await runTick({
      now: NOW,
      reader: fakeReader,
      writer: fakeWriter,
      seedLiquidity: { seed: vi.fn() },
      preloader: { warm: vi.fn() },
    });

    expect(fakeReader.pendingMarketsForSource).toHaveBeenCalledWith('fred-macro', [eventId]);
    expect(fakeWriter.proposeOutcome).toHaveBeenCalledWith(eventId, 1);
    expect(report.perSource['fred-macro'].resolvedProposed).toBe(1);
  });

  it('skips when oracle is proposed but within the 72h challenge window', async () => {
    registerSource(makeSource([]));
    fakeReader.pendingMarketsForSource.mockResolvedValue([
      {
        marketId: 1n,
        eventId,
        resolveAfter: nowSec - DAY,
        oracleStatus: 'proposed',
        proposedAt: nowSec - DAY,
        settled: false,
      },
    ]);

    const report = await runTick({
      now: NOW,
      reader: fakeReader,
      writer: fakeWriter,
      seedLiquidity: { seed: vi.fn() },
      preloader: { warm: vi.fn() },
    });

    expect(fakeWriter.finalizeOutcome).not.toHaveBeenCalled();
    expect(fakeWriter.settleMarket).not.toHaveBeenCalled();
    expect(report.perSource['fred-macro'].resolvedFinalized).toBe(0);
  });

  it('finalizes and settles when the 72h challenge window has passed', async () => {
    registerSource(makeSource([]));
    fakeReader.pendingMarketsForSource.mockResolvedValue([
      {
        marketId: 7n,
        eventId,
        resolveAfter: nowSec - 4 * DAY,
        oracleStatus: 'proposed',
        proposedAt: nowSec - 4 * DAY,
        settled: false,
      },
    ]);

    const report = await runTick({
      now: NOW,
      reader: fakeReader,
      writer: fakeWriter,
      seedLiquidity: { seed: vi.fn() },
      preloader: { warm: vi.fn() },
    });

    expect(fakeWriter.finalizeOutcome).toHaveBeenCalledWith(eventId);
    expect(fakeWriter.settleMarket).toHaveBeenCalledWith(7n);
    expect(report.perSource['fred-macro'].resolvedFinalized).toBe(1);
    expect(report.perSource['fred-macro'].resolvedSettled).toBe(1);
  });

  it('does not auto-recover challenged state', async () => {
    registerSource(makeSource([]));
    fakeReader.pendingMarketsForSource.mockResolvedValue([
      {
        marketId: 1n,
        eventId,
        resolveAfter: nowSec - DAY,
        oracleStatus: 'challenged',
        settled: false,
      },
    ]);

    const report = await runTick({
      now: NOW,
      reader: fakeReader,
      writer: fakeWriter,
      seedLiquidity: { seed: vi.fn() },
      preloader: { warm: vi.fn() },
    });

    expect(fakeWriter.proposeOutcome).not.toHaveBeenCalled();
    expect(fakeWriter.finalizeOutcome).not.toHaveBeenCalled();
    expect(fakeWriter.settleMarket).not.toHaveBeenCalled();
    expect(report.perSource['fred-macro'].resolvedSettled).toBe(0);
  });
});
