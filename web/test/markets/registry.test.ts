import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetRegistry,
  registerSource,
  enabledSources,
  getSource,
} from '../../lib/markets/registry';
import { ResolveStillOpen, type MarketSource } from '../../lib/markets/sources/base';

const make = (id: string, enabled = true): MarketSource => ({
  id,
  category: 'macro',
  enabled,
  async fetchUpcoming() { return []; },
  async resolve() { return ResolveStillOpen; },
});

describe('source registry', () => {
  beforeEach(() => resetRegistry());

  it('registers and returns enabled sources only', () => {
    registerSource(make('a', true));
    registerSource(make('b', false));
    expect(enabledSources().map((s) => s.id)).toEqual(['a']);
  });

  it('rejects duplicate registration', () => {
    registerSource(make('a'));
    expect(() => registerSource(make('a'))).toThrow(/duplicate/i);
  });

  it('getSource returns by id (or undefined)', () => {
    const s = make('a');
    registerSource(s);
    expect(getSource('a')).toBe(s);
    expect(getSource('missing')).toBeUndefined();
  });
});
