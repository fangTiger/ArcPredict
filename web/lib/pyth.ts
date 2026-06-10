import { HermesClient } from '@pythnetwork/hermes-client';

const HERMES =
  process.env.NEXT_PUBLIC_PYTH_HERMES_ENDPOINT || 'https://hermes.pyth.network';

const client = new HermesClient(HERMES);

const withHexPrefix = (payloads: string[]): `0x${string}`[] =>
  payloads.map((payload) => `0x${payload}` as `0x${string}`);

// 拉取某个价格源在指定时间附近的 Hermes update data。
export async function getPriceUpdateAtTime(
  priceId: `0x${string}`,
  publishTime: number,
): Promise<`0x${string}`[]> {
  const res = await client.getPriceUpdatesAtTimestamp(publishTime, [priceId], {
    encoding: 'hex',
    parsed: false,
  });

  return withHexPrefix(res.binary.data);
}

// 拉取某个价格源当前最新的 Hermes update data。
export async function getLatestPriceUpdate(
  priceId: `0x${string}`,
): Promise<`0x${string}`[]> {
  const res = await client.getLatestPriceUpdates([priceId], {
    encoding: 'hex',
    parsed: false,
  });

  return withHexPrefix(res.binary.data);
}
