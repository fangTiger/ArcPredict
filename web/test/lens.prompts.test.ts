import { describe, expect, test } from 'vitest';

import { buildSystemPrompt, buildUserMessage } from '../lib/lens/prompts';
import type { LensInput } from '../lib/lens/schema';

const cryptoInput: LensInput = {
  market: {
    id: 'btc-100k',
    question: 'BTC 在 2026-12-31 前是否 ≥ $100k？',
    type: 'crypto-binary',
    end_time: 1893456000,
    implied_probability: 0.32,
  },
  context: {
    pyth_recent: [{ ts: 1, price: 65000 }],
    volatility_30d: 0.42,
    distance_to_threshold_sigma: 1.8,
  },
  generated_at: 1718524800,
};

describe('lens.prompts', () => {
  test('system prompt 包含五条铁律关键短语', () => {
    const sp = buildSystemPrompt();
    expect(sp).toMatch(/Output JSON only|JSON only/);
    expect(sp).toMatch(/recommend|advisory/i);
    expect(sp).toMatch(/\[unverified\]/);
    expect(sp).toMatch(/≥\s*2|two sources/i);
    expect(sp).toMatch(/5\s*pp|0\.05/);
    expect(sp).toMatch(/English/);
  });

  test('user message 是合法 JSON 字符串且包含 market.id', () => {
    const msg = buildUserMessage(cryptoInput);
    expect(() => JSON.parse(msg)).not.toThrow();
    const obj = JSON.parse(msg);
    expect(obj.market.id).toBe('btc-100k');
  });

  test('system prompt 明确要求 sources ts 使用 unix 秒数', () => {
    expect(buildSystemPrompt()).toMatch(/unix seconds|unix timestamp/i);
  });
});
