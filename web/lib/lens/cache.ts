import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LensInput, LensOutput } from './schema';

export type CacheEntry = {
  output: LensOutput;
  storedAtMs: number;
  expiresAtMs: number;
};

export type CacheDump = Record<string, CacheEntry>;

export type CacheOptions = {
  nowMs?: () => number;
  seed?: CacheDump;
};

export function loadCacheDumpFromFile(filePath: string): CacheDump | undefined {
  if (!existsSync(filePath)) return undefined;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as CacheDump;
  } catch {
    return undefined;
  }
}

export function saveCacheDumpToFile(filePath: string, dump: CacheDump): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(dump, null, 2), 'utf-8');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function computeInputHash(input: LensInput): string {
  const canonical = stableStringify({
    market: input.market,
    context: input.context,
  });
  return createHash('sha1').update(canonical).digest('hex').slice(0, 12);
}

const key = (marketId: string, inputHash: string) => `${marketId}:${inputHash}`;

export function createMemoryCache(opts: CacheOptions = {}) {
  const now = opts.nowMs ?? (() => Date.now());
  const store: Map<string, CacheEntry> = new Map();
  if (opts.seed) {
    for (const [k, v] of Object.entries(opts.seed)) {
      if (v.expiresAtMs > now()) store.set(k, v);
    }
  }

  return {
    get(marketId: string, inputHash: string): CacheEntry | undefined {
      const cacheKey = key(marketId, inputHash);
      const entry = store.get(cacheKey);
      if (!entry) return undefined;
      if (entry.expiresAtMs <= now()) {
        store.delete(cacheKey);
        return undefined;
      }
      return entry;
    },

    set(marketId: string, inputHash: string, output: LensOutput, ttlMs: number) {
      const t = now();
      store.set(key(marketId, inputHash), {
        output,
        storedAtMs: t,
        expiresAtMs: t + ttlMs,
      });
    },

    dump(): CacheDump {
      const out: CacheDump = {};
      for (const [k, v] of store.entries()) out[k] = v;
      return out;
    },
  };
}
