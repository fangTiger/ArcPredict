import { describe, it, expect, vi } from 'vitest';
import { createLensPreloader } from '../../lib/markets/scheduler/lens-preloader';

describe('lens-preloader', () => {
  it('warm invokes the lens route handler and ignores errors', async () => {
    const warm = vi.fn().mockResolvedValue({ status: 'ok' });
    const preloader = createLensPreloader({ warmFn: warm });

    await preloader.warm({
      eventId: '0xab' as any,
      category: 'macro',
      question: 'Q',
      externalKey: 'CPIAUCSL:2026-07-15',
      outcomes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
    });
    expect(warm).toHaveBeenCalledOnce();
  });

  it('swallows warmFn failure (preload is best-effort)', async () => {
    const warm = vi.fn().mockRejectedValue(new Error('boom'));
    const preloader = createLensPreloader({ warmFn: warm });
    await expect(
      preloader.warm({
        eventId: '0xab' as any,
        category: 'chain',
        question: 'Q',
        externalKey: 'eth:tvl:gte:1:2026-09-30',
        outcomes: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }],
      }),
    ).resolves.toBeUndefined();
  });
});
