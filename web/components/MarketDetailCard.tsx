'use client';

import { useEffect, useState } from 'react';
import type { DashboardRow } from '@/lib/derivePosition';
import { OUTCOMES, yesPercent } from '@/lib/derivePosition';
import { fmtUsdc } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import {
  EVENT_UNRESOLVED_OUTCOME,
  type WorldCupMarketRow,
} from '@/lib/worldcup-markets';
import { EventInfoPanel } from './EventInfoPanel';
import { ImpliedProbabilityChart } from './ImpliedProbabilityChart';
import { ResolveCountdown } from './ResolveCountdown';
import { WorldCupOutcomePanel } from './WorldCupOutcomePanel';

const nowInSeconds = () => BigInt(Math.floor(Date.now() / 1000));

type PriceMarketDetailCardProps = {
  marketKind?: 'price';
  row: DashboardRow;
  onBet: (id: bigint, yes: boolean) => void;
};

type EventMarketDetailCardProps = {
  marketKind: 'event';
  row: WorldCupMarketRow;
  onBet?: (row: WorldCupMarketRow, outcomeIndex: number) => void;
};

export function MarketDetailCard(
  props: PriceMarketDetailCardProps | EventMarketDetailCardProps,
) {
  const [now, setNow] = useState<bigint>(() => nowInSeconds());
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(nowInSeconds());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const marketKind = props.marketKind ?? 'price';

  if (marketKind === 'event') {
    const { row, onBet } = props as EventMarketDetailCardProps;
    const bettingOpen = row.settledOutcome === EVENT_UNRESOLVED_OUTCOME && now < row.betDeadline;

    return (
      <article className="rounded-lg border border-hair bg-paper p-5 transition hover:border-arc/20">
        <div className="mb-4 flex flex-col gap-3 border-b border-hair pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="font-mono text-xs text-ink-2">
              {row.stageLabel} · #{row.id.toString()}
            </span>
            <div className="mt-2 text-lg font-medium leading-7 text-ink">{row.question}</div>
          </div>

          <div className="rounded-lg border border-hair bg-canvas px-4 py-3 text-sm text-ink-2">
            <div className="text-xs uppercase text-emerald-700">EVENT</div>
            <div className="mt-2 font-mono text-sm text-ink">{row.outcomes.length} outcomes</div>
          </div>
        </div>

        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-hair bg-canvas px-4 py-3">
            <div className="mb-1 text-xs text-ink-2">Total Pool</div>
            <div className="font-mono text-lg text-ink">{fmtUsdc(row.liquidity)} USDC</div>
          </div>

          <div className="rounded-lg border border-hair bg-canvas px-4 py-3">
            <div className="mb-1 text-xs text-ink-2">Position</div>
            <div className="font-mono text-lg text-ink">{row.positionLabel}</div>
          </div>
        </div>

        <div className="space-y-5">
          <WorldCupOutcomePanel
            marketType={row.marketType}
            outcomes={row.outcomes}
            isMobile={isMobile}
            homeTeamLabel={row.homeTeam.nameEn}
            onSelectOutcome={
              onBet
                ? (outcomeIndex) => onBet(row, outcomeIndex)
                : undefined
            }
            bettingOpen={bettingOpen}
          />
          <EventInfoPanel row={row} />
          <ImpliedProbabilityChart row={row} />
        </div>
      </article>
    );
  }

  if (marketKind === 'price') {
    const { row, onBet } = props as PriceMarketDetailCardProps;

    const m = row.market;
    const yesPct = yesPercent(m);
    const noPct = 100 - yesPct;
    const totalPool = m.yesPool + m.noPool;
    const outcome = OUTCOMES[m.outcome];
    const isUnresolved = outcome === 'Unresolved';
    const bettingOpen = isUnresolved && now < m.betDeadline;

    return (
      <article className="rounded-lg border border-hair bg-paper p-5 transition hover:border-arc/20">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-ink-2">#{row.id.toString()}</span>
          <ResolveCountdown row={row} />
        </div>

        <div className="mb-4 text-lg font-medium leading-7 text-ink">{m.question}</div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1 text-xs text-ink-2">Total Pool</div>
            <div className="font-mono text-lg text-ink">{fmtUsdc(totalPool)} USDC</div>
          </div>
          <div>
            <div className="mb-1 text-xs text-ink-2">YES Share</div>
            <div className="font-mono text-lg text-ink">{yesPct.toFixed(0)}%</div>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-mono text-yes">YES {yesPct.toFixed(0)}%</span>
          <span className="font-mono text-no">NO {noPct.toFixed(0)}%</span>
        </div>

        <div className="mb-3 h-2 overflow-hidden rounded-full bg-no/20">
          <div className="h-full bg-yes transition-[width]" style={{ width: `${yesPct}%` }} />
        </div>

        <div className="mb-5 grid grid-cols-2 gap-4 text-xs text-ink-2">
          <div className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2">
            <span className="font-medium text-yes">YES</span>
            <span className="font-mono text-ink">{fmtUsdc(m.yesPool)} USDC</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2">
            <span className="font-medium text-no">NO</span>
            <span className="font-mono text-ink">{fmtUsdc(m.noPool)} USDC</span>
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
          <div className="rounded-lg border border-hair bg-canvas px-3 py-3 text-sm text-ink-2">
            Betting closed
          </div>
        )
        ) : (
          <div className="rounded-lg border border-hair bg-canvas px-3 py-3 text-sm text-ink-2">
            Outcome: <span className="font-mono">{outcome}</span>
          </div>
        )}
      </article>
    );
  }

  return null;
}
