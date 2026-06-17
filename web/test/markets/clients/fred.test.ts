import { describe, it, expect, vi } from 'vitest';
import { createFredClient } from '../../../lib/markets/clients/fred';

const mockFetch = (payload: unknown, status = 200) =>
  vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });

describe('fred client', () => {
  it('getLatestObservation parses value + date', async () => {
    const fetch = mockFetch({
      observations: [
        { date: '2026-06-12', value: '3.21' },
        { date: '2026-05-15', value: '3.18' },
      ],
    });
    const c = createFredClient({ fetch: fetch as unknown as typeof globalThis.fetch });
    const obs = await c.getLatestObservation('CPIAUCSL');
    expect(obs).toEqual({ date: '2026-06-12', value: 3.21 });
  });

  it('returns null when observations array is empty', async () => {
    const fetch = mockFetch({ observations: [] });
    const c = createFredClient({ fetch: fetch as unknown as typeof globalThis.fetch });
    expect(await c.getLatestObservation('X')).toBeNull();
  });

  it('throws on non-200', async () => {
    const fetch = mockFetch({}, 500);
    const c = createFredClient({ fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(c.getLatestObservation('X')).rejects.toThrow(/FRED/);
  });

  it('cache hits skip fetch for TTL', async () => {
    const fetch = mockFetch({ observations: [{ date: '2026-06-01', value: '1' }] });
    const c = createFredClient({
      fetch: fetch as unknown as typeof globalThis.fetch,
      cacheTtlMs: 60_000,
      now: () => 0,
    });
    await c.getLatestObservation('X');
    await c.getLatestObservation('X');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
