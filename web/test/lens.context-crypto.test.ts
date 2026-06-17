import { afterEach, describe, expect, test, vi } from 'vitest';

import { buildCryptoContext } from '../lib/lens/contextBuilders/crypto';

const samples = Array.from({ length: 7 * 24 }, (_, i) => ({
  ts: 1_700_000_000 + i * 3600,
  price: 60000 + Math.sin(i / 5) * 2000,
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lens.contextBuilders.crypto', () => {
  test('从 ts/price 序列计算 volatility 与 sigma 距离', () => {
    const ctx = buildCryptoContext({
      pythSeries: samples,
      threshold: 70000,
    });
    expect(ctx.pyth_recent?.length).toBeGreaterThan(0);
    expect(ctx.volatility_30d).toBeGreaterThan(0);
    expect(ctx.distance_to_threshold_sigma).toBeGreaterThan(0);
  });

  test('空序列降级返回空字段', () => {
    const ctx = buildCryptoContext({ pythSeries: [], threshold: 70000 });
    expect(ctx.pyth_recent).toEqual([]);
    expect(ctx.volatility_30d).toBeUndefined();
    expect(ctx.distance_to_threshold_sigma).toBeUndefined();
  });

  test('采样不超过 maxSamples', () => {
    const ctx = buildCryptoContext({
      pythSeries: samples,
      threshold: 70000,
      maxSamples: 24,
    });
    expect(ctx.pyth_recent!.length).toBeLessThanOrEqual(24);
  });

  test('提供 endTimeSeconds 时计算 seconds_to_resolve', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const ctx = buildCryptoContext({
      pythSeries: samples,
      threshold: 70000,
      endTimeSeconds: 1_700_003_600,
    });

    expect(ctx.seconds_to_resolve).toBe(3600);
  });

  test('未提供 endTimeSeconds 时不写 seconds_to_resolve', () => {
    const ctx = buildCryptoContext({
      pythSeries: samples,
      threshold: 70000,
    });

    expect(ctx.seconds_to_resolve).toBeUndefined();
  });
});
