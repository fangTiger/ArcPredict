// question 模板：{ASSET}/USD ≥ {THRESHOLD} @ {DATE_UTC} [{CADENCE}]
// 例：BTC/USD ≥ 71200 @ 2026-06-17 12:00 UTC [weekly]
// 反查 cadence 是合约不存 cadence 时的唯一可靠源（spec INV-9）。

import type { Asset, Cadence } from "../scheduler.config.ts";

const CADENCE_TAG_RE = /\[(daily|weekly|monthly|quarterly)\]\s*$/;

export type ParsedCadence = Cadence | "unknown";

export function formatDateUtc(unixSeconds: bigint): string {
  const d = new Date(Number(unixSeconds) * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}

export function formatQuestion(
  asset: Asset,
  humanThreshold: number,
  resolveAfter: bigint,
  cadence: Cadence,
): string {
  return `${asset}/USD ≥ ${humanThreshold} @ ${formatDateUtc(resolveAfter)} [${cadence}]`;
}

export function parseCadenceTag(question: string): ParsedCadence {
  const m = question.match(CADENCE_TAG_RE);
  if (!m) return "unknown";
  return m[1] as Cadence;
}
