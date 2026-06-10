import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const qaDocPath = resolve(repoRoot, 'docs/qa/2026-06-10-phase-15-manual-qa.md');

const requiredItems = [
  'MetaMask 浏览器扩展连接 + 切换到 Arc testnet',
  'WalletConnect 手机扫码连接',
  'Coinbase Wallet 连接',
  'Faucet 领 USDC 后下注成功',
  '余额不足时按钮正确禁用',
  '链错误时切换提示生效',
  'approve 流程正确（首次签名 + 后续免）',
  'Bet Modal "Implied Win" 数字与合约计算一致',
  '下注后 Bet event 正确，前端刷新仓位',
  'resolve 后 claim 金额与公式一致',
  'Invalid 情况下退款正确',
  '移动端浏览器（Safari iOS + Chrome Android）布局可用',
  'Dark / Light 模式切换',
  '`/market/[id]` 深链可分享',
  '`/connect` 故障排查页可用',
];

const forbiddenClaims = ['全清单通过', 'MVP 可上线', '全部通过'];
const requiredKeywords = [
  'Vercel',
  'WalletConnect',
  'MetaMask',
  'Coinbase Wallet',
  'Safari iOS',
  'Chrome Android',
];

assert(existsSync(qaDocPath), '缺少文件: docs/qa/2026-06-10-phase-15-manual-qa.md');

const source = readFileSync(qaDocPath, 'utf8');

assert(
  source.includes('# ArcPredict Phase 15 手动 QA 记录（2026-06-10）'),
  '标题必须包含 ArcPredict Phase 15 手动 QA 记录 与日期 2026-06-10',
);

assert(
  source.includes('Pending external manual QA'),
  '文档必须明确标记为 Pending external manual QA',
);

for (const item of requiredItems) {
  assert(source.includes(item), `缺少手动 QA 项: ${item}`);
}

for (const claim of forbiddenClaims) {
  assert(!source.includes(claim), `文档不应包含误导性通过宣称: ${claim}`);
}

for (const keyword of requiredKeywords) {
  assert(source.includes(keyword), `文档必须包含阻塞/前置条件关键字: ${keyword}`);
}

assert(
  source.includes('| 待执行 |') || source.includes('| 受阻 |'),
  '文档必须至少包含一个“待执行”或“受阻”状态',
);

console.log('Phase 15 手动 QA 文档检查通过');
