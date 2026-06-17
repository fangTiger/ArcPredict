export type FredObservation = { date: string; value: number };

type CacheEntry<T> = { value: T; expiresAt: number };

type RawFredObservation = {
  date?: unknown;
  value?: unknown;
};

type FredObservationsResponse = {
  observations?: RawFredObservation[];
};

export interface FredClient {
  getLatestObservation(seriesId: string): Promise<FredObservation | null>;
  getObservationByDate(seriesId: string, date: string): Promise<FredObservation | null>;
}

export interface FredClientOptions {
  fetch?: typeof globalThis.fetch;
  apiKey?: string;
  baseUrl?: string;
  cacheTtlMs?: number;
  now?: () => number;
}

export function createFredClient(opts: FredClientOptions = {}): FredClient {
  const fetch = opts.fetch ?? globalThis.fetch;
  const baseUrl = opts.baseUrl ?? 'https://api.stlouisfed.org/fred';
  const apiKey = opts.apiKey ?? process.env.FRED_API_KEY ?? '';
  const ttl = opts.cacheTtlMs ?? 24 * 60 * 60 * 1000;
  const now = opts.now ?? Date.now;
  const cache = new Map<string, CacheEntry<unknown>>();

  const cached = async <T>(key: string, loader: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now()) return hit.value as T;
    const value = await loader();
    cache.set(key, { value, expiresAt: now() + ttl });
    return value;
  };

  const get = async (path: string, qs: Record<string, string>): Promise<FredObservationsResponse> => {
    const url = new URL(`${baseUrl}${path}`);
    for (const [k, v] of Object.entries({ ...qs, api_key: apiKey, file_type: 'json' })) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`FRED ${path} ${res.status}`);
    return res.json();
  };

  const parseObs = (raw: RawFredObservation | undefined): FredObservation | null => {
    if (!raw || raw.value === '.' || raw.value == null) return null;
    const value = Number(raw.value);
    if (Number.isNaN(value)) return null;
    return { date: String(raw.date), value };
  };

  return {
    async getLatestObservation(seriesId) {
      return cached(`latest:${seriesId}`, async () => {
        const data = await get('/series/observations', {
          series_id: seriesId,
          sort_order: 'desc',
          limit: '1',
        });
        return parseObs(data.observations?.[0]);
      });
    },

    async getObservationByDate(seriesId, date) {
      return cached(`obs:${seriesId}:${date}`, async () => {
        const data = await get('/series/observations', {
          series_id: seriesId,
          observation_start: date,
          observation_end: date,
        });
        return parseObs(data.observations?.[0]);
      });
    },
  };
}
