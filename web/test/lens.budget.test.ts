import { describe, expect, test } from 'vitest';

import { createBudgetTracker } from '../lib/lens/budget';

describe('lens.budget', () => {
  test('未超额时 allow=true，并累积 spent', () => {
    const b = createBudgetTracker({
      dailyLimitUsd: 1.0,
      nowMs: () => Date.UTC(2026, 5, 16, 10, 0, 0),
    });
    expect(b.canSpend(0.0005)).toBe(true);
    b.record(0.0005);
    expect(b.spentToday()).toBeCloseTo(0.0005);
  });

  test('达上限拒绝继续', () => {
    const b = createBudgetTracker({
      dailyLimitUsd: 0.001,
      nowMs: () => Date.UTC(2026, 5, 16, 10, 0, 0),
    });
    b.record(0.0009);
    expect(b.canSpend(0.0002)).toBe(false);
  });

  test('跨过 UTC 0 点自动重置', () => {
    let now = Date.UTC(2026, 5, 16, 23, 59, 0);
    const b = createBudgetTracker({
      dailyLimitUsd: 0.001,
      nowMs: () => now,
    });
    b.record(0.001);
    expect(b.canSpend(0.0005)).toBe(false);
    now = Date.UTC(2026, 5, 17, 0, 1, 0);
    expect(b.canSpend(0.0005)).toBe(true);
    expect(b.spentToday()).toBe(0);
  });

  test('estimateCostUsd 按 token 数与单价计算', () => {
    const b = createBudgetTracker({
      dailyLimitUsd: 1,
      inputPricePerMTokens: 0.07,
      outputPricePerMTokens: 1.10,
      nowMs: () => 0,
    });
    const cost = b.estimateCostUsd(1000, 1000);
    // input: 1000 * 0.07 / 1e6 = 0.00007
    // output: 1000 * 1.10 / 1e6 = 0.0011
    expect(cost).toBeCloseTo(0.00117);
  });
});
