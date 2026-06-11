import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const docPath = path.join(repoRoot, "docs/qa/2026-06-11-phase16-manual-qa.md");
const screenshotDir = path.join(repoRoot, "docs/qa/screenshots");

const requiredScreenshots = [
  "phase16-e5-localhost-home-desktop.png",
  "phase16-e5-localhost-home-mobile-375.png",
  "phase16-e5-localhost-market-4-desktop.png",
];

assert.ok(existsSync(docPath), "Phase 16+ 手动 QA 文档必须存在");

const doc = readFileSync(docPath, "utf8");

for (const heading of [
  "# ArcPredict Phase 16+ 手动 QA 证据",
  "## 验证范围",
  "## 链上证据",
  "## 前端证据",
  "## 验证点",
  "## 残余项与 owner 待办",
]) {
  assert.ok(doc.includes(heading), `文档缺少章节：${heading}`);
}

for (const needle of [
  "gaps=0 snapshot=26 unknown=3",
  "betEvents=104 seededCount=29",
  "phase16Missing=",
  "市场数量 29",
  "BTC × Weekly",
  "ETH × Monthly",
  "SOL × Quarterly",
  "~10 USDC from project seed liquidity",
  "scrollWidth=375",
  "healthy=3 needsTopup=5 skipSeed=4",
  "待 owner 补 faucet",
]) {
  assert.ok(doc.includes(needle), `文档缺少证据：${needle}`);
}

for (const screenshotName of requiredScreenshots) {
  const screenshotPath = path.join(screenshotDir, screenshotName);
  assert.ok(existsSync(screenshotPath), `截图缺失：${screenshotName}`);
  assert.ok(doc.includes(`docs/qa/screenshots/${screenshotName}`), `文档未引用截图：${screenshotName}`);
}

assert.ok(!doc.includes("全绿通过"), "文档不得在 topup 未健康时宣称全绿通过");

console.log("Phase 16+ 手动 QA 文档检查通过");
