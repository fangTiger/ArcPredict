import { computeInputHash } from './cache';
import type { CacheEntry } from './cache';
import { buildSystemPrompt, buildUserMessage } from './prompts';
import { selectOutputSchema } from './schema';
import type { LensInput, LensOutput } from './schema';

export type LensRouteResponseOk = {
  status: 'ok';
  cached: boolean;
  output: LensOutput;
  meta: { last_updated_ms: number; input_hash: string };
};

export type LensRouteResponseErr = {
  status: 'error';
  code:
    | 'invalid_market'
    | 'budget_exhausted'
    | 'llm_failure'
    | 'schema_failure'
    | 'rate_limited';
  message: string;
};

export type LensRouteResponse = LensRouteResponseOk | LensRouteResponseErr;

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

export type HandleLensResult = LensRouteResponse & {
  _newOutput?: { output: LensOutput; inputHash: string; ttlMs: number };
};

export const safeErrorMessage = (code: LensRouteResponseErr['code']): string => {
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
