import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Module from 'node:module';
import ts from 'typescript';

const cwd = process.cwd();
const repoRoot = cwd.endsWith('/web') ? resolve(cwd, '..') : cwd;
const webRoot = cwd.endsWith('/web') ? cwd : resolve(repoRoot, 'web');
const moduleCache = new Map();
const nodeRequire = Module.createRequire(import.meta.url);

const resolveTsSpecifier = (specifier, parentDir) => {
  const directPath = specifier.startsWith('@/') ? resolve(webRoot, specifier.slice(2)) : resolve(parentDir, specifier);
  const candidates = [
    directPath,
    `${directPath}.ts`,
    `${directPath}.tsx`,
    resolve(directPath, 'index.ts'),
    resolve(directPath, 'index.tsx'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

const loadTsModule = (modulePath) => {
  if (moduleCache.has(modulePath)) {
    return moduleCache.get(modulePath);
  }

  if (!existsSync(modulePath)) {
    throw new Error(`缺少文件: ${modulePath}`);
  }

  const source = readFileSync(modulePath, 'utf8');
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.Node10,
    },
    fileName: modulePath,
    reportDiagnostics: true,
  });

  if (diagnostics?.length) {
    const message = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCurrentDirectory: () => repoRoot,
      getCanonicalFileName: (fileName) => fileName,
      getNewLine: () => '\n',
    });
    throw new Error(`TypeScript 转译失败:\n${message}`);
  }

  const module = { exports: {} };
  moduleCache.set(modulePath, module.exports);

  const localRequire = (specifier) => {
    if (specifier.startsWith('.') || specifier.startsWith('@/')) {
      const resolved = resolveTsSpecifier(specifier, dirname(modulePath));
      if (!resolved) {
        throw new Error(`无法解析本地依赖: ${specifier} from ${modulePath}`);
      }
      return loadTsModule(resolved);
    }

    return nodeRequire(specifier);
  };

  const wrapper = new Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    outputText,
  );

  wrapper(module.exports, localRequire, module, modulePath, dirname(modulePath));
  return module.exports;
};

const seedPath = resolve(webRoot, 'lib/worldcup-seed.ts');
const {
  WORLDCUP_TEAMS,
  WORLDCUP_MATCHES,
  MATCH_BY_ID,
  MATCHES_BY_STAGE,
} = loadTsModule(seedPath);

assert.equal(WORLDCUP_TEAMS.length, 32, '必须提供 32 支参赛队伍。');
assert.equal(WORLDCUP_MATCHES.length, 64, '必须提供 64 条赛程种子。');
assert.equal(MATCHES_BY_STAGE('group').length, 48, 'group 阶段必须有 48 场。');
assert.equal(MATCHES_BY_STAGE('r16').length, 8, 'r16 阶段必须有 8 场。');
assert.equal(MATCHES_BY_STAGE('qf').length, 4, 'qf 阶段必须有 4 场。');
assert.equal(MATCHES_BY_STAGE('sf').length, 2, 'sf 阶段必须有 2 场。');
assert.equal(MATCHES_BY_STAGE('final').length, 2, 'final 阶段必须同时包含决赛和三四名决赛，共 2 场。');
assert.equal(MATCHES_BY_STAGE('winner').length, 0, 'winner 不能作为伪比赛出现在 WORLDCUP_MATCHES 中。');
assert.equal(
  MATCHES_BY_STAGE('r16').length +
    MATCHES_BY_STAGE('qf').length +
    MATCHES_BY_STAGE('sf').length +
    MATCHES_BY_STAGE('final').length,
  16,
  '必须提供 16 场真实淘汰赛。',
);
assert.equal(
  MATCH_BY_ID('group-a-1').sportsDbEventId,
  '1543883',
  'group-a-1 必须映射到已确认的 TheSportsDB event id。',
);
assert.equal(
  MATCH_BY_ID('r16-1').sportsDbEventId,
  '1665048',
  'r16-1 必须映射到已确认的 TheSportsDB event id。',
);
assert.equal(
  MATCH_BY_ID('qf-1').sportsDbEventId,
  null,
  '未知 provider id 的场次必须显式为 null，不能回退成 local matchId。',
);

const teamIds = new Set(WORLDCUP_TEAMS.map((team) => team.id));
assert.equal(teamIds.size, 32, '队伍 id 必须唯一。');

for (const team of WORLDCUP_TEAMS) {
  assert.match(team.id, /^[A-Z]{3}$/u, `队伍 id 非法: ${team.id}`);
  assert.match(team.iso2, /^[A-Z]{2}$/u, `队伍 iso2 非法: ${team.id} -> ${team.iso2}`);
  assert.equal(typeof team.nameEn, 'string');
  assert.equal(typeof team.shortNameZh, 'string');
}

const allowedPlaceholders = new Set([
  'GROUP_A_W',
  'GROUP_A_RU',
  'GROUP_B_W',
  'GROUP_B_RU',
  'GROUP_C_W',
  'GROUP_C_RU',
  'GROUP_D_W',
  'GROUP_D_RU',
  'GROUP_E_W',
  'GROUP_E_RU',
  'GROUP_F_W',
  'GROUP_F_RU',
  'GROUP_G_W',
  'GROUP_G_RU',
  'GROUP_H_W',
  'GROUP_H_RU',
  'R16_1_W',
  'R16_2_W',
  'R16_3_W',
  'R16_4_W',
  'R16_5_W',
  'R16_6_W',
  'R16_7_W',
  'R16_8_W',
  'QF_1_W',
  'QF_2_W',
  'QF_3_W',
  'QF_4_W',
  'SF_1_W',
  'SF_2_W',
  'SF_1_L',
  'SF_2_L',
]);

const matchIds = new Set();

for (const match of WORLDCUP_MATCHES) {
  assert.match(match.matchId, /^[a-z0-9-]+$/u, `matchId 非法: ${match.matchId}`);
  assert(!matchIds.has(match.matchId), `matchId 重复: ${match.matchId}`);
  matchIds.add(match.matchId);
  assert(
    Object.hasOwn(match, 'sportsDbEventId'),
    `每场比赛都必须显式声明 sportsDbEventId: ${match.matchId}`,
  );
  assert(
    match.sportsDbEventId === null || /^[0-9]+$/u.test(match.sportsDbEventId),
    `sportsDbEventId 非法: ${match.matchId} -> ${String(match.sportsDbEventId)}`,
  );
  assert.match(
    match.kickoffTime,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u,
    `kickoffTime 必须是 UTC ISO 字符串: ${match.matchId}`,
  );

  for (const slot of [match.homeTeam, match.awayTeam]) {
    const exists = teamIds.has(slot) || allowedPlaceholders.has(slot);
    assert(exists, `未知队伍或占位符: ${match.matchId} -> ${slot}`);
  }
}

assert.equal(MATCH_BY_ID('group-a-1').matchId, 'group-a-1');
assert.equal(MATCH_BY_ID('final-1').stage, 'final');
assert.equal(MATCH_BY_ID('final-2').stage, 'final');
assert.equal(MATCH_BY_ID('final-2').label, 'Third-place playoff');
assert.equal(MATCH_BY_ID('winner-1'), undefined);
assert.equal(MATCH_BY_ID('missing-match'), undefined);

console.log('worldcup seed 检查通过');
