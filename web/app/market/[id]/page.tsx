'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ComponentProps } from 'react';
import type { Abi } from 'viem';
import { maxUint256, zeroAddress } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { BetModal } from '@/components/BetModal';
import { MarketCard } from '@/components/MarketCard';
import { NetworkBanner } from '@/components/NetworkBanner';
import { WalletPill } from '@/components/WalletPill';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';
import { arcTestnet } from '@/lib/chain';

const predictionMarketAbi = PredictionMarketAbi as Abi;
const MAX_MARKET_ID = maxUint256;

type MarketRow = ComponentProps<typeof MarketCard>['row'];
type DashboardResult = readonly [MarketRow[], bigint];
type BetSelection = {
  row: MarketRow;
  side: boolean;
};

function parseMarketId(value: string | undefined): bigint | null {
  const trimmed = value?.trim() ?? '';

  if (!trimmed || !/^\d+$/u.test(trimmed)) {
    return null;
  }

  try {
    const parsed = BigInt(trimmed);

    if (parsed >= MAX_MARKET_ID) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isInvalidMarketError(error: unknown): boolean {
  const maybeError = error as {
    name?: string;
    shortMessage?: string;
    message?: string;
    cause?: { message?: string };
  };
  const combined = [
    maybeError.name,
    maybeError.shortMessage,
    maybeError.message,
    maybeError.cause?.message,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return combined.includes('invalidmarketid');
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const routeId = params.id;
  const idBn = parseMarketId(routeId);
  const { address } = useAccount();
  const user = address ?? zeroAddress;
  const [betting, setBetting] = useState<BetSelection | null>(null);
  const readArgs = idBn === null ? undefined : [user, idBn, idBn + 1n];

  const { data, error, isLoading, isError, refetch } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: predictionMarketAbi,
    functionName: 'getDashboard',
    args: readArgs,
    chainId: arcTestnet.id,
    query: { enabled: idBn !== null, refetchInterval: 5_000 },
  });

  const dashboardData = data as DashboardResult | undefined;
  const row = dashboardData?.[0]?.[0];
  const marketMissing = isInvalidMarketError(error);
  const walletStatus = address ? '已连接' : '未连接';
  const contractAddressLabel = shortAddress(PREDICTION_MARKET_ADDRESS);

  return (
    <>
      <NetworkBanner />

      <nav className="sticky top-0 z-30 border-b border-white/10 bg-base/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <Link href="/" className="text-sm text-zinc-400 transition hover:text-white">
              返回首页
            </Link>
            <h1 className="mt-2 text-xl font-semibold text-white">
              市场 #{routeId ?? '未知编号'}
            </h1>
          </div>
          <WalletPill />
        </div>
      </nav>

      <main className="min-h-screen bg-base text-white">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          {idBn === null ? (
            <section className="rounded-lg border border-no/35 bg-no/10 p-5 text-sm text-no">
              市场编号无效，请返回首页重新选择。
            </section>
          ) : isLoading ? (
            <section className="rounded-lg border border-white/10 bg-surface p-5 text-sm text-zinc-300">
              正在读取市场详情……
            </section>
          ) : isError ? (
            <section className="rounded-lg border border-no/35 bg-no/10 p-5 text-sm text-no">
              {marketMissing ? '未找到该市场，请返回首页查看其他市场。' : '市场详情读取失败，请检查网络后重试。'}
            </section>
          ) : !row ? (
            <section className="rounded-lg border border-white/10 bg-surface p-5 text-sm text-zinc-300">
              未找到该市场，可能尚未发布或已超出当前范围。
            </section>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">
              <div className="space-y-6">
                <section className="rounded-lg border border-white/10 bg-surface p-5">
                  <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-2xl">
                      <div className="font-mono text-xs text-zinc-500">市场编号 #{idBn.toString()}</div>
                      <h2 className="mt-2 text-lg font-semibold text-white">市场详情</h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        这里展示市场题目、池子状态和下注入口，适合从分享链接直接进入查看或继续操作。
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                      <div>当前网络：{arcTestnet.name}</div>
                      <div className="mt-1 text-zinc-400">钱包状态：{walletStatus}</div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <MarketCard
                      row={row}
                      onBet={(_id, side) => setBetting({ row, side })}
                    />
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-lg border border-white/10 bg-surface p-5">
                  <h2 className="text-sm font-semibold text-white">市场状态</h2>
                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                      <span className="text-zinc-400">市场编号</span>
                      <span className="font-mono text-white">{idBn.toString()}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                      <span className="text-zinc-400">当前网络</span>
                      <span className="font-mono text-white">{arcTestnet.name}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                      <span className="text-zinc-400">钱包状态</span>
                      <span className="font-mono text-white">{walletStatus}</span>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-white/10 bg-surface p-5">
                  <h2 className="text-sm font-semibold text-white">辅助入口</h2>
                  <div className="mt-4 space-y-3">
                    <Link
                      href="/connect"
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/10"
                    >
                      <span>网络与钱包排查</span>
                      <span className="font-mono text-xs text-zinc-500">/connect</span>
                    </Link>
                    <a
                      href={`https://testnet.arcscan.app/address/${PREDICTION_MARKET_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/10"
                    >
                      <span>合约浏览器</span>
                      <span className="font-mono text-xs text-zinc-500">{contractAddressLabel}</span>
                    </a>
                  </div>
                </section>
              </aside>
            </div>
          )}
        </div>
      </main>

      {betting ? (
        <BetModal
          row={betting.row}
          side={betting.side}
          onClose={() => {
            setBetting(null);
            void refetch();
          }}
        />
      ) : null}
    </>
  );
}
