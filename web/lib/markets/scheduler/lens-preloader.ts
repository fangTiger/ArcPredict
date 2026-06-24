import type { MarketCategory } from '../../market-kind';
import { safeErrorMessage } from './safe-report';
import type { LensPreloadResult } from './types';

export interface LensPreloadTarget {
  eventId: `0x${string}`;
  category: MarketCategory;
  question: string;
  externalKey: string;
  outcomes: { id: string; label: string }[];
  themeId?: string;
}

export interface LensPreloaderOptions {
  /** 注入一个最小化的“调一次 lens 让 cache 写入”的函数。 */
  warmFn: (target: LensPreloadTarget) => Promise<{ status: 'ok' } | { status: 'error' }>;
}

export function createLensPreloader(opts: LensPreloaderOptions) {
  return {
    async warm(target: LensPreloadTarget): Promise<LensPreloadResult> {
      try {
        const result = await opts.warmFn(target);
        if (result.status === 'ok') {
          return { status: 'warmed' };
        }
        return {
          status: 'warning',
          warning: 'Lens preload unavailable',
        };
      } catch (error) {
        return {
          status: 'warning',
          warning: `Lens preload unavailable: ${safeErrorMessage(error, 'preload failed')}`,
        };
      }
    },
  };
}
