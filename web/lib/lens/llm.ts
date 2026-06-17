export type DeepSeekConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
};

export type DeepSeekCallParams = {
  config: DeepSeekConfig;
  systemPrompt: string;
  userMessage: string;
  fetchImpl?: typeof fetch;
};

export type DeepSeekResult = {
  contentJson: unknown;
  usage: { promptTokens: number; completionTokens: number };
};

class NonRetryableDeepSeekError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nonRetryableHttpStatuses = new Set([400, 401, 403]);

export async function callDeepSeek(params: DeepSeekCallParams): Promise<DeepSeekResult> {
  const { config, systemPrompt, userMessage } = params;
  const fetchImpl = params.fetchImpl ?? fetch;

  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  };

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const message = `DeepSeek HTTP ${res.status}`;
        if (nonRetryableHttpStatuses.has(res.status)) {
          throw new NonRetryableDeepSeekError(message);
        }
        throw new Error(message);
      }
      const payload = (await res.json()) as {
        choices: { message: { content: string } }[];
        usage: { prompt_tokens: number; completion_tokens: number };
      };
      const content = payload.choices?.[0]?.message?.content ?? '';
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new NonRetryableDeepSeekError('DeepSeek 返回非 JSON 内容');
      }
      return {
        contentJson: parsed,
        usage: {
          promptTokens: payload.usage?.prompt_tokens ?? 0,
          completionTokens: payload.usage?.completion_tokens ?? 0,
        },
      };
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof NonRetryableDeepSeekError) throw err;
      lastErr = err;
      if (attempt < config.maxRetries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
    }
  }
  throw lastErr ?? new Error('DeepSeek 调用失败');
}
