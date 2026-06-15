import { describe, expect, test } from 'vitest';

import {
  MARKET_PAGE_SIZE,
  nextVisibleMarketCount,
  sliceVisibleMarketRows,
} from '../lib/market-pagination';

describe('market-pagination', () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({ id: index }));

  test('首页市场列表默认只渲染前 10 条', () => {
    expect(MARKET_PAGE_SIZE).toBe(10);
    expect(sliceVisibleMarketRows(rows, MARKET_PAGE_SIZE).map((row) => row.id)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  test('滚动触底后每次再追加 10 条，不超过总数', () => {
    expect(nextVisibleMarketCount(rows.length, 10)).toBe(20);
    expect(nextVisibleMarketCount(rows.length, 20)).toBe(25);
    expect(nextVisibleMarketCount(rows.length, 25)).toBe(25);
  });
});
