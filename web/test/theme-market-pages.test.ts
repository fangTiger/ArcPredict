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
  it('wires the home page to ThemeMarketBoard', () => {
    const source = readRequired('app/page.tsx');

    expect(source).toContain('ThemeMarketBoard');
    expect(source).toContain('getThemePackById');
  });

  it('defines a dedicated /theme/[themeId] page', () => {
    const source = readRequired('app/theme/[themeId]/page.tsx');

    expect(source).toContain('ThemeMarketBoard');
    expect(source).toContain('getThemePackById');
  });

  it('uses the latest proposal event and explorer link in the market detail trust flow', () => {
    const source = readRequired('app/market/[id]/page.tsx');

    expect(source).not.toContain('const first = proposedEvents[0]');
    expect(source).toContain('proposedEvents.at(-1)');
    expect(source).toContain('blockExplorers.default.url');
    expect(source).toContain('sourceHref=');
    expect(source).toContain('evidence=');
    expect(source).toContain('eventRow.eventId');
    expect(source).toContain('eventMarketDeployment.oracleAddress');
  });
});
