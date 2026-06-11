import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const docPath = path.join(repoRoot, "docs/qa/2026-06-11-phase16-manual-qa.md");
const screenshotDir = path.join(repoRoot, "docs/qa/screenshots");

const requiredScreenshots = [
  "phase16-e5-localhost-home-desktop.png",
  "phase16-e5-localhost-home-mobile-375.png",
  "phase16-e5-localhost-market-4-desktop.png",
];

const requiredTxHashes = [
  {
    label: "BTC daily",
    hash: "0x2d620d3cddd3089eed086f53ff5411777b3e07dee2a42aa681df564f1cfdabd9",
  },
  {
    label: "ETH daily",
    hash: "0x3018aeb5ea45b1ee9d01e00b1c5b69ae1f2cd1dc39b1f23855ff52b2a7040819",
  },
  {
    label: "SOL daily",
    hash: "0x44f5a39ab8b75bf58742f4b1f34512182d50339909a5a5099f3a8ca5758648c5",
  },
];

export function validatePhase16ManualQaDoc(
  doc,
  {
    screenshotDir: targetScreenshotDir = screenshotDir,
    requireScreenshotsOnDisk = true,
  } = {},
) {
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
    "待 24h / 6h 长跑证据",
  ]) {
    assert.ok(doc.includes(needle), `文档缺少证据：${needle}`);
  }

  assert.match(
    doc,
    /\| launchd schedule 连续运行 24h 无 panic \| 待 owner 值班机接入 \|/,
    "launchd schedule 长跑项在未验证前必须保持待 owner 接入状态",
  );
  assert.match(
    doc,
    /\| launchd topup 6h 触发，无 needsTopup \| 阻塞 \|/,
    "launchd topup 在余额不足时必须保持阻塞状态",
  );

  for (const { label, hash } of requiredTxHashes) {
    assert.ok(doc.includes(hash), `文档缺少 ${label} createMarket 交易哈希`);
  }

  for (const screenshotName of requiredScreenshots) {
    const screenshotPath = path.join(targetScreenshotDir, screenshotName);
    if (requireScreenshotsOnDisk) {
      assert.ok(existsSync(screenshotPath), `截图缺失：${screenshotName}`);
    }
    assert.ok(
      doc.includes(`docs/qa/screenshots/${screenshotName}`),
      `文档未引用截图：${screenshotName}`,
    );
  }

  assert.ok(!doc.includes("全绿通过"), "文档不得在 topup 未健康时宣称全绿通过");
}

function runCli() {
  assert.ok(existsSync(docPath), "Phase 16+ 手动 QA 文档必须存在");
  const doc = readFileSync(docPath, "utf8");
  validatePhase16ManualQaDoc(doc);
  console.log("Phase 16+ 手动 QA 文档检查通过");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
