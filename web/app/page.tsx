'use client';

import { useState, useMemo } from 'react';
import type { Abi } from 'viem';
import { zeroAddress } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { BetModal } from '@/components/BetModal';
import { FaucetCard } from '@/components/FaucetCard';
import {
  MarketFilterBar,
  filterMarkets,
  type AssetFilter,
  type CadenceFilter,
} from '@/components/MarketFilterBar';
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
import { PYTH_PRICE_ID_TO_ASSET } from '@/lib/asset-price-map';
import { fmtUsdc } from '@/lib/format';
import { isPhase16Enabled } from '@/lib/phase16-flag';

const predictionMarketAbi = PredictionMarketAbi as Abi;

type DashboardLatestResult = readonly [DashboardRow[], bigint];

type BetSelection = {
  row: DashboardRow;
  side: boolean;
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

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
  const [asset, setAsset] = useState<AssetFilter>('all');
  const [cadence, setCadence] = useState<CadenceFilter>('all');

  const { data, isLoading, isError, refetch } = useReadContract({
    address: PREDICTION_MARKET_ADDRESS,
    abi: predictionMarketAbi,
    functionName: 'getDashboardLatest',
    args: [user, 100n],
    chainId: arcTestnet.id,
    query: { refetchInterval: 5_000 },
  });

  const dashboardData = data as DashboardLatestResult | undefined;
  const dashboardLoaded = dashboardData !== undefined && !isLoading && !isError;
  const rows = dashboardData?.[0] ?? [];
  const totalCount = dashboardData?.[1] ?? 0n;
  const activeMarkets = rows.filter((row) => OUTCOMES[row.market.outcome] === 'Unresolved').map((row) => ({
    ...row,
    pythPriceId: row.market.pythPriceId,
    question: row.market.question,
  }));
  const showPhase16 = isPhase16Enabled();
  const visibleActiveMarkets = useMemo(
    () =>
      showPhase16
        ? filterMarkets(activeMarkets, {
            asset,
            cadence,
            priceIdToAsset: PYTH_PRICE_ID_TO_ASSET,
          })
        : activeMarkets,
    [activeMarkets, asset, cadence, showPhase16],
  );
  const totalActivePool = activeMarkets.reduce(
    (sum, row) => sum + row.market.yesPool + row.market.noPool,
    0n,
  );
  const resolvedCount = rows.length - activeMarkets.length;
  const loadingValue = isError ? '读取失败' : '读取中';
  const activeMarketValue = dashboardLoaded ? activeMarkets.length.toString() : loadingValue;
  const totalPoolValue = dashboardLoaded ? `${fmtUsdc(totalActivePool)} USDC` : loadingValue;
  const loadedCountValue = dashboardLoaded
    ? `${rows.length} / ${totalCount.toString()}`
    : loadingValue;
  const activeSectionCountValue = dashboardLoaded
    ? `${activeMarkets.length} / ${rows.length}`
    : loadingValue;
  const resolvedCountValue = dashboardLoaded
    ? `${activeMarkets.length} / ${resolvedCount}`
    : loadingValue;
  const contractAddressLabel = shortAddress(PREDICTION_MARKET_ADDRESS);
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
                      最近市场、当前流动性、个人仓位和已结算结果会在这里并排展开，方便连续盯盘和快速下单。
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                    <div>当前网络：Arc Testnet</div>
                    <div className="mt-1 text-zinc-400">合约：{contractAddressLabel}</div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard
                    label="活跃市场"
                    value={activeMarketValue}
                    hint="仍在交易或等待结算的市场数量。"
                  />
                  <SummaryCard
                    label="活跃总池"
                    value={totalPoolValue}
                    hint="未结算市场当前沉淀的总资金。"
                  />
                  <SummaryCard
                    label="已加载 / 总数"
                    value={loadedCountValue}
                    hint="最近市场覆盖范围与市场总量。"
                  />
                  <SummaryCard
                    label="钱包状态"
                    value={isConnected ? '已连接' : '未连接'}
                    hint={isConnected ? '当前地址已接入。' : '当前没有接入地址。'}
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
                  <div className="font-mono text-sm text-zinc-500">已加载 {activeSectionCountValue}</div>
                </div>

                {showPhase16 && (
                  <div className="mt-4">
                    <MarketFilterBar
                      asset={asset}
                      cadence={cadence}
                      onChange={({ asset: nextAsset, cadence: nextCadence }) => {
                        setAsset(nextAsset);
                        setCadence(nextCadence);
                      }}
                    />
                  </div>
                )}

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
                ) : visibleActiveMarkets.length === 0 ? (
                  <div className="py-12 text-sm text-zinc-400">
                    当前筛选条件下没有未结算市场，请切换 Asset 或 Cadence 后重试。
                  </div>
                ) : (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {visibleActiveMarkets.map((row) => (
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
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-white">链上入口</h2>
                  <span className="font-mono text-xs text-zinc-500">{contractAddressLabel}</span>
                </div>
                <div className="mt-4 space-y-3">
                  <a
                    href="https://testnet.arcscan.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/10"
                  >
                    <span>Arcscan 浏览器</span>
                    <span className="font-mono text-xs text-zinc-500">testnet.arcscan.app</span>
                  </a>
                  <a
                    href={`https://testnet.arcscan.app/address/${PREDICTION_MARKET_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/10"
                  >
                    <span>预测合约</span>
                    <span className="font-mono text-xs text-zinc-500">{contractAddressLabel}</span>
                  </a>
                  <a
                    href="https://faucet.circle.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/10"
                  >
                    <span>Circle Faucet</span>
                    <span className="font-mono text-xs text-zinc-500">USDC</span>
                  </a>
                </div>
              </section>

              <section className="rounded-lg border border-white/10 bg-surface p-5">
                <h2 className="text-sm font-semibold text-white">市场状态</h2>
                <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-zinc-400">Arc Testnet</span>
                    <span className="font-mono text-white">{contractAddressLabel}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-zinc-400">活跃 / 已结算</span>
                    <span className="font-mono text-white">{resolvedCountValue}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-zinc-400">已加载 / 总数</span>
                    <span className="font-mono text-white">{loadedCountValue}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <span className="text-zinc-400">钱包状态</span>
                    <span className="font-mono text-white">
                      {isConnected ? '已连接' : '未连接'}
                    </span>
                  </div>
                </div>
              </section>
            </aside>
          </section>

          <section className="grid gap-8 xl:grid-cols-2">
            <div>
              {isConnected ? (
                isError ? (
                  <EmptyPanel
                    title="我的持仓"
                    body="个人仓位读取失败，请稍后重试。"
                  />
                ) : dashboardLoaded ? (
                  <>
                    <PositionList rows={rows} />
                    {!hasPositionRows ? (
                      <EmptyPanel
                        title="我的持仓"
                        body="你当前没有未结算仓位。新的下注会在这里持续显示直到结算。"
                      />
                    ) : null}
                  </>
                ) : (
                  <EmptyPanel
                    title="我的持仓"
                    body="正在读取你的未结算仓位。"
                  />
                )
              ) : (
                <EmptyPanel
                  title="我的持仓"
                  body="连接钱包后查看你的未结算仓位。"
                />
              )}
            </div>

            <div>
              {isConnected ? (
                isError ? (
                  <EmptyPanel
                    title="已结算市场"
                    body="结算结果读取失败，请稍后重试。"
                  />
                ) : dashboardLoaded ? (
                  <>
                    <ResolvedList rows={rows} />
                    {!hasResolvedRows ? (
                      <EmptyPanel
                        title="已结算市场"
                        body="最近读取到的市场还没有结算结果。等链上完成结算后，这里会出现结果与领取动作。"
                      />
                    ) : null}
                  </>
                ) : (
                  <EmptyPanel
                    title="已结算市场"
                    body="正在读取你的结算结果。"
                  />
                )
              ) : (
                <EmptyPanel
                  title="已结算市场"
                  body="连接钱包后查看你的结算结果与可领取金额。"
                />
              )}
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
