'use client';

import { useState } from 'react';
import type { Abi } from 'viem';
import { useWriteContract } from 'wagmi';
import PredictionMarketAbi from '@/lib/abis/PredictionMarket.json';
import { PREDICTION_MARKET_ADDRESS } from '@/lib/addresses';
import { arcTestnet } from '@/lib/chain';
import type { DashboardRow } from '@/lib/derivePosition';
import { OUTCOMES, userIsWinner } from '@/lib/derivePosition';
import { fmtUsdc } from '@/lib/format';

const predictionMarketAbi = PredictionMarketAbi as Abi;

function humanizeError(error: unknown): string {
  const maybeError = error as {
    code?: number;
    shortMessage?: string;
    message?: string;
    cause?: { message?: string };
  };
  const rawMessage =
    maybeError.shortMessage ??
    maybeError.message ??
    maybeError.cause?.message ??
    'unknown error';
  const lower = rawMessage.toLowerCase();

  if (maybeError.code === 4001 || lower.includes('reject') || lower.includes('denied')) {
    return '已取消领取。';
  }

  if (lower.includes('alreadyclaimed')) {
    return '该仓位已领取。';
  }

  if (lower.includes('notawinner')) {
    return '当前仓位没有可领取收益。';
  }

  if (lower.includes('nopayoutavailable')) {
    return '当前没有可领取金额。';
  }

  if (lower.includes('network') || lower.includes('fetch') || lower.includes('timeout')) {
    return '网络异常，请稍后重试。';
  }

  return '领取交易提交失败，请稍后重试。';
}

export function ResolvedList({ rows }: { rows: DashboardRow[] }) {
  const resolved = rows.filter((r) => OUTCOMES[r.market.outcome] !== 'Unresolved');
  const { writeContractAsync, isPending } = useWriteContract();
  const [pendingId, setPendingId] = useState<bigint | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  if (resolved.length === 0) return null;

  const claim = async (id: bigint) => {
    try {
      setStatus(null);
      setPendingId(id);
      const hash = await writeContractAsync({
        address: PREDICTION_MARKET_ADDRESS,
        abi: predictionMarketAbi,
        functionName: 'claim',
        args: [id],
        chainId: arcTestnet.id,
      });

      setStatus(`领取交易已提交：${hash.slice(0, 10)}...`);
    } catch (error) {
      setStatus(humanizeError(error));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="mt-8 rounded-lg border border-white/10 bg-surface">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-white">已结算市场</h2>
            <p className="mt-1 text-xs text-zinc-400">已结算结果与待领取金额会在这里汇总显示。</p>
          </div>
          <span className="font-mono text-sm text-zinc-500">{resolved.length}</span>
        </div>

        {status ? <p className="mt-3 text-xs text-zinc-400">{status}</p> : null}
      </div>

      <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
        {resolved.map((r) => {
          const outcome = OUTCOMES[r.market.outcome];
          const canClaim = !r.claimed_ && userIsWinner(r) && r.pendingPayout > 0n;
          const isClaiming = pendingId === r.id && isPending;
          const outcomeTone =
            outcome === 'Yes'
              ? 'text-yes'
              : outcome === 'No'
                ? 'text-no'
                : 'text-zinc-300';

          return (
            <article key={r.id.toString()} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-zinc-500">#{r.id.toString()}</span>
                <span className={`text-xs font-medium ${outcomeTone}`}>{outcome}</span>
              </div>

              <div className="mb-4 text-sm leading-6 text-white">{r.market.question}</div>

              <div className="mb-4 space-y-1 text-xs text-zinc-400">
                <div className="flex items-center justify-between gap-3">
                  <span>待领取</span>
                  <span className="font-mono text-white">{fmtUsdc(r.pendingPayout)} USDC</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>领取状态</span>
                  <span className="text-zinc-300">
                    {r.claimed_
                      ? '已领取'
                      : canClaim
                        ? '可领取'
                        : userIsWinner(r)
                          ? '暂无可领取金额'
                          : '未命中'}
                  </span>
                </div>
              </div>

              {canClaim ? (
                <button
                  type="button"
                  onClick={() => claim(r.id)}
                  disabled={isClaiming}
                  className="w-full rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isClaiming ? '领取提交中...' : `Claim ${fmtUsdc(r.pendingPayout)} USDC`}
                </button>
              ) : (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-400">
                  {r.pendingPayout > 0n
                    ? `待领取 ${fmtUsdc(r.pendingPayout)} USDC`
                    : r.claimed_
                      ? '该仓位已完成领取。'
                      : '当前没有可领取金额。'}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
