import { describe, it, expect, vi } from 'vitest';
import { buildCategoryContextProse } from '../../lib/lens/contextBuilders';
import { handleLensRequest } from '../../lib/lens/route-handler';
import type { LensInput } from '../../lib/lens/schema';

const macroInput = {
  market: {
    id: 'macro-cpi',
    eventId: '0x00',
    question: 'US CPI YoY on 2026-07-15',
    type: 'event-multi',
    category: 'macro',
    externalKey: 'CPIAUCSL:2026-07-15',
    outcomes: [
      { id: 'lt25', label: '< 2.5%' },
      { id: 'mid', label: '2.5%-3.5%' },
      { id: 'gt35', label: '> 3.5%' },
    ],
    end_time: 9_999_999_999,
    implied_probability: 0.4,
    outcome_options: ['< 2.5%', '2.5%-3.5%', '> 3.5%'],
    outcome_implied_probabilities: {
      '< 2.5%': 0.25,
      '2.5%-3.5%': 0.5,
      '> 3.5%': 0.25,
    },
  },
  context: {},
  generated_at: 1718524800,
} as LensInput;

const fakeMultiOutput = {
  summary: 'Macro market context points to a balanced CPI range.',
  factors: ['Latest CPI print', 'Outcome range width', 'Release timing'],
  outcome_fair_probabilities: {
    '< 2.5%': [0.2, 0.3],
    '2.5%-3.5%': [0.45, 0.55],
    '> 3.5%': [0.2, 0.3],
  },
  confidence: 'med',
  reasoning: 'Reasoning uses only supplied category context.',
  sources: [],
  caveats: [],
};

describe('buildCategoryContextProse', () => {
  it('returns macro prose when category=macro', async () => {
    const fredClient = {
      getLatestObservation: vi.fn().mockResolvedValue({ date: '2026-05-15', value: 3.1 }),
      getObservationByDate: vi.fn(),
    };
    const prose = await buildCategoryContextProse({
      category: 'macro',
      fredClient: fredClient as any,
      market: {
        eventId: '0x00' as any,
        question: 'Q',
        externalKey: 'CPIAUCSL:2026-07-15',
        outcomes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
      },
    });
    expect(prose).toContain('CPI');
  });

  it('returns null for unrelated categories', async () => {
    const prose = await buildCategoryContextProse({
      category: 'crypto',
      market: { eventId: '0x00' as any, question: 'Q', externalKey: 'x', outcomes: [] },
    });
    expect(prose).toBeNull();
  });
});

describe('lens route category dispatch', () => {
  it('injects macro prose into the user message before calling the LLM', async () => {
    const fredClient = {
      getLatestObservation: vi.fn().mockResolvedValue({ date: '2026-05-15', value: 3.1 }),
      getObservationByDate: vi.fn(),
    };
    const callLLM = vi.fn().mockResolvedValue({
      contentJson: fakeMultiOutput,
      usage: { promptTokens: 100, completionTokens: 80 },
    });

    const result = await handleLensRequest({
      input: macroInput,
      cache: undefined,
      callLLM,
      budget: { canSpend: () => true, record: () => {}, estimateCostUsd: () => 0.0003 },
      ttlMs: 24 * 60 * 60 * 1000,
      categoryClients: { fredClient: fredClient as any },
    } as any);

    expect(result.status).toBe('ok');
    expect(callLLM).toHaveBeenCalledOnce();
    const userMessage = callLLM.mock.calls[0][0].userMessage;
    expect(userMessage).toContain('[Category context]');
    expect(userMessage).toContain('US CPI');
  });
});
