'use client';

import { useEffect, useState } from 'react';
import type { DashboardRow } from '@/lib/derivePosition';
import { OUTCOMES, yesPercent } from '@/lib/derivePosition';
import { fmtUsdc } from '@/lib/format';
import { ResolveCountdown } from './ResolveCountdown';

const nowInSeconds = () => BigInt(Math.floor(Date.now() / 1000));

export function MarketDetailCard({
  row,
  onBet,
}: {
  row: DashboardRow;
  onBet: (id: bigint, yes: boolean) => void;
}) {
  const [now, setNow] = useState<bigint>(() => nowInSeconds());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(nowInSeconds());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const m = row.market;
  const yesPct = yesPercent(m);
  const noPct = 100 - yesPct;
  const totalPool = m.yesPool + m.noPool;
  const outcome = OUTCOMES[m.outcome];
  const isUnresolved = outcome === 'Unresolved';
  const bettingOpen = isUnresolved && now < m.betDeadline;

  return (
    <article className="rounded-lg border border-white/10 bg-surface p-5 transition hover:border-white/20">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-xs text-zinc-500">#{row.id.toString()}</span>
        <ResolveCountdown row={row} />
      </div>

      <div className="mb-4 text-lg font-medium leading-7 text-white">{m.question}</div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1 text-xs text-zinc-500">总池</div>
          <div className="font-mono text-lg text-white">{fmtUsdc(totalPool)} USDC</div>
        </div>
        <div>
          <div className="mb-1 text-xs text-zinc-500">YES 比例</div>
          <div className="font-mono text-lg text-white">{yesPct.toFixed(0)}%</div>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-mono text-yes">YES {yesPct.toFixed(0)}%</span>
        <span className="font-mono text-no">NO {noPct.toFixed(0)}%</span>
      </div>

      <div className="mb-3 h-2 overflow-hidden rounded-full bg-no/20">
        <div className="h-full bg-yes transition-[width]" style={{ width: `${yesPct}%` }} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 text-xs text-zinc-400">
        <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
          <span className="font-medium text-yes">YES</span>
          <span className="font-mono">{fmtUsdc(m.yesPool)} USDC</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
          <span className="font-medium text-no">NO</span>
          <span className="font-mono">{fmtUsdc(m.noPool)} USDC</span>
        </div>
      </div>

      {isUnresolved ? (
        bettingOpen ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onBet(row.id, true)}
              className="flex items-center justify-between rounded-lg border border-yes/40 bg-yes/10 px-4 py-3 text-sm font-medium text-yes transition hover:bg-yes/20"
            >
              <span>Bet YES</span>
              <span className="font-mono text-xs opacity-80">{yesPct.toFixed(0)}%</span>
            </button>
            <button
              type="button"
              onClick={() => onBet(row.id, false)}
              className="flex items-center justify-between rounded-lg border border-no/40 bg-no/10 px-4 py-3 text-sm font-medium text-no transition hover:bg-no/20"
            >
              <span>Bet NO</span>
              <span className="font-mono text-xs opacity-80">{noPct.toFixed(0)}%</span>
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-300">
            下注已关闭
          </div>
        )
      ) : (
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm text-zinc-300">
          Outcome: <span className="font-mono">{outcome}</span>
        </div>
      )}
    </article>
  );
}
