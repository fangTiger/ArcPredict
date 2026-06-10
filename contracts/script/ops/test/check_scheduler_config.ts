import assert from "node:assert/strict";
import {
  CADENCE_DURATION,
  PYTH_PRICE_ID,
  TARGET_ACTIVE,
  THRESHOLD_OFFSETS_PCT,
  validateConfig,
  totalActive,
} from "../scheduler.config.ts";

const cases: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void) { cases.push({ name, fn }); }

test("每个 cadence 的 betHours < resolveHours", () => {
  for (const c of Object.keys(CADENCE_DURATION) as Array<keyof typeof CADENCE_DURATION>) {
    const d = CADENCE_DURATION[c];
    assert.ok(d.betHours < d.resolveHours, `${c} 的 betHours 必须小于 resolveHours`);
  }
});

test("THRESHOLD_OFFSETS_PCT 覆盖 TARGET_ACTIVE 所需长度", () => {
  for (const asset of Object.keys(TARGET_ACTIVE) as Array<keyof typeof TARGET_ACTIVE>) {
    for (const cadence of Object.keys(TARGET_ACTIVE[asset]) as Array<keyof typeof CADENCE_DURATION>) {
      assert.ok(
        THRESHOLD_OFFSETS_PCT[cadence].length >= TARGET_ACTIVE[asset][cadence],
        `${asset}/${cadence} 偏移阶梯长度必须不少于目标活跃数`,
      );
    }
  }
});

test("总活跃数 >= 25", () => {
  assert.ok(totalActive() >= 25, "总活跃数必须 >= 25");
});

test("PYTH_PRICE_ID 三个值都是 32 字节 hex", () => {
  for (const id of Object.values(PYTH_PRICE_ID)) {
    assert.match(id, /^0x[0-9a-fA-F]{64}$/, `${id} 不是 32 字节 hex`);
  }
});

test("validateConfig 不抛", () => {
  validateConfig();
});

for (const c of cases) {
  try { await c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
