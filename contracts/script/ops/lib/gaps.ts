import type { Asset, Cadence } from "../scheduler.config.ts";
import { TARGET_ACTIVE, THRESHOLD_OFFSETS_PCT } from "../scheduler.config.ts";
import type { BucketedMarkets } from "./market-scan.ts";

export type Gap = { asset: Asset; cadence: Cadence; offsetPct: number };

const ASSETS: Asset[] = ["BTC", "ETH", "SOL"];
const CADENCES: Cadence[] = ["daily", "weekly", "monthly", "quarterly"];

export function computeGaps(snapshot: BucketedMarkets): Gap[] {
  const gaps: Gap[] = [];

  for (const asset of ASSETS) {
    for (const cadence of CADENCES) {
      const have = snapshot[asset][cadence].length;
      const want = TARGET_ACTIVE[asset][cadence];

      if (have >= want) {
        continue;
      }

      for (let index = have; index < want; index += 1) {
        const offsetPct = THRESHOLD_OFFSETS_PCT[cadence][index];
        if (offsetPct === undefined) {
          throw new Error(`${asset}/${cadence} 缺少第 ${index} 档偏移阶梯配置`);
        }
        gaps.push({ asset, cadence, offsetPct });
      }
    }
  }

  return gaps;
}
