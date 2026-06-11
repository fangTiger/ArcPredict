'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import type { Abi } from 'viem';
import { maxUint256, parseAbiItem, zeroAddress } from 'viem';
import { useAccount, usePublicClient, useReadContract } from 'wagmi';
import { BetModal } from '@/components/BetModal';
import { MarketDetailCard } from '@/components/MarketDetailCard';
import { NetworkBanner } from '@/components/NetworkBanner';
import { SeedDisclosure, sumSeedContribution } from '@/components/SeedDisclosure';
import { WalletPill } from '@/components/WalletPill';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';
import { FRONTEND_DEPLOY_BLOCK } from '@/lib/asset-price-map';
import { fetchLogsPaged } from '@/lib/bet-event-scan';
import { arcTestnet } from '@/lib/chain';
import { isPhase16Enabled } from '@/lib/phase16-flag';
import { SEED_WALLETS } from '@/lib/seed-wallets';

const predictionMarketAbi = PredictionMarketAbi as Abi;
const MAX_MARKET_ID = maxUint256;
const betEvent = parseAbiItem(
  'event Bet(uint256 indexed id, address indexed user, bool yes, uint128 amount, uint128 yesPoolAfter, uint128 noPoolAfter)',
);

type MarketRow = ComponentProps<typeof MarketDetailCard>['row'];
type DashboardResult = readonly [MarketRow[], bigint];
type BetSelection = {
  row: MarketRow;
  side: boolean;
};
type SeedBetEvent = {
  user: `0x${string}`;
  amount: bigint;
};
type SeedBetLog = {
  args?: {
    user?: `0x${string}`;
    amount?: bigint;
  };
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
  if (error === null || typeof error !== 'object') {
    return false;
  }

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
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const user = address ?? zeroAddress;
  const [betting, setBetting] = useState<BetSelection | null>(null);
  const [seedBetEvents, setSeedBetEvents] = useState<SeedBetEvent[] | undefined>(undefined);
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
  const showPhase16 = isPhase16Enabled();
  const seedContribution = useMemo(
    () => sumSeedContribution(seedBetEvents ?? [], SEED_WALLETS),
    [seedBetEvents],
  );

  useEffect(() => {
    if (!showPhase16 || idBn === null) {
      setSeedBetEvents([]);
      return;
    }

    if (!publicClient) {
      setSeedBetEvents([]);
      return;
    }

    let cancelled = false;
    setSeedBetEvents(undefined);

    const loadSeedBetEvents = async () => {
      try {
        const logs = await fetchLogsPaged<
          SeedBetLog,
          typeof PREDICTION_MARKET_ADDRESS,
          typeof betEvent,
          { id: bigint }
        >(
          {
            getBlockNumber: () => publicClient.getBlockNumber(),
            getLogs: (params) =>
              publicClient.getLogs(params as never) as Promise<readonly SeedBetLog[]>,
          },
          {
            address: PREDICTION_MARKET_ADDRESS,
            event: betEvent,
            args: { id: idBn },
            fromBlock: FRONTEND_DEPLOY_BLOCK,
            toBlock: 'latest',
          },
        );

        if (cancelled) {
          return;
        }

        const nextEvents = logs.flatMap((log) => {
          const eventUser = log.args?.user;
          const eventAmount = log.args?.amount;

          if (!eventUser || eventAmount === undefined) {
            return [];
          }

          return [{ user: eventUser, amount: eventAmount }];
        });

        setSeedBetEvents(nextEvents);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        console.error('读取市场 Bet 历史事件失败，将按空数组继续显示。', loadError);
        setSeedBetEvents([]);
      }
    };

    void loadSeedBetEvents();

    return () => {
      cancelled = true;
    };
  }, [idBn, publicClient, showPhase16]);

  return (
    <>
      <NetworkBanner />

      <nav className="sticky top-0 z-30 border-b border-hair bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <Link href="/" className="text-sm text-ink-2 transition hover:text-ink">
              返回首页
            </Link>
            <h1 className="mt-2 text-xl font-semibold text-ink">
              市场 #{routeId ?? '未知编号'}
            </h1>
          </div>
          <WalletPill />
        </div>
      </nav>

      <main className="min-h-screen bg-canvas text-ink">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          {idBn === null ? (
            <section className="rounded-lg border border-no/35 bg-no/10 p-5 text-sm text-no">
              市场编号无效，请返回首页重新选择。
            </section>
          ) : isLoading ? (
            <section className="rounded-lg border border-hair bg-paper p-5 text-sm text-ink-2">
              正在读取市场详情……
            </section>
          ) : isError ? (
            <section className="rounded-lg border border-no/35 bg-no/10 p-5 text-sm text-no">
              {marketMissing ? '未找到该市场，请返回首页查看其他市场。' : '市场详情读取失败，请检查网络后重试。'}
            </section>
          ) : !row ? (
            <section className="rounded-lg border border-hair bg-paper p-5 text-sm text-ink-2">
              未找到该市场，可能尚未发布或已超出当前范围。
            </section>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">
              <div className="space-y-6">
                <section className="rounded-lg border border-hair bg-paper p-5">
                  <div className="flex flex-col gap-4 border-b border-hair pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-2xl">
                      <div className="font-mono text-xs text-ink-2">市场编号 #{idBn.toString()}</div>
                      <h2 className="mt-2 text-lg font-semibold text-ink">市场详情</h2>
                      <p className="mt-2 text-sm leading-6 text-ink-2">
                        这里展示市场题目、池子状态和下注入口，适合从分享链接直接进入查看或继续操作。
                      </p>
                    </div>
                    <div className="rounded-lg border border-hair bg-canvas px-4 py-3 text-sm text-ink-2">
                      <div className="font-medium text-ink">当前网络：{arcTestnet.name}</div>
                      <div className="mt-1">钱包状态：{walletStatus}</div>
                    </div>
                  </div>

                  <div className="mt-5">
                    <MarketDetailCard
                      row={row}
                      onBet={(_id, side) => setBetting({ row, side })}
                    />
                    {showPhase16 ? (
                      <div className="mt-4">
                        <SeedDisclosure
                          seedContribution={seedContribution}
                          loading={seedBetEvents === undefined}
                        />
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-lg border border-hair bg-paper p-5">
                  <h2 className="text-sm font-semibold text-ink">市场状态</h2>
                  <div className="mt-4 space-y-3 text-sm text-ink-2">
                    <div className="flex items-center justify-between rounded-lg border border-hair bg-canvas px-4 py-3">
                      <span className="text-ink-2">市场编号</span>
                      <span className="font-mono text-ink">{idBn.toString()}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-hair bg-canvas px-4 py-3">
                      <span className="text-ink-2">当前网络</span>
                      <span className="font-mono text-ink">{arcTestnet.name}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-hair bg-canvas px-4 py-3">
                      <span className="text-ink-2">钱包状态</span>
                      <span className="font-mono text-ink">{walletStatus}</span>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-hair bg-paper p-5">
                  <h2 className="text-sm font-semibold text-ink">辅助入口</h2>
                  <div className="mt-4 space-y-3">
                    <Link
                      href="/connect"
                      className="flex items-center justify-between rounded-lg border border-hair bg-canvas px-4 py-3 text-sm text-ink-2 transition hover:border-arc/20 hover:bg-paper"
                    >
                      <span>网络与钱包排查</span>
                      <span className="font-mono text-xs text-ink-2">/connect</span>
                    </Link>
                    <a
                      href={`https://testnet.arcscan.app/address/${PREDICTION_MARKET_ADDRESS}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-lg border border-hair bg-canvas px-4 py-3 text-sm text-ink-2 transition hover:border-arc/20 hover:bg-paper"
                    >
                      <span>合约浏览器</span>
                      <span className="font-mono text-xs text-ink-2">{contractAddressLabel}</span>
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
