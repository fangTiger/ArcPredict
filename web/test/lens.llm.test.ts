import { afterEach, describe, expect, test, vi } from 'vitest';

import { callDeepSeek, type DeepSeekConfig } from '../lib/lens/llm';

const baseConfig: DeepSeekConfig = {
  apiKey: 'sk-test',
  baseUrl: 'https://api.deepseek.test',
  model: 'deepseek-v4',
  timeoutMs: 200,
  maxRetries: 1,
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lens.llm.callDeepSeek', () => {
  test('成功响应返回 parsed content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const result = await callDeepSeek({
      config: baseConfig,
      systemPrompt: 'sys',
      userMessage: 'usr',
      fetchImpl: fetchMock as any,
    });
    expect(result.contentJson).toEqual({ ok: true });
    expect(result.usage.promptTokens).toBe(100);
    expect(result.usage.completionTokens).toBe(50);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain('/chat/completions');
  });

  test('网络失败重试 1 次', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{}' } }],
            usage: { prompt_tokens: 0, completion_tokens: 0 },
          }),
          { status: 200 },
        ),
      );
    const result = await callDeepSeek({
      config: baseConfig,
      systemPrompt: 'sys',
      userMessage: 'usr',
      fetchImpl: fetchMock as any,
    });
    expect(result.contentJson).toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('401 认证失败不重试', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    await expect(
      callDeepSeek({
        config: baseConfig,
        systemPrompt: 'sys',
        userMessage: 'usr',
        fetchImpl: fetchMock as any,
      }),
    ).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('404 客户端错误不重试', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    await expect(
      callDeepSeek({
        config: baseConfig,
        systemPrompt: 'sys',
        userMessage: 'usr',
        fetchImpl: fetchMock as any,
      }),
    ).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('408 timeout 响应会重试', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 408 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ retried: true }) } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
          { status: 200 },
        ),
      );
    const result = await callDeepSeek({
      config: baseConfig,
      systemPrompt: 'sys',
      userMessage: 'usr',
      fetchImpl: fetchMock as any,
    });
    expect(result.contentJson).toEqual({ retried: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('429 rate limit 响应会重试', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ retried: true }) } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
          { status: 200 },
        ),
      );
    const result = await callDeepSeek({
      config: baseConfig,
      systemPrompt: 'sys',
      userMessage: 'usr',
      fetchImpl: fetchMock as any,
    });
    expect(result.contentJson).toEqual({ retried: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('非 JSON content 抛错', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'not json at all' } }],
          usage: { prompt_tokens: 0, completion_tokens: 0 },
        }),
        { status: 200 },
      ),
    );
    await expect(
      callDeepSeek({
        config: baseConfig,
        systemPrompt: 'sys',
        userMessage: 'usr',
        fetchImpl: fetchMock as any,
      }),
    ).rejects.toThrow(/JSON/);
  });
});
