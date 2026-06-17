import { describe, expect, test } from 'vitest';

import { buildEventContext } from '../lib/lens/contextBuilders/event';
import factsTable from '../data/worldcup-facts.json';

describe('lens.contextBuilders.event', () => {
  test('返回 global facts', () => {
    const ctx = buildEventContext({
      factsTable: factsTable as any,
      matchId: null,
      teams: [],
    });
    expect(ctx.facts?.some((f) => f.key === 'tournament')).toBe(true);
  });

  test('给定 teams 返回 by_team 条目', () => {
    const ctx = buildEventContext({
      factsTable: factsTable as any,
      matchId: null,
      teams: ['ARG', 'BRA'],
    });
    const teamKeys = ctx.facts?.map((f) => f.source) ?? [];
    expect(teamKeys.some((s) => s === 'CONMEBOL')).toBe(true);
  });

  test('未知 team 静默跳过，不抛错', () => {
    expect(() =>
      buildEventContext({
        factsTable: factsTable as any,
        matchId: null,
        teams: ['XYZ'],
      }),
    ).not.toThrow();
  });
});
