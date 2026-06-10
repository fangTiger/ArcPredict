import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { erc20Abi, type Address } from "viem";
import { makePublicClient } from "./lib/clients.ts";
import { loadSeedsEnv } from "./lib/env.ts";
import { BALANCE_THRESHOLDS, classifyBalance } from "./lib/thresholds.ts";

export interface BalanceFetcher {
  fetchUsdc(address: Address): Promise<bigint>;
  fetchNative(address: Address): Promise<bigint>;
}

export type ScanResult = {
  healthy: Address[];
  needsTopup: Address[];
  skipSeed: Address[];
};

export async function scanWallets(
  seeds: readonly Address[],
  fetcher: BalanceFetcher,
): Promise<ScanResult> {
  const result: ScanResult = {
    healthy: [],
    needsTopup: [],
    skipSeed: [],
  };

  for (const address of seeds) {
    const [usdc, native] = await Promise.all([
      fetcher.fetchUsdc(address),
      fetcher.fetchNative(address),
    ]);
    const classification = classifyBalance({ usdc, native });

    if (classification === "healthy") {
      result.healthy.push(address);
    } else if (classification === "needsTopup") {
      result.needsTopup.push(address);
    } else {
      result.skipSeed.push(address);
    }
  }

  return result;
}

function formatAddressList(addresses: readonly Address[]): string[] {
  return addresses.length > 0 ? [...addresses] : ["（无）"];
}

export function formatReport(result: ScanResult): string {
  return [
    "=== ArcPredict TopUpSeeds 报告 ===",
    `healthy=${result.healthy.length} needsTopup=${result.needsTopup.length} skipSeed=${result.skipSeed.length}`,
    `阈值（USDC 6 decimals）：warn=${BALANCE_THRESHOLDS.warn} skip=${BALANCE_THRESHOLDS.skip} gasMin=${BALANCE_THRESHOLDS.gasMin}`,
    "",
    "=== 需要顶配的钱包（复制到 Circle faucet）===",
    ...formatAddressList(result.needsTopup),
    "",
    "=== 跳过 seed 的钱包 ===",
    ...formatAddressList(result.skipSeed),
  ].join("\n");
}

export function shouldExitWithFailure(result: ScanResult): boolean {
  return result.needsTopup.length > 0 || result.skipSeed.length > 0;
}

export async function main(): Promise<void> {
  const runtimeConfig = loadSeedsEnv();
  const publicClient = makePublicClient(runtimeConfig.rpcUrl);
  const fetcher: BalanceFetcher = {
    async fetchUsdc(address) {
      return publicClient.readContract({
        address: runtimeConfig.usdcAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });
    },
    async fetchNative(address) {
      return publicClient.getBalance({ address });
    },
  };
  const result = await scanWallets(
    runtimeConfig.seeds.map((seed) => seed.address),
    fetcher,
  );
  const report = formatReport(result);

  console.log(report);
  writeFileSync("/tmp/arc-predict-topup-needed.json", `${JSON.stringify(result, null, 2)}\n`);

  if (shouldExitWithFailure(result)) {
    process.exit(1);
  }
}

function isDirectExecution(): boolean {
  return process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
}

if (isDirectExecution()) {
  main().catch((error) => {
    console.error("seed 钱包余额扫描失败", error);
    process.exit(1);
  });
}
