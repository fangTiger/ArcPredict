import { describe, it, expect, vi } from 'vitest';
import { buildMacroLensContext } from '../../../lib/lens/contextBuilders/macro';

const fakeFred = {
  getLatestObservation: vi.fn().mockResolvedValue({ date: '2026-05-15', value: 3.1 }),
  getObservationByDate: vi.fn().mockResolvedValue(null),
};

describe('macro lens contextBuilder', () => {
  it('includes seriesId + latest observation + outcome ranges', async () => {
    const ctx = await buildMacroLensContext({
      fredClient: fakeFred as any,
      market: {
        eventId: '0x00' as any,
        question: 'US CPI YoY on 2026-07-15',
        externalKey: 'CPIAUCSL:2026-07-15',
        outcomes: [
          { id: 'lt25', label: '< 2.5%' },
          { id: 'mid', label: '2.5%-3.5%' },
          { id: 'gt35', label: '> 3.5%' },
        ],
      },
    });
    expect(ctx.seriesId).toBe('CPIAUCSL');
    expect(ctx.latest).toEqual({ date: '2026-05-15', value: 3.1 });
    expect(ctx.outcomes).toHaveLength(3);
  });
});
