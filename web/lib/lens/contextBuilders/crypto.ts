export type PythSample = { ts: number; price: number };

export type CryptoContextInput = {
  pythSeries: PythSample[];
  threshold: number;
  maxSamples?: number;
};

export type CryptoContext = {
  pyth_recent: PythSample[];
  volatility_30d?: number;
  distance_to_threshold_sigma?: number;
};

export function buildCryptoContext(input: CryptoContextInput): CryptoContext {
  const { pythSeries, threshold, maxSamples = 168 } = input;
  if (pythSeries.length === 0) {
    return { pyth_recent: [] };
  }
  const stride = Math.max(1, Math.floor(pythSeries.length / maxSamples));
  const sampled = pythSeries.filter((_, i) => i % stride === 0).slice(0, maxSamples);

  const prices = pythSeries.map((p) => p.price);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.reduce((acc, p) => acc + (p - mean) ** 2, 0) / prices.length;
  const stdev = Math.sqrt(variance);
  const volatility = mean === 0 ? 0 : stdev / mean;
  const latest = prices[prices.length - 1];
  const distance = stdev === 0 ? 0 : (threshold - latest) / stdev;

  return {
    pyth_recent: sampled,
    volatility_30d: volatility,
    distance_to_threshold_sigma: distance,
  };
}
