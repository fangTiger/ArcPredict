const invalidWalletConnectProjectIds = new Set(['placeholder', 'local-development-only']);

function readEnv(name) {
  return process.env[name]?.trim() ?? '';
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const walletConnectProjectId = readEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID');
const hermesEndpoint = readEnv('NEXT_PUBLIC_PYTH_HERMES_ENDPOINT');
const errors = [];

if (!walletConnectProjectId) {
  errors.push('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID 缺失，生产部署前必须填入 Reown Dashboard 创建的真实 Project ID。');
} else if (invalidWalletConnectProjectIds.has(walletConnectProjectId)) {
  errors.push(
    `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID 不能使用占位值 "${walletConnectProjectId}"，必须填入 Reown Dashboard 创建的真实 Project ID。`,
  );
}

if (!hermesEndpoint) {
  errors.push('NEXT_PUBLIC_PYTH_HERMES_ENDPOINT 缺失，生产部署前必须配置可用的 Hermes HTTP(S) 端点。');
} else if (!isValidHttpUrl(hermesEndpoint)) {
  errors.push('NEXT_PUBLIC_PYTH_HERMES_ENDPOINT 必须是 http:// 或 https:// 开头的有效 URL。');
}

if (errors.length > 0) {
  console.error('生产环境变量校验失败：');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('生产环境变量校验通过');
