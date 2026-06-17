import { describe, expect, test } from 'vitest';

import {
  LensInputSchema,
  LensOutputSchema,
  FORBIDDEN_WORDS,
  selectOutputSchema,
} from '../lib/lens/schema';

describe('lens.schema', () => {
  test('LensInput 接受合法 crypto-binary 输入', () => {
    const ok = LensInputSchema.safeParse({
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
    });
    expect(ok.success).toBe(true);
  });

  test('LensInput 拒绝越界 implied_probability', () => {
    const bad = LensInputSchema.safeParse({
      market: {
        id: 'x',
        question: 'q',
        type: 'crypto-binary',
        end_time: 1,
        implied_probability: 1.5,
      },
      context: {},
      generated_at: 1,
    });
    expect(bad.success).toBe(false);
  });

  test('LensInput 接受带 outcome 隐含概率的 event-multi 输入', () => {
    const ok = LensInputSchema.safeParse({
      market: {
        id: 'arg-bra',
        question: 'Argentina vs Brazil winner',
        type: 'event-multi',
        end_time: 1893456000,
        implied_probability: 0.45,
        outcome_options: ['ARG', 'BRA', 'DRAW'],
        outcome_implied_probabilities: { ARG: 0.45, BRA: 0.35, DRAW: 0.2 },
      },
      context: {
        facts: [{ key: 'stage', value: 'final', source: 'seed' }],
      },
      generated_at: 1718524800,
    });

    expect(ok.success).toBe(true);
  });

  test('LensInput 拒绝缺失 outcome 隐含概率的 event-multi 输入', () => {
    const bad = LensInputSchema.safeParse({
      market: {
        id: 'arg-bra',
        question: 'Argentina vs Brazil winner',
        type: 'event-multi',
        end_time: 1893456000,
        implied_probability: 0.45,
        outcome_options: ['ARG', 'BRA', 'DRAW'],
      },
      context: {},
      generated_at: 1718524800,
    });

    expect(bad.success).toBe(false);
  });

  test('LensOutput binary：fair_range 必须按 [low, high] 升序', () => {
    const ok = LensOutputSchema.safeParse({
      summary: 'BTC 距阈值 1.8σ，AI 估算偏低于市场。',
      factors: ['波动率 42%', '距离阈值 1.8σ', '历史样本偏空'],
      fair_range: [0.18, 0.25],
      confidence: 'med',
      reasoning: '基于 Pyth 30 天波动率与剩余时间。',
      sources: [{ name: 'Pyth', ref: 'BTC/USD', ts: 1 }],
      caveats: ['不含突发新闻'],
    });
    expect(ok.success).toBe(true);

    const bad = LensOutputSchema.safeParse({
      summary: 'x',
      factors: ['a', 'b', 'c'],
      fair_range: [0.5, 0.2],
      confidence: 'low',
      reasoning: 'r',
      sources: [],
      caveats: [],
    });
    expect(bad.success).toBe(false);
  });

  test('LensOutput multi：outcome_fair_probabilities 必填', () => {
    const ok = LensOutputSchema.safeParse({
      summary: '阿根廷概率领先。',
      factors: ['近期战绩', '主力健康', '历史对阵'],
      outcome_fair_probabilities: {
        ARG: [0.45, 0.55],
        DRAW: [0.15, 0.25],
        BRA: [0.25, 0.35],
      },
      confidence: 'med',
      reasoning: 'r',
      sources: [{ name: 'facts', ref: 'arg-vs-bra', ts: 1 }],
      caveats: [],
    });
    expect(ok.success).toBe(true);
  });

  test('LensOutput sources[].ts 接受 ISO 字符串并转成 unix 秒数', () => {
    const ok = LensOutputSchema.safeParse({
      summary: '阿根廷概率领先。',
      factors: ['近期战绩', '主力健康', '历史对阵'],
      outcome_fair_probabilities: {
        ARG: [0.45, 0.55],
        DRAW: [0.15, 0.25],
        BRA: [0.25, 0.35],
      },
      confidence: 'med',
      reasoning: 'r',
      sources: [{ name: 'facts', ref: 'arg-vs-bra', ts: '2025-12-01T00:00:00Z' }],
      caveats: [],
    });

    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.sources[0].ts).toBe(1764547200);
    }
  });

  test('LensOutput sources[].ts 拒绝无法解析的日期字符串', () => {
    const bad = LensOutputSchema.safeParse({
      summary: '阿根廷概率领先。',
      factors: ['近期战绩', '主力健康', '历史对阵'],
      outcome_fair_probabilities: {
        ARG: [0.45, 0.55],
        DRAW: [0.15, 0.25],
        BRA: [0.25, 0.35],
      },
      confidence: 'med',
      reasoning: 'r',
      sources: [{ name: 'facts', ref: 'arg-vs-bra', ts: 'not-a-date' }],
      caveats: [],
    });

    expect(bad.success).toBe(false);
  });

  test('禁止词命中导致 schema 拒绝', () => {
    expect(FORBIDDEN_WORDS).toContain('建议下注');
    const bad = LensOutputSchema.safeParse({
      summary: '建议下注 Yes',
      factors: ['a', 'b', 'c'],
      fair_range: [0.3, 0.4],
      confidence: 'low',
      reasoning: 'r',
      sources: [],
      caveats: [],
    });
    expect(bad.success).toBe(false);
  });

  test('selectOutputSchema 按 crypto-binary 拒绝 multi 输出字段', () => {
    const schema = selectOutputSchema('crypto-binary');
    const bad = schema.safeParse({
      summary: 'BTC 概率区间无法由多结果字段表达。',
      factors: ['波动率', '价格距离', '剩余时间'],
      outcome_fair_probabilities: {
        YES: [0.45, 0.55],
        NO: [0.45, 0.55],
      },
      confidence: 'low',
      reasoning: 'r',
      sources: [],
      caveats: [],
    });
    expect(bad.success).toBe(false);
  });
});
