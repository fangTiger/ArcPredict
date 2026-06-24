import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('playwright');

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3100';
const outDir = resolve('artifacts/project-intro-video/screens');

const shots = [
  {
    name: 'crypto-desktop',
    url: `${baseUrl}/?category=crypto`,
    viewport: { width: 1440, height: 900 },
    waitMs: 3500,
  },
  {
    name: 'worldcup-desktop',
    url: `${baseUrl}/`,
    viewport: { width: 1440, height: 900 },
    waitMs: 3500,
  },
  {
    name: 'worldcup-cards',
    url: `${baseUrl}/`,
    viewport: { width: 1440, height: 900 },
    scrollY: 520,
    waitMs: 3500,
  },
  {
    name: 'worldcup-mobile',
    url: `${baseUrl}/`,
    viewport: { width: 390, height: 844 },
    waitMs: 3500,
  },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const failures = [];

for (const shot of shots) {
  const context = await browser.newContext({
    deviceScaleFactor: 1,
    viewport: shot.viewport,
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push(`${shot.name}: ${error.message}`));
  await page.goto(shot.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(shot.waitMs);
  if (shot.scrollY) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), shot.scrollY);
    await page.waitForTimeout(800);
  }
  await page.screenshot({
    path: resolve(outDir, `${shot.name}.png`),
    fullPage: false,
  });
  await context.close();
}

await browser.close();

if (failures.length > 0) {
  console.warn(`Captured with page warnings:\n${failures.join('\n')}`);
}

console.log(`Screenshots written to ${outDir}`);
