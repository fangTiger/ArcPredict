import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { validatePhase16ManualQaDoc } from "./check_phase16_manual_qa.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const docPath = path.join(repoRoot, "docs/qa/2026-06-11-phase16-manual-qa.md");
const screenshotDir = path.join(repoRoot, "docs/qa/screenshots");
const goodDoc = readFileSync(docPath, "utf8");

function expectFailure(name, doc, pattern) {
  assert.throws(
    () =>
      validatePhase16ManualQaDoc(doc, {
        repoRoot,
        screenshotDir,
        requireScreenshotsOnDisk: false,
      }),
    pattern,
    name,
  );
}

validatePhase16ManualQaDoc(goodDoc, {
  repoRoot,
  screenshotDir,
  requireScreenshotsOnDisk: true,
});

expectFailure(
  "launchd schedule 被误标通过时必须失败",
  goodDoc.replace(
    "| launchd schedule 连续运行 24h 无 panic | 待 owner 值班机接入 |",
    "| launchd schedule 连续运行 24h 无 panic | 通过 |",
  ),
  /launchd schedule/,
);

expectFailure(
  "launchd topup 被误标通过时必须失败",
  goodDoc.replace(
    "| launchd topup 6h 触发，无 needsTopup | 阻塞 |",
    "| launchd topup 6h 触发，无 needsTopup | 通过 |",
  ),
  /launchd topup/,
);

expectFailure(
  "缺少 BTC createMarket 交易哈希时必须失败",
  goodDoc.replace("0x2d620d3cddd3089eed086f53ff5411777b3e07dee2a42aa681df564f1cfdabd9", ""),
  /BTC daily/,
);

expectFailure(
  "缺少 ETH createMarket 交易哈希时必须失败",
  goodDoc.replace("0x3018aeb5ea45b1ee9d01e00b1c5b69ae1f2cd1dc39b1f23855ff52b2a7040819", ""),
  /ETH daily/,
);

expectFailure(
  "缺少 SOL createMarket 交易哈希时必须失败",
  goodDoc.replace("0x44f5a39ab8b75bf58742f4b1f34512182d50339909a5a5099f3a8ca5758648c5", ""),
  /SOL daily/,
);

console.log("Phase 16+ 手动 QA checker 自测通过");
