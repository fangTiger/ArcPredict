import { NextRequest, NextResponse } from 'next/server';

import {
  LensInputSchema,
  buildSystemPrompt,
  buildUserMessage,
  callDeepSeek,
  computeInputHash,
  createBudgetTracker,
  createMemoryCache,
  selectOutputSchema,
  type CacheEntry,
  type LensInput,
  type LensOutput,
  type LensRouteResponse,
} from '../../../../lib/lens';

export const dynamic = 'force-dynamic';

const cache = createMemoryCache();
const budget = createBudgetTracker({
  dailyLimitUsd: Number(process.env.LENS_DAILY_BUDGET_USD ?? 1.0),
  inputPricePerMTokens: Number(process.env.LENS_INPUT_PRICE_PER_M_TOKENS ?? 0.07),
  outputPricePerMTokens: Number(process.env.LENS_OUTPUT_PRICE_PER_M_TOKENS ?? 1.10),
});

export type HandleLensParams = {
  input: LensInput;
  cache: CacheEntry | undefined;
  callLLM: (args: { systemPrompt: string; userMessage: string }) => Promise<{
    contentJson: unknown;
    usage: { promptTokens: number; completionTokens: number };
  }>;
  budget: {
    canSpend: (usd: number) => boolean;
    record: (usd: number) => void;
    estimateCostUsd: (inputTokens: number, outputTokens: number) => number;
  };
  ttlMs: number;
  nowMs?: () => number;
};

type HandleLensResult = LensRouteResponse & {
  _newOutput?: { output: LensOutput; inputHash: string; ttlMs: number };
};

const safeErrorMessage = (code: LensRouteResponse extends infer R
  ? R extends { status: 'error'; code: infer C }
    ? C
    : never
  : never): string => {
  switch (code) {
    case 'budget_exhausted':
      return '日预算已用尽';
    case 'invalid_market':
      return '市场输入无效';
    case 'schema_failure':
      return 'AI Lens 输出未通过结构校验';
    case 'rate_limited':
      return '请求过于频繁';
    case 'llm_failure':
    default:
      return 'AI Lens 暂不可用，请稍后重试';
  }
};

const ttlMsForMarketType = (marketType: LensInput['market']['type']): number => {
  const hours =
    marketType === 'crypto-binary'
      ? Number(process.env.LENS_CRYPTO_TTL_HOURS ?? 6)
      : Number(process.env.LENS_EVENT_TTL_HOURS ?? 24);
  return hours * 60 * 60 * 1000;
};

const httpStatusForResult = (result: LensRouteResponse): number => {
  if (result.status === 'ok') return 200;
  if (result.code === 'budget_exhausted') return 429;
  if (result.code === 'invalid_market') return 400;
  return 502;
};

export async function handleLensRequest(params: HandleLensParams): Promise<HandleLensResult> {
  const { input, cache: hit, callLLM, budget: b, ttlMs } = params;
  const now = params.nowMs ?? (() => Date.now());
  const inputHash = computeInputHash(input);

  if (hit) {
    return {
      status: 'ok',
      cached: true,
      output: hit.output,
      meta: { last_updated_ms: hit.storedAtMs, input_hash: inputHash },
    };
  }

  const estimatedCost = b.estimateCostUsd(600, 300);
  if (!b.canSpend(estimatedCost)) {
    return {
      status: 'error',
      code: 'budget_exhausted',
      message: safeErrorMessage('budget_exhausted'),
    };
  }

  let raw: { contentJson: unknown; usage: { promptTokens: number; completionTokens: number } };
  try {
    raw = await callLLM({
      systemPrompt: buildSystemPrompt(),
      userMessage: buildUserMessage(input),
    });
  } catch {
    return {
      status: 'error',
      code: 'llm_failure',
      message: safeErrorMessage('llm_failure'),
    };
  }

  const actualCost = b.estimateCostUsd(raw.usage.promptTokens, raw.usage.completionTokens);
  b.record(actualCost);

  const outputSchema = selectOutputSchema(input.market.type);
  const parsed = outputSchema.safeParse(raw.contentJson);
  if (!parsed.success) {
    return {
      status: 'error',
      code: 'schema_failure',
      message: safeErrorMessage('schema_failure'),
    };
  }

  return {
    status: 'ok',
    cached: false,
    output: parsed.data,
    meta: { last_updated_ms: now(), input_hash: inputHash },
    _newOutput: { output: parsed.data, inputHash, ttlMs },
  };
}

export async function POST(req: NextRequest, { params }: { params: { marketId: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const result: LensRouteResponse = {
      status: 'error',
      code: 'invalid_market',
      message: safeErrorMessage('invalid_market'),
    };
    return NextResponse.json(result, { status: httpStatusForResult(result) });
  }

  const parsedInput = LensInputSchema.safeParse(body);
  if (!parsedInput.success || parsedInput.data.market.id !== params.marketId) {
    const result: LensRouteResponse = {
      status: 'error',
      code: 'invalid_market',
      message: safeErrorMessage('invalid_market'),
    };
    return NextResponse.json(result, { status: httpStatusForResult(result) });
  }

  const input = parsedInput.data;
  const inputHash = computeInputHash(input);
  const hit = cache.get(input.market.id, inputHash);
  const apiKey = process.env.DEEPSEEK_API_KEY ?? '';
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com';
  const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-v4';

  const result = await handleLensRequest({
    input,
    cache: hit,
    callLLM: async ({ systemPrompt, userMessage }) =>
      callDeepSeek({
        config: { apiKey, baseUrl, model, timeoutMs: 5000, maxRetries: 1 },
        systemPrompt,
        userMessage,
      }),
    budget,
    ttlMs: ttlMsForMarketType(input.market.type),
  });

  if (result.status === 'ok' && result._newOutput) {
    cache.set(
      input.market.id,
      result._newOutput.inputHash,
      result._newOutput.output,
      result._newOutput.ttlMs,
    );
    delete result._newOutput;
  }

  return NextResponse.json(result, { status: httpStatusForResult(result) });
}
