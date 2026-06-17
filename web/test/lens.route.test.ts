import { afterEach, describe, expect, test, vi } from 'vitest';

import { handleLensRequest } from '../app/api/lens/[marketId]/route';
import type { LensInput } from '../lib/lens/schema';

const fakeInput: LensInput = {
  market: {
    id: 'm1',
    question: 'q',
    type: 'crypto-binary',
    end_time: 9_999_999_999,
    implied_probability: 0.3,
  },
  context: { pyth_recent: [{ ts: 1, price: 100 }] },
  generated_at: 1718524800,
};

const fakeLensOutput = {
  summary: 's',
  factors: ['a', 'b', 'c'],
  fair_range: [0.1, 0.2],
  confidence: 'low',
  reasoning: 'r',
  sources: [],
  caveats: [],
};

const eventInput: LensInput = {
  market: {
    id: 'match-1',
    question: 'ARG vs BRA',
    type: 'event-multi',
    end_time: 9_999_999_999,
    implied_probability: 0.4,
    outcome_options: ['ARG', 'DRAW', 'BRA'],
    outcome_implied_probabilities: { ARG: 0.45, DRAW: 0.2, BRA: 0.35 },
  },
  context: { facts: [{ key: 'tournament', value: '2026 FIFA World Cup', source: 'FIFA' }] },
  generated_at: 1718524800,
};

const fakeEventLensOutput = {
  summary: 'ARG 略占优。',
  factors: ['近期战绩', '阵容健康', '历史对阵'],
  outcome_fair_probabilities: {
    ARG: [0.45, 0.55],
    DRAW: [0.15, 0.25],
    BRA: [0.25, 0.35],
  },
  confidence: 'med',
  reasoning: 'r',
  sources: [],
  caveats: [],
};

afterEach(() => vi.restoreAllMocks());

describe('lens.route.handleLensRequest', () => {
  test('miss 时调用 LLM 并写缓存', async () => {
    const callLLM = vi.fn().mockResolvedValue({
      contentJson: fakeLensOutput,
      usage: { promptTokens: 100, completionTokens: 80 },
    });
    const result = await handleLensRequest({
      input: fakeInput,
      cache: undefined,
      callLLM,
      budget: { canSpend: () => true, record: () => {}, estimateCostUsd: () => 0.0003 },
      ttlMs: 60_000,
    });
    expect(result.status).toBe('ok');
    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  test('cache hit 不调用 LLM', async () => {
    const callLLM = vi.fn();
    const result = await handleLensRequest({
      input: fakeInput,
      cache: {
        output: fakeLensOutput as any,
        storedAtMs: 0,
        expiresAtMs: 9_999_999_999_999,
      },
      callLLM,
      budget: { canSpend: () => true, record: () => {}, estimateCostUsd: () => 0 },
      ttlMs: 60_000,
    });
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.cached).toBe(true);
    expect(callLLM).not.toHaveBeenCalled();
  });

  test('预算耗尽返回 budget_exhausted', async () => {
    const callLLM = vi.fn();
    const result = await handleLensRequest({
      input: fakeInput,
      cache: undefined,
      callLLM,
      budget: { canSpend: () => false, record: () => {}, estimateCostUsd: () => 0.0003 },
      ttlMs: 60_000,
    });
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.code).toBe('budget_exhausted');
  });

  test('crypto-binary 收到 multi 输出返回 schema_failure', async () => {
    const callLLM = vi.fn().mockResolvedValue({
      contentJson: {
        summary: 's',
        factors: ['a', 'b', 'c'],
        outcome_fair_probabilities: {
          YES: [0.1, 0.2],
          NO: [0.8, 0.9],
        },
        confidence: 'low',
        reasoning: 'r',
        sources: [],
        caveats: [],
      },
      usage: { promptTokens: 100, completionTokens: 80 },
    });
    const result = await handleLensRequest({
      input: fakeInput,
      cache: undefined,
      callLLM,
      budget: { canSpend: () => true, record: () => {}, estimateCostUsd: () => 0.0003 },
      ttlMs: 60_000,
    });
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.code).toBe('schema_failure');
  });

  test('llm_failure 不泄露 API key', async () => {
    const callLLM = vi.fn().mockRejectedValue(new Error('Bearer sk-LEAKED-KEY-shouldnt-show'));
    const result = await handleLensRequest({
      input: fakeInput,
      cache: undefined,
      callLLM,
      budget: { canSpend: () => true, record: () => {}, estimateCostUsd: () => 0.0003 },
      ttlMs: 60_000,
    });
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('llm_failure');
      expect(result.message).not.toContain('sk-LEAKED-KEY');
    }
  });

  test('schema_failure 不返回 _newOutput', async () => {
    const callLLM = vi.fn().mockResolvedValue({
      contentJson: { foo: 'bar' },
      usage: { promptTokens: 100, completionTokens: 80 },
    });
    const result = await handleLensRequest({
      input: fakeInput,
      cache: undefined,
      callLLM,
      budget: { canSpend: () => true, record: () => {}, estimateCostUsd: () => 0.0003 },
      ttlMs: 60_000,
    });
    expect(result.status).toBe('error');
    expect('_newOutput' in result).toBe(false);
  });

  test('ttlMs 透传到 _newOutput', async () => {
    const cryptoCallLLM = vi.fn().mockResolvedValue({
      contentJson: fakeLensOutput,
      usage: { promptTokens: 100, completionTokens: 80 },
    });
    const eventCallLLM = vi.fn().mockResolvedValue({
      contentJson: fakeEventLensOutput,
      usage: { promptTokens: 100, completionTokens: 80 },
    });
    const cryptoTtlMs = 6 * 60 * 60 * 1000;
    const eventTtlMs = 24 * 60 * 60 * 1000;

    const cryptoResult = await handleLensRequest({
      input: fakeInput,
      cache: undefined,
      callLLM: cryptoCallLLM,
      budget: { canSpend: () => true, record: () => {}, estimateCostUsd: () => 0.0003 },
      ttlMs: cryptoTtlMs,
    });
    const eventResult = await handleLensRequest({
      input: eventInput,
      cache: undefined,
      callLLM: eventCallLLM,
      budget: { canSpend: () => true, record: () => {}, estimateCostUsd: () => 0.0003 },
      ttlMs: eventTtlMs,
    });

    expect(cryptoResult.status).toBe('ok');
    if (cryptoResult.status === 'ok') expect(cryptoResult._newOutput?.ttlMs).toBe(cryptoTtlMs);
    expect(eventResult.status).toBe('ok');
    if (eventResult.status === 'ok') expect(eventResult._newOutput?.ttlMs).toBe(eventTtlMs);
  });
});
