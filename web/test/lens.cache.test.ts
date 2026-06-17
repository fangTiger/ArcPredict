import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createMemoryCache, computeInputHash } from '../lib/lens/cache';
import type { LensInput, LensOutput } from '../lib/lens/schema';

const baseInput: LensInput = {
  market: {
    id: 'm1',
    question: 'q',
    type: 'crypto-binary',
    end_time: 1,
    implied_probability: 0.3,
  },
  context: { pyth_recent: [{ ts: 1, price: 100 }] },
  generated_at: 1,
};

const sampleOutput: LensOutput = {
  summary: 's',
  factors: ['a', 'b', 'c'],
  fair_range: [0.1, 0.2],
  confidence: 'low',
  reasoning: 'r',
  sources: [],
  caveats: [],
};

describe('lens.cache', () => {
  let cache: ReturnType<typeof createMemoryCache>;

  beforeEach(() => {
    cache = createMemoryCache({ nowMs: () => 1_000_000 });
  });

  test('miss 时返回 undefined', () => {
    const hash = computeInputHash(baseInput);
    expect(cache.get('m1', hash)).toBeUndefined();
  });

  test('set 后 get 命中', () => {
    const hash = computeInputHash(baseInput);
    cache.set('m1', hash, sampleOutput, 6 * 60 * 60 * 1000);
    const hit = cache.get('m1', hash);
    expect(hit?.output).toEqual(sampleOutput);
  });

  test('TTL 过期后 miss', () => {
    const hash = computeInputHash(baseInput);
    cache.set('m1', hash, sampleOutput, 1000);
    cache = createMemoryCache({ nowMs: () => 1_005_000, seed: cache.dump() });
    expect(cache.get('m1', hash)).toBeUndefined();
  });

  test('不同 inputHash 视为不同条目', () => {
    const otherInput = { ...baseInput, context: { pyth_recent: [{ ts: 2, price: 999 }] } };
    expect(computeInputHash(baseInput)).not.toBe(computeInputHash(otherInput));
  });

  test('同样输入哈希稳定', () => {
    expect(computeInputHash(baseInput)).toBe(computeInputHash(baseInput));
  });
});
