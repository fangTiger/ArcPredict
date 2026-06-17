import { z } from 'zod';

export const FORBIDDEN_WORDS = [
  '建议下注',
  '建议买入',
  '建议卖出',
  '建议加仓',
  '推荐下注',
  '推荐买入',
  '推荐卖出',
  'recommend buy',
  'recommend sell',
  'recommend bet',
  'all in',
  'all-in',
] as const;

const containsForbidden = (text: string): boolean =>
  FORBIDDEN_WORDS.some((w) => text.toLowerCase().includes(w.toLowerCase()));

const safeText = (max: number) =>
  z.string().max(max).refine((s) => !containsForbidden(s), {
    message: '含禁止建议性措辞',
  });

const probability = z.number().min(0).max(1);
const probRange = z
  .tuple([probability, probability])
  .refine(([lo, hi]) => lo <= hi, { message: 'fair_range 必须按 [low, high] 升序' });

const MarketMetaBinary = z.object({
  id: z.string(),
  question: z.string(),
  type: z.literal('crypto-binary'),
  end_time: z.number().int().positive(),
  implied_probability: probability,
});

export const MarketMetaMulti = z.object({
  id: z.string(),
  question: z.string(),
  type: z.literal('event-multi'),
  end_time: z.number().int().positive(),
  implied_probability: probability,
  outcome_options: z.array(z.string()).min(2),
  outcome_implied_probabilities: z.record(z.string(), probability),
});

const CryptoContext = z.object({
  pyth_recent: z.array(z.object({ ts: z.number(), price: z.number() })).optional(),
  volatility_30d: z.number().optional(),
  distance_to_threshold_sigma: z.number().optional(),
});

const EventContext = z.object({
  facts: z
    .array(z.object({ key: z.string(), value: z.string(), source: z.string() }))
    .optional(),
});

export const LensInputSchema = z.object({
  market: z.discriminatedUnion('type', [MarketMetaBinary, MarketMetaMulti]),
  context: CryptoContext.merge(EventContext),
  generated_at: z.number().int().positive(),
});

export type LensInput = z.infer<typeof LensInputSchema>;

const SourceItem = z.object({
  name: z.string(),
  ref: z.string(),
  ts: z.number(),
});

const BaseOutputFields = {
  summary: safeText(280),
  factors: z.array(safeText(120)).min(3).max(5),
  confidence: z.enum(['low', 'med', 'high']),
  reasoning: safeText(800),
  sources: z.array(SourceItem),
  caveats: z.array(z.string().max(200)).max(3),
};

export const BinaryOutputSchema = z.object({
  ...BaseOutputFields,
  fair_range: probRange,
  outcome_fair_probabilities: z.undefined().optional(),
});

export const MultiOutputSchema = z.object({
  ...BaseOutputFields,
  fair_range: z.undefined().optional(),
  outcome_fair_probabilities: z.record(z.string(), probRange).refine(
    (rec) => Object.keys(rec).length >= 2,
    { message: 'outcome_fair_probabilities 至少 2 项' },
  ),
});

export function selectOutputSchema(marketType: 'crypto-binary' | 'event-multi') {
  return marketType === 'crypto-binary' ? BinaryOutputSchema : MultiOutputSchema;
}

export const LensOutputSchema = z.union([BinaryOutputSchema, MultiOutputSchema]);
export type LensOutput = z.infer<typeof LensOutputSchema>;
