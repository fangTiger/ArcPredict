import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const cwd = process.cwd();
const repoRoot = cwd.endsWith('/web') ? resolve(cwd, '..') : cwd;
const webRoot = cwd.endsWith('/web') ? cwd : resolve(repoRoot, 'web');
const layoutPath = resolve(webRoot, 'app/layout.tsx');
const helperPath = resolve(webRoot, 'lib/flag-icons.ts');
const cardPath = resolve(webRoot, 'components/WorldCupMarketCard.tsx');
const buildIdPath = resolve(webRoot, '.next/BUILD_ID');
const mediaDir = resolve(webRoot, '.next/static/media');
const analyzeDir = resolve(webRoot, '.next/analyze');
const analyzeJsonPath = resolve(analyzeDir, 'worldcup-flag-bundle.json');
const analyzeMarkdownPath = resolve(analyzeDir, 'worldcup-flag-bundle.md');
const requireBuildArtifacts = process.env.CHECK_FLAG_BUNDLE_REQUIRE_BUILD === '1';
const gzipBudgetBytes =
  Number.parseInt(process.env.CHECK_FLAG_BUNDLE_GZIP_BUDGET_BYTES ?? '', 10) ||
  80 * 1024;

const layoutSource = readFileSync(layoutPath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');
const cardSource = readFileSync(cardPath, 'utf8');
const helperGzipBytes = gzipSync(helperSource).length;
const toWebRelativePath = (targetPath) => relative(webRoot, targetPath).split(sep).join('/');
const writeAnalyzeReport = ({
  helperBytes,
  svgAssetCount,
  svgBytes,
  budgetBytes,
  result,
  svgPaths,
}) => {
  const report = {
    mode: 'build',
    helperGzipBytes: helperBytes,
    svgAssetCount,
    svgGzipBytes: svgBytes,
    budgetBytes,
    result,
    pass: result === 'pass',
    svgFiles: svgPaths,
  };

  mkdirSync(analyzeDir, { recursive: true });
  writeFileSync(analyzeJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(
    analyzeMarkdownPath,
    [
      '# World Cup Flag Bundle Audit',
      '',
      `- mode: ${report.mode}`,
      `- helper gzip bytes: ${report.helperGzipBytes}`,
      `- svg asset count: ${report.svgAssetCount}`,
      `- svg gzip bytes: ${report.svgGzipBytes}`,
      `- budget bytes: ${report.budgetBytes}`,
      `- result: ${report.result}`,
      '',
      '## SVG Files',
      ...(report.svgFiles.length ? report.svgFiles.map((filePath) => `- ${filePath}`) : ['- (none)']),
      '',
    ].join('\n'),
  );
};

assert(
  !layoutSource.includes("flag-icons/css/flag-icons.min.css"),
  'layout.tsx 不得全局 import flag-icons CSS，否则会把全量 SVG 打进 bundle。',
);
assert(
  !cardSource.includes('flagIconClassName'),
  'WorldCupMarketCard.tsx 不得再依赖 fi fi-* CSS class 方案。',
);
assert(
  helperSource.includes('FLAG_ICON_BUNDLE_ALLOWLIST'),
  'flag-icons.ts 必须声明受控的首屏国旗 allowlist。',
);
assert(
  helperSource.includes('flagIconUrlForTeam'),
  'flag-icons.ts 必须导出按需 URL helper。',
);
assert(
  !helperSource.includes('FLAG_ICON_CSS_ENTRY'),
  'flag-icons.ts 不应再暴露全量 CSS 入口。',
);
assert(
  !helperSource.includes('flagIconClassName'),
  'flag-icons.ts 不应再暴露 fi class helper。',
);
assert(
  helperSource.includes("'ar'") &&
    helperSource.includes("'mx'") &&
    helperSource.includes("'gb-eng'") &&
    helperSource.includes("'gb-wls'") &&
    helperSource.includes("'nl'") &&
    helperSource.includes("'us'") &&
    helperSource.includes("'br'") &&
    helperSource.includes("'hr'") &&
    helperSource.includes("'fr'"),
  'allowlist 必须覆盖首屏 9 面国旗。',
);
assert(
  !helperSource.includes('<svg'),
  'flag helper 不应把 SVG 直接内联进源码。',
);

if (!existsSync(buildIdPath) || !existsSync(mediaDir)) {
  assert(
    !requireBuildArtifacts,
    'CHECK_FLAG_BUNDLE_REQUIRE_BUILD=1，但未检测到 .next 构建产物。请先运行 pnpm --dir web build。',
  );
  assert(
    helperGzipBytes <= gzipBudgetBytes,
    `flag helper 源码本身也不应膨胀，当前 ${helperGzipBytes} bytes gzip`,
  );
  console.log(
    `flag bundle 检查通过 (mode=source-only, ${helperGzipBytes} bytes gzip helper; 未检测到 .next，跳过构建产物审计)`,
  );
  process.exit(0);
}

const buildMtime = statSync(buildIdPath).mtimeMs;
const newestSourceMtime = Math.max(
  statSync(layoutPath).mtimeMs,
  statSync(helperPath).mtimeMs,
  statSync(cardPath).mtimeMs,
);

if (buildMtime < newestSourceMtime) {
  assert(
    !requireBuildArtifacts,
    'CHECK_FLAG_BUNDLE_REQUIRE_BUILD=1，但 .next 构建产物早于源码。请先重新运行 pnpm --dir web build。',
  );
  assert(
    helperGzipBytes <= gzipBudgetBytes,
    `flag helper 源码本身也不应膨胀，当前 ${helperGzipBytes} bytes gzip`,
  );
  console.log(
    `flag bundle 检查通过 (mode=source-only, ${helperGzipBytes} bytes gzip helper; 构建产物早于源码，请先重新运行 pnpm build 后再做产物审计)`,
  );
  process.exit(0);
}

const svgFiles = [];
const walk = (dir) => {
  for (const entry of statSync(dir).isDirectory() ? readdirSync(dir, { withFileTypes: true }) : []) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.svg')) {
      svgFiles.push(fullPath);
    }
  }
};
walk(mediaDir);

const svgRelativePaths = svgFiles.map((filePath) => toWebRelativePath(filePath)).sort();
const svgGzipBytes = gzipSync(
  Buffer.concat(svgFiles.map((filePath) => Buffer.from(readFileSync(filePath)))),
).length;
const buildResult =
  helperGzipBytes <= gzipBudgetBytes && svgFiles.length <= 20 && svgGzipBytes <= gzipBudgetBytes
    ? 'pass'
    : 'fail';

writeAnalyzeReport({
  helperBytes: helperGzipBytes,
  svgAssetCount: svgFiles.length,
  svgBytes: svgGzipBytes,
  budgetBytes: gzipBudgetBytes,
  result: buildResult,
  svgPaths: svgRelativePaths,
});

assert(
  helperGzipBytes <= gzipBudgetBytes,
  `flag helper 源码本身也不应膨胀，当前 ${helperGzipBytes} bytes gzip`,
);
assert(
  svgFiles.length <= 20,
  `构建产物 SVG 数量异常: ${svgFiles.length}，疑似又把整包 flag-icons 收进来了。`,
);
assert(
  svgGzipBytes <= gzipBudgetBytes,
  `构建产物 SVG gzip 超预算: ${svgGzipBytes} bytes`,
);

console.log(
  `flag bundle 检查通过 (mode=build, ${helperGzipBytes} bytes gzip helper, ${svgFiles.length} svg assets, ${svgGzipBytes} bytes gzip build; report=${toWebRelativePath(analyzeJsonPath)})`,
);
