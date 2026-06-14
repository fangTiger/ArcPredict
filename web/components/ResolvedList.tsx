'use client';

import { useEffect, useRef, useState } from 'react';
import type { Abi, Hash } from 'viem';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
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
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { writeContractAsync, isPending } = useWriteContract();
  const [pendingId, setPendingId] = useState<bigint | null>(null);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(() => new Set());
  const [statusById, setStatusById] = useState<Record<string, string>>({});
  const claimScopeRef = useRef(0);

  useEffect(() => {
    claimScopeRef.current += 1;
    setSubmittedIds(() => new Set());
    setStatusById({});
    setPendingId(null);
  }, [address]);

  useEffect(() => {
    const settledRows = rows.filter((r) => r.claimed_ || r.pendingPayout === 0n);

    if (settledRows.length === 0) {
      return;
    }

    const settledIds = new Set(settledRows.map((r) => r.id.toString()));

    setSubmittedIds((ids) => {
      const next = new Set(ids);
      let changed = false;

      for (const id of settledIds) {
        if (next.delete(id)) {
          changed = true;
        }
      }

      return changed ? next : ids;
    });

    setStatusById((current) => {
      const next = { ...current };
      let changed = false;

      for (const id of settledIds) {
        if (id in next) {
          delete next[id];
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [rows]);

  if (resolved.length === 0) return null;

  const waitForClaimReceipt = async (idKey: string, hash: Hash, scope: number) => {
    if (!publicClient) {
      if (claimScopeRef.current !== scope) {
        return;
      }

      setSubmittedIds((ids) => {
        const next = new Set(ids);
        next.delete(idKey);
        return next;
      });
      setStatusById((current) => ({
        ...current,
        [idKey]: '网络异常，请稍后重试。',
      }));
      return;
    }

    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (claimScopeRef.current !== scope) {
        return;
      }

      if (receipt.status === 'success') {
        setStatusById((current) => ({
          ...current,
          [idKey]: '领取已确认，等待页面刷新。',
        }));
        return;
      }

      setSubmittedIds((ids) => {
        const next = new Set(ids);
        next.delete(idKey);
        return next;
      });
      setStatusById((current) => ({
        ...current,
        [idKey]: '领取交易失败，请重试。',
      }));
    } catch (error) {
      if (claimScopeRef.current !== scope) {
        return;
      }

      setSubmittedIds((ids) => {
        const next = new Set(ids);
        next.delete(idKey);
        return next;
      });
      setStatusById((current) => ({
        ...current,
        [idKey]: humanizeError(error),
      }));
    }
  };

  const claim = async (id: bigint) => {
    const idKey = id.toString();
    const scope = claimScopeRef.current;

    try {
      setStatusById((current) => {
        const next = { ...current };
        delete next[idKey];
        return next;
      });
      setPendingId(id);
      const hash = await writeContractAsync({
        address: PREDICTION_MARKET_ADDRESS,
        abi: predictionMarketAbi,
        functionName: 'claim',
        args: [id],
        chainId: arcTestnet.id,
      });

      if (claimScopeRef.current !== scope) {
        return;
      }

      setSubmittedIds((ids) => new Set(ids).add(id.toString()));
      setStatusById((current) => ({
        ...current,
        [idKey]: `领取交易已提交：${hash.slice(0, 10)}...，等待链上确认`,
      }));
      void waitForClaimReceipt(idKey, hash, scope);
    } catch (error) {
      if (claimScopeRef.current !== scope) {
        return;
      }

      setStatusById((current) => ({
        ...current,
        [idKey]: humanizeError(error),
      }));
    } finally {
      setPendingId((current) => (current === id ? null : current));
    }
  };

  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <div className="border-b border-hair pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-ink">已结算市场</h2>
            <p className="mt-1 text-sm text-ink-2">已结算结果与待领取金额会在这里汇总显示。</p>
          </div>
          <span className="font-mono text-sm text-ink-2 num-glow">{resolved.length}</span>
        </div>
      </div>

      <div>
        {resolved.map((r) => {
          const outcome = OUTCOMES[r.market.outcome];
          const rowStatus = statusById[r.id.toString()];
          const isSubmitted = submittedIds.has(r.id.toString());
          const isClaimableByOutcome = !r.claimed_ && userIsWinner(r) && r.pendingPayout > 0n;
          const canClaim = isClaimableByOutcome && !submittedIds.has(r.id.toString());
          const isClaiming = pendingId === r.id && isPending;
          const outcomeBadgeClassName =
            outcome === 'Yes'
              ? 'bg-yes/15 text-yes border border-yes/30'
              : outcome === 'No'
                ? 'bg-no/15 text-no border border-no/30'
                : 'bg-ink-3/15 text-ink-3 border border-ink-3/30';

          return (
            <article key={r.id.toString()} className="border-b border-hair py-4 last:border-b-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-ink-2">#{r.id.toString()}</span>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${outcomeBadgeClassName}`}>
                  {outcome}
                </span>
              </div>

              <div className="mb-4 text-sm leading-6 text-ink">{r.market.question}</div>

              <div className="mb-4 space-y-1 text-xs text-ink-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                    待领取
                  </span>
                  <span className="font-mono text-ink num-glow">{fmtUsdc(r.pendingPayout)} USDC</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                    领取状态
                  </span>
                  <span className="text-ink">
                    {rowStatus
                      ? rowStatus
                      : r.claimed_
                      ? '已领取'
                      : canClaim
                        ? '可领取'
                        : isSubmitted
                          ? '等待链上确认'
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
                  disabled={isClaiming || isSubmitted}
                  className="w-full rounded-2xl border border-arc-glow/40 bg-arc/15 px-3 py-2 text-sm font-medium text-arc-glow transition hover:bg-arc/25 hover:shadow-[inset_0_0_24px_rgba(77,168,255,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isClaiming
                    ? '领取提交中...'
                    : isSubmitted
                    ? '等待链上确认'
                      : `Claim ${fmtUsdc(r.pendingPayout)} USDC`}
                </button>
              ) : (
                <div className="rounded-2xl border border-hair px-3 py-2 text-xs text-ink-2">
                  {rowStatus
                    ? rowStatus
                    : r.pendingPayout > 0n
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
