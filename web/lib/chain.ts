import { defineChain } from 'viem';

/** 钱包与 ERC-20 USDC 展示使用 6 位精度。 */
export const USDC_DECIMALS = 6;

/** 链上 native value（如 msg.value）使用 18 位精度。 */
export const NATIVE_VALUE_DECIMALS = 18;

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: USDC_DECIMALS,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arcscan',
      url: 'https://testnet.arcscan.app',
    },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
    },
  },
  testnet: true,
});
