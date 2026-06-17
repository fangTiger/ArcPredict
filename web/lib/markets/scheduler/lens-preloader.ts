import type { MarketCategory } from '../../market-kind';

export interface LensPreloadTarget {
  eventId: `0x${string}`;
  category: MarketCategory;
  question: string;
  externalKey: string;
  outcomes: { id: string; label: string }[];
}

export interface LensPreloaderOptions {
  /** 注入一个最小化的“调一次 lens 让 cache 写入”的函数。 */
  warmFn: (target: LensPreloadTarget) => Promise<{ status: 'ok' } | { status: 'error' }>;
}

export function createLensPreloader(opts: LensPreloaderOptions) {
  return {
    async warm(target: LensPreloadTarget): Promise<void> {
      try {
        await opts.warmFn(target);
      } catch {
        // best-effort：失败不阻塞 cron 主流程
      }
    },
  };
}
