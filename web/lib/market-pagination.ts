export const MARKET_PAGE_SIZE = 10;

export function nextVisibleMarketCount(
  totalCount: number,
  currentCount: number,
  pageSize: number = MARKET_PAGE_SIZE,
): number {
  if (totalCount <= 0) {
    return 0;
  }

  return Math.min(totalCount, Math.max(0, currentCount) + pageSize);
}

export function sliceVisibleMarketRows<T>(rows: readonly T[], visibleCount: number): T[] {
  return rows.slice(0, Math.max(0, visibleCount));
}
