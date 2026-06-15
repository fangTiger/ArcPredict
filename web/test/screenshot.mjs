import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
const outDir = resolve('test/snapshots/synthra-redesign/final');

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];
const pages = [
  { name: 'home', path: '/' },
  { name: 'connect', path: '/connect' },
  // 详情页需要一个真实存在的 market id；运行时改成实际 id。
  // { name: 'detail', path: '/market/1' },
];

for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  for (const p of pages) {
    const page = await context.newPage();
    await page.goto(`${baseUrl}${p.path}`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${outDir}/${vp.name}-${p.name}.png`, fullPage: true });
    await page.close();
  }
  await context.close();
}

await browser.close();
console.log(`Snapshots written to ${outDir}`);
