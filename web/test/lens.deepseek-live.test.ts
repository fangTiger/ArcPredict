// 真实 DeepSeek 端到端烟测：需要 .env.local 提供 DEEPSEEK_API_KEY。
// 默认 skip，避免 CI 误烧 token；本地运行加 LENS_LIVE_SMOKE=1 解锁。

import { describe, expect, test } from 'vitest';

import {
  BinaryOutputSchema,
  MultiOutputSchema,
  buildSystemPrompt,
  buildUserMessage,
  callDeepSeek,
  type LensInput,
} from '../lib/lens';

const live = process.env.LENS_LIVE_SMOKE === '1';
const apiKey = process.env.DEEPSEEK_API_KEY ?? '';
const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
const baseUrl = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';

const cryptoInput: LensInput = {
  market: {
    id: 'btc-100k-2026',
    question: 'BTC 在 2026-12-31 前是否 ≥ $100,000？',
    type: 'crypto-binary',
    end_time: Math.floor(new Date('2026-12-31T23:59:59Z').getTime() / 1000),
    implied_probability: 0.32,
  },
  context: {
    pyth_recent: [
      { ts: 1_780_000_000, price: 68_000 },
      { ts: 1_780_086_400, price: 70_500 },
      { ts: 1_780_172_800, price: 69_200 },
    ],
    volatility_30d: 0.42,
    distance_to_threshold_sigma: 1.8,
  },
  generated_at: Math.floor(Date.now() / 1000),
};

const eventInput: LensInput = {
  market: {
    id: 'wc-2026-final',
    question: '2026 FIFA 世界杯冠军是谁？',
    type: 'event-multi',
    end_time: Math.floor(new Date('2026-07-19T20:00:00Z').getTime() / 1000),
    implied_probability: 0.18,
    outcome_options: ['ARG', 'BRA', 'FRA', 'ESP'],
    outcome_implied_probabilities: { ARG: 0.18, BRA: 0.22, FRA: 0.20, ESP: 0.15 },
  },
  context: {
    facts: [
      { key: 'tournament', value: '2026 FIFA World Cup', source: 'FIFA' },
      { key: 'arg_form', value: '卫冕冠军，南美预选第 1', source: 'CONMEBOL' },
      { key: 'bra_form', value: '南美预选第 2，主力健康', source: 'CONMEBOL' },
    ],
  },
  generated_at: Math.floor(Date.now() / 1000),
};

describe.skipIf(!live)('DeepSeek live smoke', () => {
  test('crypto-binary 输出通过 BinaryOutputSchema', async () => {
    const { contentJson, usage } = await callDeepSeek({
      config: { apiKey, baseUrl, model, timeoutMs: 30_000, maxRetries: 1 },
      systemPrompt: buildSystemPrompt(),
      userMessage: buildUserMessage(cryptoInput),
    });
    const parsed = BinaryOutputSchema.safeParse(contentJson);
    if (!parsed.success) {
      console.error('Schema failure. Raw output:', JSON.stringify(contentJson, null, 2));
      console.error('Errors:', parsed.error.format());
    } else {
      console.log('Crypto Lens output sample:');
      console.log('  summary:', parsed.data.summary);
      console.log('  fair_range:', parsed.data.fair_range);
      console.log('  confidence:', parsed.data.confidence);
      console.log('  factors:', parsed.data.factors);
      console.log('  usage:', usage);
    }
    expect(parsed.success).toBe(true);
  }, 35_000);

  test('event-multi 输出通过 MultiOutputSchema', async () => {
    const { contentJson, usage } = await callDeepSeek({
      config: { apiKey, baseUrl, model, timeoutMs: 30_000, maxRetries: 1 },
      systemPrompt: buildSystemPrompt(),
      userMessage: buildUserMessage(eventInput),
    });
    const parsed = MultiOutputSchema.safeParse(contentJson);
    if (!parsed.success) {
      console.error('Schema failure. Raw output:', JSON.stringify(contentJson, null, 2));
      console.error('Errors:', parsed.error.format());
    } else {
      console.log('Event Lens output sample:');
      console.log('  summary:', parsed.data.summary);
      console.log('  outcome_fair_probabilities:', parsed.data.outcome_fair_probabilities);
      console.log('  confidence:', parsed.data.confidence);
      console.log('  factors:', parsed.data.factors);
      console.log('  usage:', usage);
    }
    expect(parsed.success).toBe(true);
  }, 35_000);
});
