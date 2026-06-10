import { HermesClient } from "@pythnetwork/hermes-client";

type HermesPrice = {
  price: string;
  expo: number;
  publish_time: number;
};

type HermesParsedEntry = {
  id: string;
  price: HermesPrice;
};

type LatestPriceOptions = {
  encoding: "hex";
  parsed: true;
};

type LatestPriceResponse = {
  parsed?: HermesParsedEntry[] | null;
  binary: {
    data: string[];
  };
};

export interface HermesLike {
  getLatestPriceUpdates(ids: string[], options: LatestPriceOptions): Promise<LatestPriceResponse>;
}

export function makeHermesClient(endpoint: string): HermesLike {
  return new HermesClient(endpoint) as unknown as HermesLike;
}

function stripPrefix(id: string): string {
  return id.replace(/^0x/i, "").toLowerCase();
}

function parseRawPrice(raw: string, priceId: string): bigint {
  const normalizedRaw = raw.trim();

  if (!/^-?\d+$/.test(normalizedRaw)) {
    throw new Error(`价格无效：${priceId}`);
  }

  return BigInt(normalizedRaw);
}

export async function fetchCurrentPrice(client: HermesLike, priceId: string): Promise<number> {
  const normalizedPriceId = stripPrefix(priceId);
  const response = await client.getLatestPriceUpdates([normalizedPriceId], {
    encoding: "hex",
    parsed: true,
  });
  const parsed = Array.isArray(response.parsed) ? response.parsed : [];
  const matched = parsed.find((entry) => stripPrefix(entry.id) === normalizedPriceId);

  if (!matched) {
    throw new Error(`价格未返回：${priceId}`);
  }

  const rawPrice = parseRawPrice(matched.price.price, priceId);
  const value = Number(rawPrice) * Math.pow(10, matched.price.expo);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`价格无效：${priceId}`);
  }

  return value;
}
