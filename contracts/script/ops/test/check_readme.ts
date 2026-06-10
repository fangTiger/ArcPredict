import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

type AsyncVoid = () => Promise<void> | void;

const testCases: Array<{ name: string; fn: AsyncVoid }> = [];

function test(name: string, fn: AsyncVoid) {
  testCases.push({ name, fn });
}

const currentFile = fileURLToPath(import.meta.url);
const readmePath = path.resolve(path.dirname(currentFile), "../README.md");
const readme = readFileSync(readmePath, "utf8");

test("README 保留 cron 每 30 秒扫描说明", () => {
  assert.match(readme, /cron/i);
  assert.match(readme, /每 30 秒自动扫描/);
  assert.match(readme, /sleep 30/);
});

test("README 提供 systemd timer 可执行配置", () => {
  assert.match(readme, /systemd timer/i);
  assert.match(readme, /\[Unit\]/);
  assert.match(readme, /\[Service\]/);
  assert.match(readme, /\[Timer\]/);
  assert.match(readme, /OnCalendar=/);
  assert.match(readme, /OnUnitActiveSec=30s|sleep 30/);
  assert.match(readme, /每 30 秒扫描一次/);
});

test("README 提供 launchd 可执行配置", () => {
  assert.match(readme, /launchd/i);
  assert.match(readme, /ProgramArguments/);
  assert.match(readme, /WorkingDirectory/);
  assert.match(readme, /StartInterval/);
  assert.match(readme, /StandardOutPath/);
  assert.match(readme, /StandardErrorPath/);
  assert.match(readme, /npm run resolve/);
  assert.match(readme, /每 30 秒扫描一次/);
});

test("README 的 MarketScheduler runbook 覆盖 launchd/cron/systemd 等价配置", () => {
  const marketSchedulerSection = readme.match(/## Phase 16\+：MarketScheduler[\s\S]*/)?.[0];
  assert.ok(marketSchedulerSection, "缺少 Phase 16+：MarketScheduler 小节");

  assert.match(marketSchedulerSection, /DRY_RUN=1 npm run schedule/);
  assert.match(marketSchedulerSection, /com\.arcpredict\.ops\.schedule/);
  assert.match(marketSchedulerSection, /\* \* \* \* \*[\s\S]*npm run schedule/);
  assert.match(marketSchedulerSection, /arc-predict-schedule\.service/);
  assert.match(marketSchedulerSection, /arc-predict-schedule\.timer/);
  assert.match(
    marketSchedulerSection,
    /OnCalendar=\*-\*-\* \*:\*:00|OnUnitActiveSec=60s|每分钟触发一次/,
  );
  assert.match(marketSchedulerSection, /THRESHOLD_OFFSETS_PCT[\s\S]*长度覆盖[\s\S]*TARGET_ACTIVE/);
});

test("README 保留历史 update 与 forceInvalid 排障说明", () => {
  assert.match(readme, /窗口过期仍尝试 Hermes 历史 update/);
  assert.match(readme, /只有在 `resolveAfter \+ 7 天` 之后/);
  assert.match(readme, /才考虑调用 `forceInvalid`/);
});

let failures = 0;

for (const { name, fn } of testCases) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failures > 0) {
  console.error(`共 ${failures} 个 README 检查失败`);
  process.exit(1);
}

console.log(`全部 ${testCases.length} 个 README 检查通过`);
