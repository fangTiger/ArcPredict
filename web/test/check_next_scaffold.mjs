import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const webRoot = resolve(process.cwd(), 'web');
const requiredFiles = [
  'package.json',
  'pnpm-lock.yaml',
  'next.config.js',
  'tailwind.config.ts',
  'postcss.config.js',
  'tsconfig.json',
  '.env.example',
  '.eslintrc.json',
];

const missingFiles = requiredFiles.filter((file) => !existsSync(resolve(webRoot, file)));

if (missingFiles.length > 0) {
  throw new Error(`缺少脚手架文件: ${missingFiles.join(', ')}`);
}

const packageJson = JSON.parse(readFileSync(resolve(webRoot, 'package.json'), 'utf8'));

const expectedScripts = {
  dev: 'next dev',
  build: 'next build',
  start: 'next start',
  lint: 'next lint',
  typecheck: 'tsc --noEmit',
};

for (const [name, command] of Object.entries(expectedScripts)) {
  if (packageJson.scripts?.[name] !== command) {
    throw new Error(`scripts.${name} 不符合预期`);
  }
}

const expectedDeps = [
  'next',
  'react',
  'react-dom',
  'typescript',
  '@types/node',
  '@types/react',
  '@types/react-dom',
  'wagmi',
  'viem',
  '@rainbow-me/rainbowkit',
  '@tanstack/react-query',
  '@pythnetwork/hermes-client',
];

for (const name of expectedDeps) {
  if (!packageJson.dependencies?.[name] && !packageJson.devDependencies?.[name]) {
    throw new Error(`缺少依赖: ${name}`);
  }
}

const expectedDevDeps = [
  'tailwindcss',
  'postcss',
  'autoprefixer',
  'eslint',
  'eslint-config-next',
];

for (const name of expectedDevDeps) {
  if (!packageJson.devDependencies?.[name]) {
    throw new Error(`缺少开发依赖: ${name}`);
  }
}

const envExample = readFileSync(resolve(webRoot, '.env.example'), 'utf8');
const expectedEnvLines = [
  'NEXT_PUBLIC_RPC_URL=https://rpc.testnet.arc.network',
  'NEXT_PUBLIC_CHAIN_ID=5042002',
  'NEXT_PUBLIC_USDC_ADDRESS=0x3600000000000000000000000000000000000000',
  'NEXT_PUBLIC_PYTH_HERMES_ENDPOINT=https://hermes.pyth.network',
];

for (const line of expectedEnvLines) {
  if (!envExample.includes(line)) {
    throw new Error(`.env.example 缺少配置: ${line}`);
  }
}

const gitignore = readFileSync(resolve(process.cwd(), '.gitignore'), 'utf8');
const tsbuildIgnorePatterns = ['*.tsbuildinfo', 'web/tsconfig.tsbuildinfo'];

if (!tsbuildIgnorePatterns.some((pattern) => gitignore.includes(pattern))) {
  throw new Error('缺少 tsbuildinfo 忽略规则');
}

const eslintConfig = JSON.parse(readFileSync(resolve(webRoot, '.eslintrc.json'), 'utf8'));

if (!Array.isArray(eslintConfig.extends) || !eslintConfig.extends.includes('next/core-web-vitals')) {
  throw new Error('ESLint 配置未启用 next/core-web-vitals');
}

const nextConfigSource = readFileSync(resolve(webRoot, 'next.config.js'), 'utf8');
if (!nextConfigSource.includes('reactStrictMode: true')) {
  throw new Error('next.config.js 缺少 reactStrictMode: true');
}

const tailwindConfigSource = readFileSync(resolve(webRoot, 'tailwind.config.ts'), 'utf8');
const requiredTailwindTokens = [
  "./app/**/*.{ts,tsx}",
  "./components/**/*.{ts,tsx}",
  "canvas: '#FBFAF7'",
  "paper: '#FFFFFF'",
  "ink: '#0A0B0F'",
  "'ink-2': '#5B6478'",
  "hair: '#E8E6DF'",
  "arc: '#1652F0'",
  "'arc-deep': '#0B2DB8'",
  "'arc-tint': '#E8EEFE'",
  "yes: '#16A34A'",
  "no: '#DC2626'",
  "heat: '#FF6B35'",
  "sans: ['Geist', 'system-ui', 'sans-serif']",
  "mono: ['Geist Mono', 'monospace']",
];

for (const token of requiredTailwindTokens) {
  if (!tailwindConfigSource.includes(token)) {
    throw new Error(`tailwind.config.ts 缺少配置: ${token}`);
  }
}

const forbiddenTailwindTokens = [
  "accent: '#ff6b35'",
  "warning: '#f59e0b'",
  "base: '#0b0c0e'",
  "surface: '#14161a'",
  "elevated: '#1c1f24'",
];

for (const token of forbiddenTailwindTokens) {
  if (tailwindConfigSource.includes(token)) {
    throw new Error(`tailwind.config.ts 不应保留旧 token: ${token}`);
  }
}

const tsconfig = JSON.parse(readFileSync(resolve(webRoot, 'tsconfig.json'), 'utf8'));
const compilerOptions = tsconfig.compilerOptions ?? {};

if (compilerOptions.strict !== true) {
  throw new Error('tsconfig.json 缺少 strict: true');
}

if (compilerOptions.moduleResolution !== 'bundler') {
  throw new Error('tsconfig.json 缺少 moduleResolution: bundler');
}

if (compilerOptions.paths?.['@/*']?.[0] !== './*') {
  throw new Error('tsconfig.json 缺少 @/* 路径映射');
}

const pageSource = readFileSync(resolve(webRoot, 'app/page.tsx'), 'utf8');
const forbiddenPhrases = ['验证', '初始化', '后续 Phase', '当前页面仅用于'];
const forbiddenTypographyTokens = ['tracking-', 'letterSpacing'];

for (const phrase of forbiddenPhrases) {
  if (pageSource.includes(phrase)) {
    throw new Error(`占位页包含解释性文案: ${phrase}`);
  }
}

for (const token of forbiddenTypographyTokens) {
  if (pageSource.includes(token)) {
    throw new Error(`占位页包含禁止的排版标记: ${token}`);
  }
}

console.log('脚手架检查通过');
