import { erc20Abi, type Abi } from "viem";
import type { Address, Hex } from "./clients.ts";
import { makeWalletClientForKey } from "./clients.ts";
import { pickSeedWallets } from "./pick-seeds.ts";
import { seedAmount } from "./seed-amount.ts";
import { classifyBalance } from "./thresholds.ts";

type Logger = Pick<Console, "log" | "error">;

type ReadContractArgs = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

type GetBalanceArgs = {
  address: Address;
};

type WaitReceiptArgs = {
  hash: Hex;
};

type WaitReceiptResult = {
  status?: "success" | "reverted";
};

type WriteContractArgs = {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
};

type PublicClientLike = {
  readContract(parameters: ReadContractArgs): Promise<unknown>;
  getBalance(parameters: GetBalanceArgs): Promise<bigint>;
  waitForTransactionReceipt(parameters: WaitReceiptArgs): Promise<WaitReceiptResult>;
};

type WalletClientLike = {
  writeContract(parameters: WriteContractArgs): Promise<Hex>;
};

type SeedEntry = {
  privateKey: Hex;
  address: Address;
};

type MakeWalletClient = (rpcUrl: string, privateKey: Hex) => WalletClientLike;

export type SeedConfig = {
  rpcUrl: string;
  marketAddress: Address;
  usdcAddress: Address;
  marketAbi: Abi;
  seeds: SeedEntry[];
};

export type EnsureSeedDeps = {
  publicClient: PublicClientLike;
  config: SeedConfig;
  alreadySeeded: Set<bigint>;
  logger?: Logger;
  // 便于 C7 注入 mock wallet client，默认仍使用真实链上客户端工厂。
  makeWalletClient?: MakeWalletClient;
};

export const MAX_UINT256 = (2n ** 256n) - 1n;

export async function ensureSeedForMarkets(
  marketIds: readonly bigint[],
  deps: EnsureSeedDeps,
): Promise<void> {
  const logger = deps.logger ?? console;
  const addrPool = deps.config.seeds.map((seed) => seed.address);

  for (const marketId of marketIds) {
    if (deps.alreadySeeded.has(marketId)) {
      continue;
    }

    let selectedWallets: Address[];
    try {
      selectedWallets = pickSeedWallets(marketId, addrPool);
    } catch (error) {
      logger.error(`市场 ${marketId}：选择 seed 钱包失败：${formatErrorMessage(error)}`);
      continue;
    }

    const results = await Promise.allSettled(
      selectedWallets.map((address) => seedSingleWallet(address, marketId, deps)),
    );

    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") {
        logger.error(
          `市场 ${marketId} 钱包 ${selectedWallets[index]}：seed 失败：${formatErrorMessage(result.reason)}`,
        );
      }
    }
  }
}

async function seedSingleWallet(
  address: Address,
  marketId: bigint,
  deps: EnsureSeedDeps,
): Promise<void> {
  const logger = deps.logger ?? console;
  const { walletIndex, seed } = findSeedEntry(address, deps.config.seeds);

  const [usdc, native] = await Promise.all([
    readUsdcBalance(deps.publicClient, deps.config.usdcAddress, address),
    deps.publicClient.getBalance({ address }),
  ]);
  const classification = classifyBalance({ usdc, native });
  if (classification === "skipSeed") {
    logger.log(`市场 ${marketId} 钱包 ${address}：余额不足，跳过 seed`);
    return;
  }

  const yesAmt = seedAmount(marketId, walletIndex, "yes");
  const noAmt = seedAmount(marketId, walletIndex, "no");
  const requiredAllowance = yesAmt + noAmt;
  const allowance = await readAllowance(
    deps.publicClient,
    deps.config.usdcAddress,
    address,
    deps.config.marketAddress,
  );

  const walletClientFactory = deps.makeWalletClient ?? makeWalletClientForKey;
  const walletClient = walletClientFactory(deps.config.rpcUrl, seed.privateKey);

  if (allowance < requiredAllowance) {
    const approveHash = await walletClient.writeContract({
      address: deps.config.usdcAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [deps.config.marketAddress, MAX_UINT256],
    });
    const approveReceipt = await deps.publicClient.waitForTransactionReceipt({ hash: approveHash });
    assertReceiptSuccess(approveReceipt, `市场 ${marketId} 钱包 ${address} approve`);
  }

  const yesHash = await walletClient.writeContract({
    address: deps.config.marketAddress,
    abi: deps.config.marketAbi,
    functionName: "bet",
    args: [marketId, true, yesAmt],
  });
  const yesReceipt = await deps.publicClient.waitForTransactionReceipt({ hash: yesHash });
  assertReceiptSuccess(yesReceipt, `市场 ${marketId} 钱包 ${address} YES bet`);

  const noHash = await walletClient.writeContract({
    address: deps.config.marketAddress,
    abi: deps.config.marketAbi,
    functionName: "bet",
    args: [marketId, false, noAmt],
  });
  const noReceipt = await deps.publicClient.waitForTransactionReceipt({ hash: noHash });
  assertReceiptSuccess(noReceipt, `市场 ${marketId} 钱包 ${address} NO bet`);

  logger.log(`市场 ${marketId} 钱包 ${address}：seed 完成 yes=${yesAmt} no=${noAmt}`);
}

function findSeedEntry(
  address: Address,
  seeds: readonly SeedEntry[],
): { walletIndex: number; seed: SeedEntry } {
  const walletIndex = seeds.findIndex((seed) => seed.address.toLowerCase() === address.toLowerCase());
  if (walletIndex < 0) {
    throw new Error(`钱包 ${address} 不在 seed 池`);
  }
  return {
    walletIndex,
    seed: seeds[walletIndex],
  };
}

async function readUsdcBalance(
  publicClient: PublicClientLike,
  usdcAddress: Address,
  owner: Address,
): Promise<bigint> {
  const value = await publicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [owner],
  });
  return toBigIntValue(value, "balanceOf");
}

async function readAllowance(
  publicClient: PublicClientLike,
  usdcAddress: Address,
  owner: Address,
  spender: Address,
): Promise<bigint> {
  const value = await publicClient.readContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  });
  return toBigIntValue(value, "allowance");
}

function toBigIntValue(value: unknown, fieldName: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value);
  }

  if (typeof value === "string" && value.trim() !== "") {
    return BigInt(value);
  }

  throw new Error(`字段 ${fieldName} 不是有效整数`);
}

function assertReceiptSuccess(receipt: WaitReceiptResult, action: string): void {
  if (receipt.status === "reverted") {
    throw new Error(`${action} 交易回执 reverted`);
  }
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
