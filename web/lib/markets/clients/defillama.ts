export interface DefiLlamaClient {
  getChainTvl(chainName: string): Promise<number | null>;
  getProtocolTvlSeries(slug: string): Promise<{ ts: number; tvl: number }[]>;
}

export interface DefiLlamaClientOptions {
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
  cacheTtlMs?: number;
  now?: () => number;
}

type ChainTvlRow = { name: string; tvl: number };

type ProtocolTvlRow = {
  date: number;
  totalLiquidityUSD: number;
};

type ProtocolTvlResponse = {
  tvl?: ProtocolTvlRow[];
};

export function createDefiLlamaClient(opts: DefiLlamaClientOptions = {}): DefiLlamaClient {
  const fetch = opts.fetch ?? globalThis.fetch;
  const baseUrl = opts.baseUrl ?? process.env.DEFILLAMA_BASE_URL ?? 'https://api.llama.fi';
  const ttl = opts.cacheTtlMs ?? 60 * 60 * 1000;
  const now = opts.now ?? Date.now;
  const cache = new Map<string, { value: unknown; expiresAt: number }>();

  const cached = async <T>(key: string, loader: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now()) return hit.value as T;
    const value = await loader();
    cache.set(key, { value, expiresAt: now() + ttl });
    return value;
  };

  const get = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${baseUrl}${path}`);
    if (!res.ok) throw new Error(`DefiLlama ${path} ${res.status}`);
    return res.json();
  };

  return {
    async getChainTvl(chainName) {
      const map = await cached('chains', async () => {
        const list = await get<ChainTvlRow[]>('/v2/chains');
        return new Map(list.map((x) => [x.name.toLowerCase(), x.tvl]));
      });
      return map.get(chainName.toLowerCase()) ?? null;
    },

    async getProtocolTvlSeries(slug) {
      return cached(`protocol:${slug}`, async () => {
        const data = await get<ProtocolTvlResponse>(`/protocol/${slug}`);
        const arr = data.tvl ?? [];
        return arr.map((p) => ({ ts: p.date, tvl: p.totalLiquidityUSD }));
      });
    },
  };
}
