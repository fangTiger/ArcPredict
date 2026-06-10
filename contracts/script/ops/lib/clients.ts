import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export function createArcTestnetChain(rpcUrl: string) {
  return defineChain({
    id: 5_042_002,
    name: "Arc Testnet",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    rpcUrls: { default: { http: [rpcUrl] } },
    testnet: true,
  });
}

export function makePublicClient(rpcUrl: string) {
  return createPublicClient({ chain: createArcTestnetChain(rpcUrl), transport: http(rpcUrl) });
}

export function makeWalletClientForKey(rpcUrl: string, privateKey: Hex) {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: createArcTestnetChain(rpcUrl),
    transport: http(rpcUrl),
  });
}

export function withHexPrefix(value: string): Hex {
  const normalized = value.trim().replace(/^0x/i, "");
  return `0x${normalized}` as Hex;
}

export function normalizePrivateKey(value: string): Hex {
  return withHexPrefix(value);
}

export type { Address, Hex };
