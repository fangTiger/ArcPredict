import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(testDir, '..');
const failures = [];

const readSource = (relativePath) => {
  const filePath = resolve(webRoot, relativePath);

  if (!existsSync(filePath)) {
    failures.push(`缺少 D5 相关文件: web/${relativePath}`);
    return null;
  }

  return readFileSync(filePath, 'utf8');
};

const check = (callback) => {
  try {
    callback();
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }
};

const assertIncludesAll = (label, source, tokens) => {
  for (const token of tokens) {
    assert(source.includes(token), `${label} 缺少 D5 关键内容: ${token}`);
  }
};

const assertMatches = (label, source, pattern, message) => {
  assert(pattern.test(source), `${label} ${message}`);
};

const homeSource = readSource('app/page.tsx');
const marketDetailSource = readSource('app/market/[id]/page.tsx');
const assetPriceMapSource = readSource('lib/asset-price-map.ts');
const seedWalletSource = readSource('lib/seed-wallets.ts');
const ensureProductionEnvSource = readSource('scripts/ensure-production-env.mjs');
const envExampleSource = readSource('.env.example');

if (homeSource) {
  check(() => {
    assertMatches(
      'web/app/page.tsx',
      homeSource,
      /import\s*\{\s*[^}]*useState[^}]*useMemo[^}]*\}\s*from\s*['"]react['"]/u,
      '必须从 react 同时引入 useState 与 useMemo，准备 D5 过滤状态。',
    );
  });

  check(() => {
    assertMatches(
      'web/app/page.tsx',
      homeSource,
      /import\s*\{\s*[^}]*MarketFilterBar[^}]*filterMarkets[^}]*\}\s*from\s*['"]@\/components\/MarketFilterBar['"]/u,
      '必须引入 MarketFilterBar 与 filterMarkets。',
    );
  });

  check(() => {
    assertMatches(
      'web/app/page.tsx',
      homeSource,
      /import\s*\{\s*ActivityBadges\s*\}\s*from\s*['"]@\/components\/ActivityBadges['"]/u,
      '必须引入 ActivityBadges。',
    );
  });

  check(() => {
    assertMatches(
      'web/app/page.tsx',
      homeSource,
      /import\s*\{\s*isPhase16Enabled\s*\}\s*from\s*['"]@\/lib\/phase16-flag['"]/u,
      '必须引入 isPhase16Enabled。',
    );
  });

  check(() => {
    assertMatches(
      'web/app/page.tsx',
      homeSource,
      /import\s*\{\s*PYTH_PRICE_ID_TO_ASSET\s*\}\s*from\s*['"]@\/lib\/asset-price-map['"]/u,
      '必须从 web/lib/asset-price-map.ts 引入 PYTH_PRICE_ID_TO_ASSET。',
    );
  });

  check(() => {
    assertIncludesAll('web/app/page.tsx', homeSource, [
      'useState',
      'useMemo',
      'MarketFilterBar',
      'filterMarkets',
      'ActivityBadges',
      'isPhase16Enabled',
      'PYTH_PRICE_ID_TO_ASSET',
    ]);
  });

  check(() => {
    assertMatches(
      'web/app/page.tsx',
      homeSource,
      /const\s+showPhase16\s*=\s*isPhase16Enabled\(\);/u,
      '必须声明 showPhase16 开关变量。',
    );
  });

  const visibleMarketsMatch = homeSource.match(
    /const\s+(?<visible>[A-Za-z_]\w*)\s*=\s*useMemo\(\s*\(\)\s*=>\s*\(?\s*showPhase16\s*\?\s*filterMarkets\(\s*activeMarkets\s*,[\s\S]*?priceIdToAsset\s*:\s*PYTH_PRICE_ID_TO_ASSET[\s\S]*?\)\s*:\s*activeMarkets\s*\)?\s*,/u,
  );

  check(() => {
    assert(
      visibleMarketsMatch,
      '首页必须通过 useMemo 生成 showPhase16 控制的可见市场列表，并在 flag 关闭时回退 activeMarkets。',
    );
  });

  check(() => {
    assertMatches(
      'web/app/page.tsx',
      homeSource,
      /showPhase16\s*&&[\s\S]*<ActivityBadges[\s\S]*<MarketFilterBar/u,
      '首页启用 Phase16 时必须同时渲染 ActivityBadges 与 MarketFilterBar。',
    );
  });

  if (visibleMarketsMatch?.groups?.visible) {
    const visibleVariable = visibleMarketsMatch.groups.visible;

    check(() => {
      assertMatches(
        'web/app/page.tsx',
        homeSource,
        new RegExp(
          `\\{\\s*${visibleVariable}\\.map\\s*\\([\\s\\S]*?<MarketCard`,
          'u',
        ),
        `${visibleVariable} 必须驱动 MarketCard 列表渲染。`,
      );
    });
  }
}

if (marketDetailSource) {
  check(() => {
    assertMatches(
      'web/app/market/[id]/page.tsx',
      marketDetailSource,
      /import\s*\{\s*[^}]*useMemo[^}]*\}\s*from\s*['"]react['"]/u,
      '必须从 react 引入 useMemo，计算 seed 披露汇总。',
    );
  });

  check(() => {
    assert(
      /import\s*\{\s*[^}]*useEffect[^}]*\}\s*from\s*['"]react['"]/u.test(marketDetailSource) ||
        /import\s*\{\s*[^}]*usePublicClient[^}]*\}\s*from\s*['"]wagmi['"]/u.test(marketDetailSource),
      '市场详情必须引入 useEffect 或 usePublicClient，用于读取历史 Bet 事件。',
    );
  });

  check(() => {
    assertMatches(
      'web/app/market/[id]/page.tsx',
      marketDetailSource,
      /import\s*\{\s*SeedDisclosure\s*,\s*sumSeedContribution\s*\}\s*from\s*['"]@\/components\/SeedDisclosure['"]/u,
      '必须引入 SeedDisclosure 与 sumSeedContribution。',
    );
  });

  check(() => {
    assertMatches(
      'web/app/market/[id]/page.tsx',
      marketDetailSource,
      /import\s*\{\s*SEED_WALLETS\s*\}\s*from\s*['"]@\/lib\/seed-wallets['"]/u,
      '必须从 web/lib/seed-wallets.ts 引入 SEED_WALLETS。',
    );
  });

  check(() => {
    assertMatches(
      'web/app/market/[id]/page.tsx',
      marketDetailSource,
      /import\s*\{\s*isPhase16Enabled\s*\}\s*from\s*['"]@\/lib\/phase16-flag['"]/u,
      '必须引入 isPhase16Enabled。',
    );
  });

  check(() => {
    assertIncludesAll('web/app/market/[id]/page.tsx', marketDetailSource, [
      'SeedDisclosure',
      'sumSeedContribution',
      'SEED_WALLETS',
      'isPhase16Enabled',
    ]);
  });

  check(() => {
    assertMatches(
      'web/app/market/[id]/page.tsx',
      marketDetailSource,
      /const\s+seedContribution\s*=\s*useMemo\(\s*\(\)\s*=>\s*sumSeedContribution\(\s*[^,]+,\s*SEED_WALLETS/u,
      '必须通过 useMemo + sumSeedContribution 计算 seedContribution。',
    );
  });

  check(() => {
    assert(
      /(getLogs|watchContractEvent|getContractEvents)/u.test(marketDetailSource) &&
        /\bBet\b/u.test(marketDetailSource),
      '必须包含 Bet 事件历史读取逻辑（例如 getLogs + Bet event 扫描）。',
    );
  });

  check(() => {
    assertMatches(
      'web/app/market/[id]/page.tsx',
      marketDetailSource,
      /import\s*\{\s*[^}]*\b(?:FRONTEND_DEPLOY_BLOCK|DEPLOY_BLOCK)\b[^}]*\}\s*from\s*['"]@\/lib\/[^'"]+['"]/u,
      '必须从 lib 引入前端部署区块常量，用于限定 Bet 历史读取起点。',
    );
  });

  check(() => {
    assertMatches(
      'web/app/market/[id]/page.tsx',
      marketDetailSource,
      /getLogs\(\s*\{[\s\S]*fromBlock\s*:\s*(?:FRONTEND_DEPLOY_BLOCK|DEPLOY_BLOCK)\b[\s\S]*\}\s*\)/u,
      'Bet 历史 getLogs 必须设置 fromBlock，并引用前端部署区块常量。',
    );
  });

  check(() => {
    assertMatches(
      'web/app/market/[id]/page.tsx',
      marketDetailSource,
      /getLogs\(\s*\{[\s\S]*toBlock\s*:[\s\S]*\}\s*\)/u,
      'Bet 历史 getLogs 必须设置 toBlock，避免只依赖默认 latest 范围。',
    );
  });

  check(() => {
    assert(
      /const\s+showPhase16\s*=\s*isPhase16Enabled\(\);/u.test(marketDetailSource) ||
        /isPhase16Enabled\(\)\s*&&[\s\S]*<SeedDisclosure/u.test(marketDetailSource),
      '市场详情必须用 isPhase16Enabled 控制 SeedDisclosure 渲染。',
    );
  });

  check(() => {
    assertMatches(
      'web/app/market/[id]/page.tsx',
      marketDetailSource,
      /<SeedDisclosure[^>]*seedContribution=\{seedContribution\}[^>]*loading=\{/u,
      '必须渲染带 loading 态的 SeedDisclosure。',
    );
  });
}

if (assetPriceMapSource) {
  check(() => {
    assertMatches(
      'web/lib/asset-price-map.ts',
      assetPriceMapSource,
      /export\s+const\s+PYTH_PRICE_ID_TO_ASSET/u,
      '必须导出 PYTH_PRICE_ID_TO_ASSET。',
    );
  });

  check(() => {
    assertMatches(
      'web/lib/asset-price-map.ts',
      assetPriceMapSource,
      /scheduler\.config\.ts/u,
      '注释必须提到与 contracts/script/ops/scheduler.config.ts 同步。',
    );
  });

  check(() => {
    assertMatches(
      'web/lib/asset-price-map.ts',
      assetPriceMapSource,
      /(手动同步|手动对齐)/u,
      '注释必须说明 owner 需要手动同步或手动对齐。',
    );
  });

  check(() => {
    assertMatches(
      'web/lib/asset-price-map.ts',
      assetPriceMapSource,
      /export\s+const\s+(?:FRONTEND_DEPLOY_BLOCK|DEPLOY_BLOCK)\b/u,
      '必须导出前端部署区块常量，供市场详情 Bet 历史读取使用。',
    );
  });

  check(() => {
    assertMatches(
      'web/lib/asset-price-map.ts',
      assetPriceMapSource,
      /DEPLOY_BLOCK/u,
      '注释必须说明前端部署区块常量要和 ops DEPLOY_BLOCK 手动同步。',
    );
  });
}

if (seedWalletSource) {
  check(() => {
    assertMatches(
      'web/lib/seed-wallets.ts',
      seedWalletSource,
      /export\s+const\s+SEED_WALLETS/u,
      '必须导出 SEED_WALLETS。',
    );
  });

  check(() => {
    assertMatches(
      'web/lib/seed-wallets.ts',
      seedWalletSource,
      /E1/u,
      '注释必须说明 E1 会覆盖真实 seed 地址。',
    );
  });

  check(() => {
    assertMatches(
      'web/lib/seed-wallets.ts',
      seedWalletSource,
      /generate-seeds/u,
      '注释必须说明 generate-seeds 会写入真实地址。',
    );
  });

  check(() => {
    assertMatches(
      'web/lib/seed-wallets.ts',
      seedWalletSource,
      /(覆盖|替换|写入)[\s\S]{0,40}真实地址|真实地址[\s\S]{0,40}(覆盖|替换|写入)/u,
      '注释必须明确这是可被 E1 覆盖的真实地址占位。',
    );
  });

  check(() => {
    assert(!/PRIVATE_KEY/u.test(seedWalletSource), 'web/lib/seed-wallets.ts 不得包含 PRIVATE_KEY。');
    assert(!/private\s*key/iu.test(seedWalletSource), 'web/lib/seed-wallets.ts 不得出现 private key 字样。');
  });
}

if (ensureProductionEnvSource) {
  check(() => {
    assertMatches(
      'web/scripts/ensure-production-env.mjs',
      ensureProductionEnvSource,
      /NEXT_PUBLIC_PHASE16_ENABLED/u,
      '必须提到 NEXT_PUBLIC_PHASE16_ENABLED。',
    );
  });

  check(() => {
    assertMatches(
      'web/scripts/ensure-production-env.mjs',
      ensureProductionEnvSource,
      /NEXT_PUBLIC_PHASE16_ENABLED[\s\S]{0,120}(可选|非必需|不强制)|(可选|非必需|不强制)[\s\S]{0,120}NEXT_PUBLIC_PHASE16_ENABLED/u,
      '必须把 NEXT_PUBLIC_PHASE16_ENABLED 标成可选 / 非必需 / 不强制 的中文提示。',
    );
  });
}

if (envExampleSource) {
  check(() => {
    assertMatches(
      'web/.env.example',
      envExampleSource,
      /^NEXT_PUBLIC_PHASE16_ENABLED=false$/mu,
      'E1 前必须提供 NEXT_PUBLIC_PHASE16_ENABLED=false 示例，避免占位 priceId/seed 默认开启。',
    );
  });
}

if (failures.length > 0) {
  console.error('Phase16 集成检查失败：');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('phase16 integration 检查通过');
