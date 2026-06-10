import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const webRoot = resolve(process.cwd(), 'web');
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

assert.equal(typeof vercelConfig.buildCommand, 'string', 'buildCommand 必须是字符串');
assert(
  vercelConfig.buildCommand.includes('node scripts/ensure-production-env.mjs'),
  'buildCommand 必须先执行生产环境变量校验脚本',
);
assert(
  vercelConfig.buildCommand.includes('pnpm build'),
  'buildCommand 必须包含 pnpm build',
);
assert.equal(vercelConfig.framework, 'nextjs', 'framework 必须等于 nextjs');

const forbiddenFields = ['installCommand', 'outputDirectory', 'devCommand'];

for (const field of forbiddenFields) {
  assert(!(field in vercelConfig), `web/vercel.json 不应包含 ${field}`);
}

console.log('vercel 配置检查通过');
