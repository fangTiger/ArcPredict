'use client';

import { useState } from 'react';
import type { Abi } from 'viem';
import { zeroAddress } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { BetModal } from '@/components/BetModal';
import { FaucetCard } from '@/components/FaucetCard';
import { MarketCard } from '@/components/MarketCard';
import { NetworkBanner } from '@/components/NetworkBanner';
import { PositionList } from '@/components/PositionList';
import { ResolvedList } from '@/components/ResolvedList';
import { WalletPill } from '@/components/WalletPill';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';
import { arcTestnet } from '@/lib/chain';
import type { DashboardRow } from '@/lib/derivePosition';
import { OUTCOMES } from '@/lib/derivePosition';
import { fmtUsdc } from '@/lib/format';

const predictionMarketAbi = PredictionMarketAbi as Abi;

type DashboardLatestResult = readonly [DashboardRow[], bigint];

type BetSelection = {
  row: DashboardRow;
  side: boolean;
};

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-surface p-4">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-2 font-mono text-2xl text-white">{value}</div>
      <div className="mt-2 text-sm leading-6 text-zinc-400">{hint}</div>
    </section>
  );
}

function EmptyPanel({ title, body }: { title: string; body: string }) {
  return (
    <section className="mt-8 rounded-lg border border-dashed border-white/10 bg-surface p-5">
      <div className="text-sm font-semibold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{body}</p>
    </section>
  );
}

export default function HomePage() {
  const { address, isConnected } = useAccount();
  const user = address ?? zeroAddress;
  const [betting, setBetting] = useState<BetSelection | null>(null);

  const { data, isLoading, isError, refetch } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: predictionMarketAbi,
    functionName: 'getDashboardLatest',
    args: [user, 100n],
    chainId: arcTestnet.id,
    query: { refetchInterval: 5_000 },
  });

  const dashboardData = data as DashboardLatestResult | undefined;
  const rows = dashboardData?.[0] ?? [];
  const totalCount = dashboardData?.[1] ?? 0n;
  const activeMarkets = rows.filter((row) => OUTCOMES[row.market.outcome] === 'Unresolved');
  const totalActivePool = activeMarkets.reduce(
    (sum, row) => sum + row.market.yesPool + row.market.noPool,
    0n,
  );
  const hasPositionRows = rows.some(
    (row) =>
      OUTCOMES[row.market.outcome] === 'Unresolved' && (row.yesStake > 0n || row.noStake > 0n),
  );
  const hasResolvedRows = rows.some((row) => OUTCOMES[row.market.outcome] !== 'Unresolved');

  return (
    <>
      <NetworkBanner />

      <nav className="sticky top-0 z-30 border-b border-white/10 bg-base/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
              <span className="text-base font-semibold text-white">ArcPredict</span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">Arc Testnet 预测市场工作台</p>
          </div>
          <WalletPill />
        </div>
      </nav>

      <main className="min-h-screen bg-base text-white">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <section className="rounded-lg border border-white/10 bg-surface p-5">
                <div className="flex flex-col gap-5 border-b border-white/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="max-w-2xl">
                    <h1 className="text-2xl font-semibold text-white">市场总览</h1>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      首屏通过单次链上读取拉取最近 100 个市场；未连接钱包时仍可浏览市场，连接后会自动带出你的仓位与待领取金额。
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                    <div>读取网络：Arc Testnet</div>
                    <div className="mt-1 text-zinc-400">刷新频率：每 5 秒</div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard
                    label="活跃市场"
                    value={activeMarkets.length.toString()}
                    hint="仅统计仍未结算的市场。"
                  />
                  <SummaryCard
                    label="活跃总池"
                    value={`${fmtUsdc(totalActivePool)} USDC`}
                    hint="汇总活跃市场的 YES 与 NO 池子。"
                  />
                  <SummaryCard
                    label="已加载 / 总数"
                    value={`${rows.length} / ${totalCount.toString()}`}
                    hint="当前读取最近 100 个市场，便于后续继续翻旧数据。"
                  />
                  <SummaryCard
                    label="钱包状态"
                    value={isConnected ? '已连接' : '未连接'}
                    hint={isConnected ? '个人数据已按当前地址计算。' : '未连接时按空地址读取公共视图。'}
                  />
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-surface p-5">
                <div className="flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">活跃市场</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      这里只显示尚未结算的市场，便于继续下注或观察池子变化。
                    </p>
                  </div>
                  <div className="font-mono text-sm text-zinc-500">
                    已加载 {activeMarkets.length} / 总计 {rows.length}
                  </div>
                </div>

                {isLoading ? (
                  <div className="py-12 text-sm text-zinc-400">正在读取最新市场与个人视图……</div>
                ) : isError ? (
                  <div className="py-12 text-sm text-no">
                    首页数据读取失败，请检查钱包网络或稍后重试。
                  </div>
                ) : activeMarkets.length === 0 ? (
                  <div className="py-12 text-sm text-zinc-400">
                    当前没有未结算市场，等新市场发布后这里会自动出现。
                  </div>
                ) : (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {activeMarkets.map((row) => (
                      <MarketCard
                        key={row.id.toString()}
                        row={row}
                        onBet={(_id, side) => setBetting({ row, side })}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-6">
              <FaucetCard />

              <section className="rounded-lg border border-white/10 bg-surface p-5">
                <h2 className="text-sm font-semibold text-white">使用提示</h2>
                <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
                  <p>下注会先检查 USDC 授权，再进入真实下注交易。</p>
                  <p>活跃总池只统计未结算市场，避免把历史结果混在当前流动性里。</p>
                  <p>已结算区会显示待领取金额；关闭下注弹窗后首页会主动刷新。</p>
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-surface p-5">
                <h2 className="text-sm font-semibold text-white">读取说明</h2>
                <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
                  <p>本页使用 `getDashboardLatest(user, 100)` 单次读取最近市场，不走旧的范围分页视图。</p>
                  <p>未连接钱包时，会对空地址读取公共市场数据，因此你仍然可以先浏览盘口。</p>
                </div>
              </section>
            </aside>
          </section>

          <section className="grid gap-8 xl:grid-cols-2">
            <div>
              <PositionList rows={rows} />
              {!hasPositionRows ? (
                <EmptyPanel
                  title="我的持仓"
                  body="你当前没有未结算仓位。连接钱包后，新下注的市场会在这里持续显示直到结算。"
                />
              ) : null}
            </div>

            <div>
              <ResolvedList rows={rows} />
              {!hasResolvedRows ? (
                <EmptyPanel
                  title="已结算市场"
                  body="最近读取到的市场还没有结算结果。等链上完成结算后，这里会出现结果与领取动作。"
                />
              ) : null}
            </div>
          </section>
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
