import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const pageSource = readFileSync(resolve(process.cwd(), 'app/market/[id]/page.tsx'), 'utf8');

describe('market detail AI Lens integration', () => {
  test('详情页引入 AILensPanel 并构造 price/event LensInput', () => {
    expect(pageSource).toContain("from '@/components/AILensPanel'");
    expect(pageSource).toContain("from '@/lib/lens/schema'");
    expect(pageSource).toContain('buildPriceLensInput');
    expect(pageSource).toContain('buildEventLensInput');
    expect(pageSource).toContain('outcome_implied_probabilities');
    expect(pageSource).toContain('<AILensPanel');
  });
});
