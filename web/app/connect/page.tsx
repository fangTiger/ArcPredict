'use client';

import Link from 'next/link';
import { useState } from 'react';
import { NetworkBanner } from '@/components/NetworkBanner';
import { WalletPill } from '@/components/WalletPill';
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
    <div className="flex items-center justify-between gap-4 rounded-lg border border-hair bg-canvas px-4 py-3 text-sm">
      <span className="text-ink-2">{label}</span>
      <span className="overflow-x-auto font-mono text-ink">{value}</span>
    </div>
  );
}

export default function ConnectPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
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

      <nav className="sticky top-0 z-30 border-b border-hair bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <Link href="/" className="text-sm text-ink-2 transition hover:text-ink">
              返回首页
            </Link>
            <h1 className="mt-2 text-xl font-semibold text-ink">连接 Arc Testnet</h1>
          </div>
          <WalletPill />
        </div>
      </nav>

      <main className="min-h-screen bg-canvas text-ink">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-12 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)] lg:px-8">
          <section className="rounded-lg border border-hair bg-paper p-5">
            <div className="border-b border-hair pb-5">
              <h2 className="text-lg font-semibold text-ink">一键添加网络</h2>
              <p className="mt-2 text-sm leading-6 text-ink-2">
                如果钱包没有 Arc Testnet，先点下面按钮请求自动添加；如果钱包拦截或不支持，再按右侧参数手动填写。
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <button
                type="button"
                onClick={() => void addArcNetwork()}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-lg border border-arc/20 bg-arc px-4 py-3 text-sm font-medium text-paper transition hover:bg-arc-deep disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? '正在请求钱包添加 Arc Testnet...' : '添加 Arc Testnet 到钱包'}
              </button>

              <div className="rounded-lg border border-hair bg-canvas p-4 text-sm leading-6 text-ink-2">
                {status ?? '未检测到钱包时可直接参考右侧参数手动添加。'}
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-hair bg-canvas px-4 py-3 text-sm text-ink-2 transition hover:border-arc/20 hover:bg-paper"
              >
                <span>Arcscan</span>
                <span className="font-mono text-xs text-ink-2">浏览器</span>
              </a>
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg border border-hair bg-canvas px-4 py-3 text-sm text-ink-2 transition hover:border-arc/20 hover:bg-paper"
              >
                <span>Circle Faucet</span>
                <span className="font-mono text-xs text-ink-2">USDC</span>
              </a>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-lg border border-hair bg-paper p-5">
              <h2 className="text-sm font-semibold text-ink">手动参数</h2>
              <div className="mt-4 space-y-3">
                <DetailRow label="Chain ID" value={`${arcTestnet.id} (${params.chainId})`} />
                <DetailRow label="Name" value={arcTestnet.name} />
                <DetailRow label="RPC" value={params.rpcUrls[0]} />
                <DetailRow label="Symbol" value={arcTestnet.nativeCurrency.symbol} />
                <DetailRow
                  label="Decimals"
                  value={arcTestnet.nativeCurrency.decimals.toString()}
                />
                <DetailRow label="Explorer" value={params.blockExplorerUrls[0]} />
              </div>
            </section>

            <section className="rounded-lg border border-hair bg-paper p-5">
              <h2 className="text-sm font-semibold text-ink">排查建议</h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-ink-2">
                <p>1. 钱包里确认当前网络是否已经切到 Arc Testnet。</p>
                <p>2. 如果钱包没有弹窗，刷新页面后重新点击添加按钮。</p>
                <p>3. 如果自动添加失败，复制右侧参数手动新建网络。</p>
                <p>4. 网络配置完成后，前往 Circle Faucet 领取测试 USDC。</p>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
