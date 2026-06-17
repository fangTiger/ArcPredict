import { NextRequest, NextResponse } from 'next/server';

import {
  LensInputSchema,
  callDeepSeek,
  computeInputHash,
  createBudgetTracker,
  createMemoryCache,
  type LensInput,
} from '../../../../lib/lens';
import {
  handleLensRequest,
  safeErrorMessage,
  type LensRouteResponse,
} from '@/lib/lens/route-handler';

export const dynamic = 'force-dynamic';

let _cache: ReturnType<typeof createMemoryCache> | undefined;
let _budget: ReturnType<typeof createBudgetTracker> | undefined;

function getCache() {
  if (!_cache) _cache = createMemoryCache();
  return _cache;
}

function getBudget() {
  if (!_budget) {
    _budget = createBudgetTracker({
      dailyLimitUsd: Number(process.env.LENS_DAILY_BUDGET_USD ?? 1.0),
      inputPricePerMTokens: Number(process.env.LENS_INPUT_PRICE_PER_M_TOKENS ?? 0.07),
      outputPricePerMTokens: Number(process.env.LENS_OUTPUT_PRICE_PER_M_TOKENS ?? 1.10),
    });
  }
  return _budget;
}

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
  const lensCache = getCache();
  const hit = lensCache.get(input.market.id, inputHash);
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
    budget: getBudget(),
    ttlMs: ttlMsForMarketType(input.market.type),
  });

  if (result.status === 'ok' && result._newOutput) {
    lensCache.set(
      input.market.id,
      result._newOutput.inputHash,
      result._newOutput.output,
      result._newOutput.ttlMs,
    );
    delete result._newOutput;
  }

  return NextResponse.json(result, { status: httpStatusForResult(result) });
}
