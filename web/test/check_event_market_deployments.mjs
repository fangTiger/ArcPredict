import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cwd = process.cwd();
const webRoot = cwd.endsWith('/web') ? cwd : resolve(cwd, 'web');

function readRequiredText(relativePath) {
  const path = resolve(webRoot, relativePath);
  assert(existsSync(path), `缺少文件: ${relativePath}`);
  return readFileSync(path, 'utf8');
}

function assertIncludesAll(label, source, needles) {
  for (const needle of needles) {
    assert(
      source.includes(needle),
      `${label} 缺少必要片段: ${needle}`,
    );
  }
}

function assertExcludesAll(label, source, needles) {
  for (const needle of needles) {
    assert(
      !source.includes(needle),
      `${label} 不应包含片段: ${needle}`,
    );
  }
}

const homePage = readRequiredText('app/page.tsx');
const detailPage = readRequiredText('app/market/[id]/page.tsx');
const themePage = readRequiredText('app/theme/[themeId]/page.tsx');
const cronRoute = readRequiredText('app/api/cron/markets/tick/route.ts');

assertIncludesAll('HomePage deployment aggregation', homePage, [
  'useReadContracts',
  'EVENT_MARKET_DEPLOYMENTS',
  'attachDeploymentToEventRow',
  'eventReadResults',
  'deployment.eventMarketAddress',
]);

assertExcludesAll('HomePage should not use one EventMarket read for all categories', homePage, [
  'const { data: eventData, refetch: refetchEvent } = useReadContract({',
  'address: EVENT_MARKET_ADDRESS,',
]);

assertIncludesAll('MarketDetailPage deployment routing', detailPage, [
  'eventMarketDeploymentById',
  'DEFAULT_EVENT_MARKET_DEPLOYMENT',
  'const deploymentParam = searchParams.get(\'deployment\');',
  'eventMarketDeployment.eventMarketAddress',
  'eventMarketDeployment.oracleAddress',
]);

assertIncludesAll('Theme page deployment aggregation', themePage, [
  'useReadContracts',
  'EVENT_MARKET_DEPLOYMENTS',
  'attachDeploymentToEventRow',
]);

assertIncludesAll('Cron route per-source deployment runtime', cronRoute, [
  'eventMarketDeploymentForSource',
  'runtimeForSource',
  'deployment.eventMarketAddress',
  'deployment.oracleAddress',
]);

assertExcludesAll('Cron route should not require a single EventMarket deployment', cronRoute, [
  "requireEnv('NEXT_PUBLIC_EVENT_MARKET_ADDRESS')",
  "requireEnv('NEXT_PUBLIC_EVENT_ORACLE_ADDRESS')",
]);

console.log('event market deployment 聚合检查通过');
