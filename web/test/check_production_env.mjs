import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const webRoot = resolve(process.cwd(), 'web');
const scriptPath = resolve(webRoot, 'scripts/ensure-production-env.mjs');

function runEnsureProductionEnv(envOverrides) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: webRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: '',
      NEXT_PUBLIC_PYTH_HERMES_ENDPOINT: '',
      ...envOverrides,
    },
  });
}

function assertFailed(result, message) {
  assert.notEqual(result.status, 0, message);
}

function assertPassed(result, message) {
  assert.equal(result.status, 0, `${message}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

const missingProjectId = runEnsureProductionEnv({
  NEXT_PUBLIC_PYTH_HERMES_ENDPOINT: 'https://hermes.pyth.network',
});
assertFailed(missingProjectId, '缺少 Project ID 时必须失败');
assert.match(
  `${missingProjectId.stdout}\n${missingProjectId.stderr}`,
  /NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID/u,
  '缺少 Project ID 时应提示对应变量名',
);

const placeholderProjectId = runEnsureProductionEnv({
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: 'placeholder',
  NEXT_PUBLIC_PYTH_HERMES_ENDPOINT: 'https://hermes.pyth.network',
});
assertFailed(placeholderProjectId, 'placeholder Project ID 必须失败');
assert.match(
  `${placeholderProjectId.stdout}\n${placeholderProjectId.stderr}`,
  /placeholder/u,
  'placeholder Project ID 时应提示占位值非法',
);

const validProductionEnv = runEnsureProductionEnv({
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: 'reown-project-id-123',
  NEXT_PUBLIC_PYTH_HERMES_ENDPOINT: 'https://hermes.pyth.network',
});
assertPassed(validProductionEnv, '合法生产环境变量应通过校验');
assert.match(
  validProductionEnv.stdout,
  /生产环境变量校验通过/u,
  '通过时应输出中文成功提示',
);

console.log('check_production_env: OK');
