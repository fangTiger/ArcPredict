'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ConnectChecklist } from '@/components/ConnectChecklist';
import { LogoMark } from '@/components/LogoMark';
import { NetworkBanner } from '@/components/NetworkBanner';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { arcTestnet } from '@/lib/chain';

type WalletProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function describeWalletError(error: unknown): string {
  const maybeError = error as { code?: number; message?: string };
  const lower = maybeError.message?.toLowerCase() ?? '';

  if (maybeError.code === 4001 || lower.includes('reject') || lower.includes('denied')) {
    return '你已取消添加网络。';
  }

  return '添加网络失败，请稍后重试或按下方参数手动配置。';
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-hair bg-bg-2/40 px-4 py-3 text-sm">
      <span className="text-ink-3">{label}</span>
      <span className="overflow-x-auto font-mono text-ink num-glow">{value}</span>
    </div>
  );
}

export default function ConnectPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [showRawParams, setShowRawParams] = useState(false);
  const params = {
    chainId: `0x${arcTestnet.id.toString(16)}`,
    chainName: arcTestnet.name,
    nativeCurrency: arcTestnet.nativeCurrency,
    rpcUrls: arcTestnet.rpcUrls.default.http,
    blockExplorerUrls: [arcTestnet.blockExplorers!.default.url],
  };

  const addArcNetwork = async () => {
    const ethereum = (
      window as Window & {
        ethereum?: WalletProvider;
      }
    ).ethereum;

    if (!ethereum) {
      setStatus('未检测到钱包，请先打开支持 EVM 的钱包后再试。');
      return;
    }

    setIsPending(true);
    setStatus(null);

    try {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [params],
      });
      setStatus('已请求钱包添加 Arc Testnet，请在钱包中确认。');
    } catch (error) {
      setStatus(describeWalletError(error));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <NetworkBanner />
      <SiteHeader />
      <main className="relative z-10 mx-auto max-w-3xl px-4 py-16 sm:py-24">
        <div className="mb-10 flex flex-col items-center text-center">
          <LogoMark size={96} />
          <h1 className="mt-6 font-display text-4xl text-ink">ArcPredict</h1>
          <p className="mt-3 text-ink-2">欢迎进入 Arc 链上预测市场</p>
          <p className="text-sm text-ink-3">连接钱包并切换到 Arc Testnet</p>
        </div>

        <div className="glass rounded-3xl p-6">
          <ConnectChecklist onAddNetwork={addArcNetwork} isAddPending={isPending} />
          {status ? (
            <div className="mt-4 rounded-xl border border-no/30 bg-no/10 px-4 py-3 text-sm text-no">{status}</div>
          ) : null}

          <button
            type="button"
            onClick={() => setShowRawParams((v) => !v)}
            className="mt-6 text-sm text-ink-3 transition hover:text-ink-2"
          >
            展开网络参数 · 手动配置 {showRawParams ? '↑' : '↓'}
          </button>
          {showRawParams ? (
            <div className="mt-4 space-y-2">
              <DetailRow label="Chain ID" value={params.chainId} />
              <DetailRow label="Chain Name" value={params.chainName} />
              <DetailRow label="RPC URL" value={params.rpcUrls[0]} />
              <DetailRow label="Explorer" value={params.blockExplorerUrls[0]} />
            </div>
          ) : null}

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-ink-2 transition hover:text-arc-glow">
              已配置好？回首页 →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
