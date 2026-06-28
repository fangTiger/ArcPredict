import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();
const webRoot = cwd.endsWith('/web') ? cwd : resolve(cwd, 'web');

const readRequiredText = (relativePath) => {
  const filePath = resolve(webRoot, relativePath);

  if (!existsSync(filePath)) {
    throw new Error(`缺少文件: web/${relativePath}`);
  }

  return readFileSync(filePath, 'utf8');
};

const assertIncludesAll = (label, source, tokens) => {
  for (const token of tokens) {
    assert(source.includes(token), `${label} 缺少关键内容: ${token}`);
  }
};

const logo = readRequiredText('components/Logo.tsx');
const logoMark = readRequiredText('components/LogoMark.tsx');
const favicon = readRequiredText('public/favicon.svg');
const faviconIco = readFileSync(resolve(webRoot, 'public/favicon.ico'));

assertIncludesAll('Logo.tsx', logo, [
  'ArcPredict',
  'withWordmark',
  'LogoMark',
  'bg-aurora-text',
]);

assertIncludesAll('LogoMark.tsx', logoMark, [
  'data-logo-part="outer-arc"',
  'data-logo-part="probability-line"',
  'data-logo-part="aperture-cut"',
  'data-logo-part="signal-node"',
  'viewBox="0 0 24 24"',
]);

assertIncludesAll('favicon.svg', favicon, [
  'data-logo-part="outer-arc"',
  'data-logo-part="probability-line"',
  'data-logo-part="signal-node"',
  'prefers-color-scheme: light',
]);

const parseIcoDirectory = (source) => {
  assert.equal(source.readUInt16LE(0), 0, 'favicon.ico reserved 字段应为 0');
  assert.equal(source.readUInt16LE(2), 1, 'favicon.ico 类型应为 icon');

  const count = source.readUInt16LE(4);
  const entries = [];

  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    entries.push({
      width: source[offset] || 256,
      height: source[offset + 1] || 256,
      bitCount: source.readUInt16LE(offset + 6),
      bytesInRes: source.readUInt32LE(offset + 8),
      imageOffset: source.readUInt32LE(offset + 12),
    });
  }

  return entries;
};

const readDibPixel = (source, entry, viewBoxX, viewBoxY) => {
  const headerSize = source.readUInt32LE(entry.imageOffset);
  const width = source.readInt32LE(entry.imageOffset + 4);
  const height = source.readInt32LE(entry.imageOffset + 8) / 2;
  assert.equal(headerSize, 40, 'favicon.ico 应使用 BITMAPINFOHEADER');
  assert.equal(source.readUInt16LE(entry.imageOffset + 14), 32, 'favicon.ico 应为 32-bit DIB');

  const x = Math.max(0, Math.min(width - 1, Math.round((viewBoxX / 24) * (width - 1))));
  const y = Math.max(0, Math.min(height - 1, Math.round((viewBoxY / 24) * (height - 1))));
  const bottomUpRow = height - 1 - y;
  const pixelOffset = entry.imageOffset + headerSize + (bottomUpRow * width + x) * 4;

  return {
    b: source[pixelOffset],
    g: source[pixelOffset + 1],
    r: source[pixelOffset + 2],
    a: source[pixelOffset + 3],
  };
};

const icoEntries = parseIcoDirectory(faviconIco);

assert.deepEqual(
  icoEntries.map((entry) => [entry.width, entry.height, entry.bitCount]),
  [
    [16, 16, 32],
    [32, 32, 32],
    [48, 48, 32],
  ],
  'favicon.ico 应包含 16/32/48 三档 32-bit 图标',
);

const thirtyTwo = icoEntries.find((entry) => entry.width === 32);
assert(thirtyTwo, 'favicon.ico 缺少 32px 图标');

const probabilityLinePixel = readDibPixel(faviconIco, thirtyTwo, 12.15, 14.35);
const signalNodePixel = readDibPixel(faviconIco, thirtyTwo, 18.35, 7.55);

assert(
  probabilityLinePixel.a > 180 && probabilityLinePixel.g > 80 && probabilityLinePixel.b > 140,
  'favicon.ico 32px 图标缺少新版 probability-line 核心像素',
);
assert(signalNodePixel.a > 180, 'favicon.ico 32px 图标缺少新版 signal-node 核心像素');

console.log('logo system 检查通过');
