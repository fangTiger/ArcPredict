import { describe, it, expect } from 'vitest';
import { MARKET_CATEGORIES, type MarketCategory } from '../../lib/market-kind';

describe('MarketCategory enum', () => {
  it('contains all 4 categories', () => {
    expect(MARKET_CATEGORIES).toEqual(['crypto', 'worldcup', 'macro', 'chain']);
  });

  it('exhaustive switch compiles for all categories', () => {
    const label = (c: MarketCategory): string => {
      switch (c) {
        case 'crypto':   return 'Crypto';
        case 'worldcup': return 'World Cup';
        case 'macro':    return 'Macro';
        case 'chain':    return 'On-chain';
      }
    };
    expect(label('macro')).toBe('Macro');
    expect(label('chain')).toBe('On-chain');
  });
});
