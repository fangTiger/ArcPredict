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
const betEventScanSource = readSource('lib/bet-event-scan.ts');
const seedWalletSource = readSource('lib/seed-wallets.ts');
const ensureProductionEnvSource = readSource('scripts/ensure-production-env.mjs');
const envExampleSource = readSource('.env.example');

if (homeSource) {
  check(() => {
    assertIncludesAll('web/app/page.tsx D5 首页契约', homeSource, [
      'MarketFilterBar',
      'filterMarkets',
      'ActivityBadges',
      'isPhase16Enabled',
      'PYTH_PRICE_ID_TO_ASSET',
    ]);
  });

  check(() => {
    assert(
      /\bshowPhase16\b/u.test(homeSource) || /isPhase16Enabled\(\)/u.test(homeSource),
      'web/app/page.tsx 必须有 showPhase16 或等价 isPhase16Enabled() 开关。',
    );
  });

  check(() => {
    assertMatches(
      'web/app/page.tsx',
      homeSource,
      /filterMarkets\(\s*(activeMarkets|rows|markets|[A-Za-z_]\w*Markets?)\b/u,
      '必须把 filterMarkets 用在 activeMarkets 或市场列表上。',
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

  check(() => {
    const directFilteredMapPattern =
      /filterMarkets\([\s\S]{0,800}\)\.map\([\s\S]{0,500}<MarketCard/u;
    const namedFilteredListMapPattern =
      /\{\s*(?:visible|filtered|display|shown)[A-Za-z0-9_]*\.map\([\s\S]{0,500}<MarketCard/u;
    assert(
      directFilteredMapPattern.test(homeSource) || namedFilteredListMapPattern.test(homeSource),
      'MarketCard 列表必须来自过滤后的列表或 filterMarkets 结果，不能永远直接使用未过滤 activeMarkets.map。',
    );
  });
}

if (marketDetailSource) {
  check(() => {
    assertIncludesAll('web/app/market/[id]/page.tsx seed 披露契约', marketDetailSource, [
      'SeedDisclosure',
      'sumSeedContribution',
      'SEED_WALLETS',
      'isPhase16Enabled',
    ]);
  });

  check(() => {
    assert(
      /sumSeedContribution\(/u.test(marketDetailSource) || /useBetEventsForMarket/u.test(marketDetailSource),
      '市场详情必须计算 seed 披露金额，或委托 useBetEventsForMarket 相关 hook。',
    );
  });

  check(() => {
    assert(
      /(fetchLogsPaged|getLogs|watchContractEvent|getContractEvents|useBetEventsForMarket)/u.test(
        marketDetailSource,
      ) &&
        /\bBet\b/u.test(marketDetailSource),
      '必须包含 Bet 事件历史读取契约，例如 getLogs / getContractEvents / watchContractEvent / useBetEventsForMarket。',
    );
  });

  check(() => {
    assert(
      /useBetEventsForMarket/u.test(marketDetailSource) ||
        (/fromBlock\s*:/u.test(marketDetailSource) && /toBlock\s*:/u.test(marketDetailSource)),
      'Bet 历史读取必须限定 fromBlock/toBlock，或委托 useBetEventsForMarket hook 管理区块范围。',
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

  check(() => {
    assert(
      !/publicClient\.getLogs\(\s*\{[\s\S]{0,240}fromBlock:\s*FRONTEND_DEPLOY_BLOCK[\s\S]{0,240}toBlock:\s*'latest'/u.test(
        marketDetailSource,
      ),
      '市场详情不应再直接用单次 publicClient.getLogs 扫描 FRONTEND_DEPLOY_BLOCK..latest。',
    );
  });

  check(() => {
    assert(
      /fetchLogsPaged/u.test(marketDetailSource) &&
        /fromBlock:\s*FRONTEND_DEPLOY_BLOCK/u.test(marketDetailSource) &&
        /toBlock:\s*'latest'/u.test(marketDetailSource),
      '市场详情必须通过分页 helper 读取 FRONTEND_DEPLOY_BLOCK..latest 的 Bet 事件。',
    );
  });
}

if (betEventScanSource) {
  check(() => {
    assertMatches(
      'web/lib/bet-event-scan.ts',
      betEventScanSource,
      /export\s+const\s+LOG_SCAN_BLOCK_STEP\s*=\s*10_000n/u,
      '必须导出 10,000 block 分页步长常量。',
    );
  });

  check(() => {
    assertMatches(
      'web/lib/bet-event-scan.ts',
      betEventScanSource,
      /eth_getLogs[\s\S]{0,40}10,000/u,
      '注释必须说明 Arc RPC 的 eth_getLogs 存在 10,000 block 限制。',
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

  check(() => {
    assertMatches(
      'web/lib/asset-price-map.ts',
      assetPriceMapSource,
      /FRONTEND_DEPLOY_BLOCK\s*=\s*46435108n/u,
      'FRONTEND_DEPLOY_BLOCK 必须锁定为已验证部署区块 46435108n。',
    );
  });

  check(() => {
    for (const [priceId, asset] of [
      ['0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', 'BTC'],
      ['0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', 'ETH'],
      ['0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d', 'SOL'],
    ]) {
      assert(
        assetPriceMapSource.includes(`'${priceId}': '${asset}'`),
        `web/lib/asset-price-map.ts 必须包含 ${asset} 的真实 priceId 映射。`,
      );
    }
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
    assert(!/E1/u.test(seedWalletSource), 'web/lib/seed-wallets.ts 注释不应写死阶段名 E1。');
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
