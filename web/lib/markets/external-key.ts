import { keccak256, toBytes, concat, stringToBytes } from 'viem';

export type MarketSourceId = string;
export type ExternalKey = string;

/**
 * 通过 sourceId + externalKey 派生确定性的 32-byte marketId。
 * 同一对 (sourceId, externalKey) 永远生成同一 marketId，
 * 配合链上 markets[id] 存在性检查实现 cron 幂等。
 */
export function computeMarketId(
  sourceId: MarketSourceId,
  externalKey: ExternalKey,
): `0x${string}` {
  const packed = concat([
    stringToBytes(sourceId),
    toBytes(0x1f),
    stringToBytes(externalKey),
  ]);
  return keccak256(packed);
}
