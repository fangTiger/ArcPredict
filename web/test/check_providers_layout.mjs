import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readText(relativePath) {
  return readFile(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

async function main() {
  const providers = await readText('../app/providers.tsx');
  const layout = await readText('../app/layout.tsx');
  const globals = await readText('../app/globals.css');

  const firstEffectiveLine = providers
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('//'));

  assert(firstEffectiveLine === "'use client';", "providers.tsx 第一条有效语句必须是 'use client';");

  const providerTokens = [
    'getDefaultConfig',
    'getWalletConnectProjectId',
    'WagmiProvider',
    'QueryClientProvider',
    'RainbowKitProvider',
    'darkTheme',
    'arcTestnet',
    "@rainbow-me/rainbowkit/styles.css",
    'ssr: true',
    "'local-development-only'",
  ];

  for (const token of providerTokens) {
    assert(providers.includes(token), `providers.tsx 缺少关键内容: ${token}`);
  }

  assert(!providers.includes("'placeholder'"), "providers.tsx 不应包含裸字符串 'placeholder'");
  assert(!providers.includes('"placeholder"'), 'providers.tsx 不应包含裸字符串 "placeholder"');

  const layoutTokens = [
    'Providers',
    '<Providers>{children}</Providers>',
    'lang="zh-CN"',
    'fonts.googleapis.com/css2?family=Geist',
    'Geist+Mono',
    'Instrument+Serif',
    'bg-base text-zinc-100 antialiased',
  ];

  for (const token of layoutTokens) {
    assert(layout.includes(token), `layout.tsx 缺少关键内容: ${token}`);
  }

  const globalTokens = [
    '@tailwind base;',
    '@tailwind components;',
    '@tailwind utilities;',
    'font-variant-numeric: tabular-nums',
    'text-wrap: pretty',
    '.font-mono',
    'letter-spacing: 0',
  ];

  for (const token of globalTokens) {
    assert(globals.includes(token), `globals.css 缺少关键内容: ${token}`);
  }

  console.log('check_providers_layout: OK');
}

main().catch((error) => {
  console.error(`check_providers_layout: FAIL\n${error.message}`);
  process.exitCode = 1;
});
