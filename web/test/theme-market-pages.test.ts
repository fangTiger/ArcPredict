import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = resolve(__dirname, '..');

function readRequired(relativePath: string): string {
  const filePath = resolve(webRoot, relativePath);
  expect(existsSync(filePath), `missing ${relativePath}`).toBe(true);
  return readFileSync(filePath, 'utf8');
}

describe('theme market page integration', () => {
  it('wires the home page to ThemeMarketBoard and rich discovery sections', () => {
    const source = readRequired('app/page.tsx');

    expect(source).toContain('ThemeMarketBoard');
    expect(source).toContain('MarketDiscoveryRail');
    expect(source).toContain('getThemePackById');
    expect(source).toContain('selectTodayBoard');
    expect(source).toContain('selectTrendingMarkets');
    expect(source).toContain('selectClosingSoon');
    expect(source).toContain('selectRecentlyResolved');
    expect(source).toContain('toRichMarketRef');
    expect(source).not.toContain('/api/lens/');
  });

  it('defines a dedicated /theme/[themeId] page', () => {
    const source = readRequired('app/theme/[themeId]/page.tsx');

    expect(source).toContain('ThemeMarketBoard');
    expect(source).toContain('getThemePackById');
  });

  it('does not block the theme page behind a perpetual contract loading state', () => {
    const source = readRequired('app/theme/[themeId]/page.tsx');

    expect(source).not.toContain(') : isLoading ? (');
    expect(source).toContain('isError && boardMarkets.length === 0');
  });

  it('uses the latest proposal event and rich archive panels in the market detail flow', () => {
    const source = readRequired('app/market/[id]/page.tsx');

    expect(source).not.toContain('const first = proposedEvents[0]');
    expect(source).toContain('proposedEvents.at(-1)');
    expect(source).toContain('blockExplorers.default.url');
    expect(source).toContain('sourceHref=');
    expect(source).toContain('evidence=');
    expect(source).toContain('eventRow.eventId');
    expect(source).toContain('eventMarketDeployment.oracleAddress');
    expect(source).toContain('MarketStoryPanel');
    expect(source).toContain('RelatedMarketsPanel');
    expect(source).toContain('ActivityTimeline');
    expect(source).toContain('deriveMarketStory');
    expect(source).toContain('selectRelatedMarkets');
    expect(source).toContain('toRichMarketRef');
  });
});
