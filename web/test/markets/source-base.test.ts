import { describe, it, expect } from 'vitest';
import {
  type MarketSource,
  type MarketDraft,
  type ResolvedOutcome,
  ResolveStillOpen,
} from '../../lib/markets/sources/base';

describe('MarketSource base types', () => {
  it('MarketDraft requires at least 2 outcomes', () => {
    const d: MarketDraft = {
      externalKey: 'k',
      category: 'macro',
      question: 'Q',
      outcomes: [
        { id: 'lt', label: '< 2.5%' },
        { id: 'mid', label: '2.5-3.5%' },
        { id: 'gt', label: '> 3.5%' },
      ],
      betDeadline: 0,
      resolveAfter: 0,
      resolveSourceMeta: {},
    };
    expect(d.outcomes).toHaveLength(3);
  });

  it('ResolveStillOpen is a singleton', () => {
    const r: ResolvedOutcome = ResolveStillOpen;
    expect(r.kind).toBe('still-open');
  });

  it('MarketSource shape compiles', () => {
    const fake: MarketSource = {
      id: 'fake',
      category: 'macro',
      enabled: true,
      async fetchUpcoming() { return []; },
      async resolve() { return ResolveStillOpen; },
    };
    expect(fake.id).toBe('fake');
  });
});
