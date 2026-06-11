import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();
const webRoot = cwd.endsWith('/web') ? cwd : resolve(cwd, 'web');
const vercelConfigPath = resolve(webRoot, 'vercel.json');

assert(existsSync(vercelConfigPath), '缺少文件: web/vercel.json');

const vercelConfigSource = readFileSync(vercelConfigPath, 'utf8');

let vercelConfig;

try {
  vercelConfig = JSON.parse(vercelConfigSource);
} catch (error) {
  throw new Error(
    `web/vercel.json 不是合法 JSON: ${error instanceof Error ? error.message : String(error)}`,
  );
}

assert.equal(
  vercelConfig.buildCommand,
  'node scripts/ensure-production-env.mjs && pnpm build',
  'buildCommand 必须严格先执行生产环境变量校验，再执行 pnpm build',
);
assert.equal(vercelConfig.framework, 'nextjs', 'framework 必须等于 nextjs');

const forbiddenFields = ['installCommand', 'outputDirectory', 'devCommand'];

for (const field of forbiddenFields) {
  assert(!(field in vercelConfig), `web/vercel.json 不应包含 ${field}`);
}

console.log('vercel 配置检查通过');
