'use client';

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme, getDefaultConfig } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { WagmiProvider } from 'wagmi';
import { arcTestnet } from '@/lib/chain';

const LOCAL_DEVELOPMENT_WALLETCONNECT_PROJECT_ID = 'local-development-only';

function getWalletConnectProjectId() {
  const configuredProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();

  if (configuredProjectId) {
    return configuredProjectId;
  }

  // 本地开发允许占位值，生产部署会被 scripts/ensure-production-env.mjs 拦住。
  return LOCAL_DEVELOPMENT_WALLETCONNECT_PROJECT_ID;
}

const config = getDefaultConfig({
  appName: 'ArcPredict',
  projectId: getWalletConnectProjectId(),
  chains: [arcTestnet],
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: '#ff6b35' })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
