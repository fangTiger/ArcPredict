import assert from "node:assert/strict";
import { formatQuestion, parseCadenceTag, formatDateUtc } from "../lib/cadence-tag.ts";

const cases: Array<{ name: string; fn: () => void }> = [];
function test(name: string, fn: () => void) { cases.push({ name, fn }); }

test("formatQuestion 生成可解析的文本", () => {
  const q = formatQuestion("BTC", 71200, 1781990400n, "weekly");
  assert.match(q, /^BTC\/USD ≥ 71200 @ \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC \[weekly\]$/);
  assert.equal(parseCadenceTag(q), "weekly");
});

test("parseCadenceTag 支持四档", () => {
  for (const c of ["daily","weekly","monthly","quarterly"] as const) {
    assert.equal(parseCadenceTag(`foo [${c}]`), c);
  }
});

test("parseCadenceTag 失败返回 unknown", () => {
  assert.equal(parseCadenceTag("无 tag"), "unknown");
  assert.equal(parseCadenceTag("BTC/USD ≥ 71200 @ 2026-06-17 [weeky]"), "unknown");
});

test("formatDateUtc 是 UTC 格式", () => {
  // 2026-06-17 12:00:00 UTC = Date.UTC 验证
  const ts = BigInt(Date.UTC(2026, 5, 17, 12, 0, 0) / 1000);
  assert.equal(formatDateUtc(ts), "2026-06-17 12:00 UTC");
});

for (const c of cases) {
  try { c.fn(); console.log(`OK: ${c.name}`); }
  catch (e) { console.error(`FAIL: ${c.name}`, e); process.exit(1); }
}
