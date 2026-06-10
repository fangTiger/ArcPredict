// PredictionMarket ABI 加载；与 ResolveDueMarkets 共用。
import { readFileSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Abi } from "viem";

const HERE = dirname(fileURLToPath(import.meta.url));

export function loadPredictionMarketAbi(): Abi {
  const artifact = JSON.parse(
    readFileSync(
      pathResolve(HERE, "../../../out/PredictionMarket.sol/PredictionMarket.json"),
      "utf8",
    ),
  ) as { abi?: Abi };
  if (!artifact.abi) {
    throw new Error("PredictionMarket ABI 不存在");
  }
  return artifact.abi;
}
