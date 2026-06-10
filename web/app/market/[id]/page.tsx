'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { Abi } from 'viem';
import { zeroAddress } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { BetModal } from '@/components/BetModal';
import { MarketCard } from '@/components/MarketCard';
import { NetworkBanner } from '@/components/NetworkBanner';
import { WalletPill } from '@/components/WalletPill';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';
import { arcTestnet } from '@/lib/chain';
import type { DashboardRow } from '@/lib/derivePosition';

const predictionMarketAbi = PredictionMarketAbi as Abi;

type DashboardResult = readonly [DashboardRow[], bigint];
type BetSelection = {
  row: DashboardRow;
  side: boolean;
};

function parseMarketId(value: string | undefined): bigint | null {
  const trimmed = value?.trim() ?? '';

  if (!trimmed || !/^\d+$/u.test(trimmed)) {
    return null;
  }

  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const routeId = params.id;
  const idBn = parseMarketId(routeId);
  const { address } = useAccount();
  const user = address ?? zeroAddress;
  const [betting, setBetting] = useState<BetSelection | null>(null);
  const readArgs = idBn === null ? undefined : [user, idBn, idBn + 1n];

  const { data, isLoading, isError, refetch } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: predictionMarketAbi,
    functionName: 'getDashboard',
    args: readArgs,
    chainId: arcTestnet.id,
    query: { enabled: idBn !== null, refetchInterval: 5_000 },
  });

  const dashboardData = data as DashboardResult | undefined;
  const row = dashboardData?.[0]?.[0];

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
              市场详情读取失败，请检查网络后重试。
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
                      <div className="font-mono text-xs text-zinc-500">
                        仪表盘窗口 {dashboardData?.[1].toString() ?? '0'}
                      </div>
                      <h2 className="mt-2 text-lg font-semibold text-white">
                        单市场深链视图
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-400">
                        这里固定读取当前市场的一条 DashboardRow，保留和首页一致的下注入口与刷新节奏，便于分享链接后直接落到可操作的详情页。
                      </p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                      <div>钱包视图：{address ? '已连接' : '访客模式'}</div>
                      <div className="mt-1 font-mono text-xs text-zinc-500">
                        Chain ID {arcTestnet.id}
                      </div>
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
                  <h2 className="text-sm font-semibold text-white">当前读取参数</h2>
                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                      <span className="text-zinc-400">市场编号</span>
                      <span className="font-mono text-white">{idBn.toString()}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                      <span className="text-zinc-400">读取地址</span>
                      <span className="font-mono text-white">
                        {address ? '已连接钱包' : zeroAddress}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                      <span className="text-zinc-400">刷新频率</span>
                      <span className="font-mono text-white">5000 ms</span>
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
                      <span className="font-mono text-xs text-zinc-500">Arcscan</span>
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
