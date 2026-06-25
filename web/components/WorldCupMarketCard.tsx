'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AILensCompact } from '@/components/AILensCompact';
import { BaseMarketCard } from '@/components/BaseMarketCard';
import { MarketCategoryIcon } from '@/components/MarketCategoryIcon';
import { flagIconUrlForTeam } from '@/lib/flag-icons';
import { fmtCountdown, fmtUsdc } from '@/lib/format';
import type { LensInput } from '@/lib/lens/schema';
import { toRichMarketRef } from '@/lib/market-richness';
import { useMediaQuery } from '@/lib/use-media-query';
import {
  EVENT_UNRESOLVED_OUTCOME,
  type WorldCupMarketRow,
} from '@/lib/worldcup-markets';
import { WorldCupOutcomePanel } from './WorldCupOutcomePanel';

const nowInSeconds = () => BigInt(Math.floor(Date.now() / 1000));
const fixedOneXTwoLabels = ['Home Win', 'Draw', 'Away Win'] as const;
const toLensProbability = (value: number) => Math.max(0, Math.min(1, value / 100));

function formatKickoff(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
    .format(new Date(iso))
    .replace(',', ' ·');
}

function formatUnixTime(seconds: bigint): string {
  return formatKickoff(new Date(Number(seconds * 1000n)).toISOString());
}

function marketTypeLabel(marketType: WorldCupMarketRow['marketType']): string {
  return marketType === 'totals' ? 'TOTALS' : marketType.toUpperCase();
}

function compactBalanceLabel(row: WorldCupMarketRow, fallback: string): string {
  if (row.outcomes.length === 0) {
    return fallback;
  }

  const ranked = row.outcomes
    .map((outcome, index) => ({
      index,
      probability: outcome.impliedProbability,
    }))
    .sort((left, right) => right.probability - left.probability);

  const leader = ranked[0];
  const runnerUp = ranked[1];

  if (!leader) {
    return fallback;
  }

  if (runnerUp && Math.abs(leader.probability - runnerUp.probability) <= 4) {
    return 'Balanced';
  }

  if (row.marketType === '1x2') {
    return ['Home leading', 'Draw leading', 'Away leading'][leader.index] ?? 'Top outcome';
  }

  return 'Top outcome';
}

function eventCategoryLabel(category: WorldCupMarketRow['category']): string {
  if (category === 'macro') {
    return 'Macro';
  }

  if (category === 'chain') {
    return 'On-chain';
  }

  if (category === 'crypto') {
    return 'Crypto';
  }

  return 'World Cup';
}

function TeamBadge({ nameEn, shortCode, teamId }: WorldCupMarketRow['homeTeam']) {
  const flagUrl = teamId ? flagIconUrlForTeam(teamId) : null;

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-hair bg-bg-0">
        {flagUrl ? (
          <span
            className="inline-block h-4 w-6 rounded-[4px] border border-hair bg-cover bg-center shadow-sm"
            style={{ backgroundImage: `url(${flagUrl})` }}
            aria-hidden="true"
          />
        ) : (
          <span className="inline-flex h-4 min-w-6 items-center justify-center rounded-[4px] border border-hair px-1 text-[10px] font-semibold text-ink-2">
            {shortCode}
          </span>
        )}
      </span>
      <div>
        <div className="font-mono text-sm text-ink">{shortCode}</div>
        <div className="text-[11px] text-ink-2">{nameEn}</div>
      </div>
    </div>
  );
}

function OutcomeFlexButtons({
  row,
  bettingOpen,
  onBet,
}: {
  row: WorldCupMarketRow;
  bettingOpen: boolean;
  onBet: (row: WorldCupMarketRow, outcomeIndex: number) => void;
}) {
  const gridClassName = row.outcomes.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="mb-5">
      <div className={`mt-4 grid w-full ${gridClassName} gap-2`}>
        {row.outcomes.map((outcome, outcomeIndex) => {
          const pct = Math.round(outcome.impliedProbability);
          const label =
            row.category === 'worldcup' && row.marketType === '1x2'
              ? fixedOneXTwoLabels[outcomeIndex] ?? `Outcome ${outcomeIndex + 1}`
              : outcome.label;
          return (
            <button
              key={outcome.id}
              type="button"
              onClick={() => onBet(row, outcomeIndex)}
              disabled={!bettingOpen}
              aria-label={`${label} ${pct}%`}
              className="min-w-0 rounded-lg border border-hair bg-bg-0 px-2 py-2.5 text-center font-semibold text-ink transition hover:border-arc/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0 disabled:cursor-not-allowed disabled:opacity-55 sm:px-3"
            >
              <span className="block truncate text-[11px] leading-4 sm:text-xs">{label}</span>
              <span className="mt-0.5 block font-mono text-[13px] leading-4 text-ink-2 sm:text-sm">
                {pct}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorldCupMarketCard({
  row,
  onBet,
}: {
  row: WorldCupMarketRow;
  onBet?: (row: WorldCupMarketRow, outcomeIndex: number) => void;
}) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [now, setNow] = useState<bigint>(() => nowInSeconds());
  const [lensGeneratedAt] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(nowInSeconds());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const stageLabel = row.stageLabel;
  const kickoffLabel = formatKickoff(row.kickoffTime);
  const liquidityLabel = `${fmtUsdc(row.liquidity)} USDC`;
  const positionLabel = row.positionLabel;
  const bettingOpen = row.settledOutcome === EVENT_UNRESOLVED_OUTCOME && row.betDeadline > now;
  const isWorldCupMarket = row.category === 'worldcup';
  const countdownLabel =
    row.betDeadline > now
      ? `${isWorldCupMarket ? '⚽ ' : ''}${fmtCountdown(row.betDeadline, now)}`
      : `${isWorldCupMarket ? '⚽ ' : ''}Closed`;
  const deploymentQuery = row.deploymentId ? `&deployment=${encodeURIComponent(row.deploymentId)}` : '';
  const detailHref = `/market/${row.id.toString()}?kind=event${deploymentQuery}`;
  const isWinnerMarket = row.marketType === 'winner';
  const richMarket = toRichMarketRef(row, now);
  const balanceLabel = compactBalanceLabel(row, richMarket.skewLabel);
  const titleLabel =
    !isWorldCupMarket
      ? row.question
      : isWinnerMarket
        ? 'World Cup Winner'
        : `${row.homeTeam.nameEn} VS ${row.awayTeam?.nameEn ?? ''}`;
  const lensOutcomeOptions = row.outcomes.map((outcome) => outcome.label);
  const lensInput: LensInput = {
    market: {
      id: row.id.toString(),
      question: row.question,
      type: 'event-multi',
      end_time: Number(row.betDeadline),
      implied_probability: toLensProbability(row.outcomes[0]?.impliedProbability ?? 0),
      category: row.category,
      eventId: row.eventId,
      outcome_options: lensOutcomeOptions,
      outcome_implied_probabilities: Object.fromEntries(
        row.outcomes.map((outcome) => [
          outcome.label,
          toLensProbability(outcome.impliedProbability),
        ]),
      ),
    },
    context: { facts: [] },
    generated_at: lensGeneratedAt,
  };

  return (
    <BaseMarketCard
      renderHeader={() => (
        <Link
          href={detailHref}
          className="block rounded-[12px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-[10px]">
              <span className="inline-flex h-8 items-center justify-center rounded-full border border-hair bg-bg-2 px-3 text-[11px] font-semibold uppercase text-ink">
                {isWorldCupMarket ? stageLabel : eventCategoryLabel(row.category)}
              </span>
              <span className="font-mono text-xs text-ink-2">#{row.id.toString()}</span>
            </div>
            <span className="rounded-full border border-hair bg-bg-2 px-[10px] py-1 text-[11px] font-semibold uppercase text-ink-2">
              {!isWorldCupMarket || isWinnerMarket ? `Closes ${formatUnixTime(row.betDeadline)}` : kickoffLabel}
            </span>
          </div>

          {row.themeVisual ? (
            <div className="mb-4 rounded-xl border border-hair bg-bg-0 px-4 py-3">
              <div className="font-mono text-[11px] uppercase text-ink-3">{row.themeVisual.title}</div>
              <div className="mt-2 text-sm leading-6 text-ink-2">
                {row.themeVisual.subtitle} · {richMarket.activityLabel}
              </div>
              <div className="mt-2 text-[11px] uppercase text-ink-3">{richMarket.probabilityLabel}</div>
            </div>
          ) : null}

          {!isWorldCupMarket ? (
            <div className="mb-4 rounded-xl border border-hair bg-bg-0 px-4 py-3">
              <div className="flex items-start gap-3">
                <MarketCategoryIcon category={row.category} label={eventCategoryLabel(row.category)} />
                <div className="min-w-0">
                  <div className="font-mono text-[11px] uppercase text-ink-3">
                    {eventCategoryLabel(row.category)} event
                  </div>
                  <h3 className="mt-2 text-[18px] font-semibold leading-6 text-ink">{titleLabel}</h3>
                  <div className="mt-2 font-mono text-xs text-ink-2">
                    {row.outcomes.length} outcomes · closes {formatUnixTime(row.betDeadline)}
                  </div>
                </div>
              </div>
            </div>
          ) : isWinnerMarket ? (
            <div className="mb-4 rounded-xl border border-hair bg-bg-0 px-4 py-3">
              <div className="font-mono text-[11px] uppercase text-ink-3">
                Tournament outright
              </div>
              <h3 className="mt-2 text-[20px] font-semibold leading-7 text-ink">{titleLabel}</h3>
              <div className="mt-2 font-mono text-xs text-ink-2">{row.question}</div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <TeamBadge {...row.homeTeam} />
                <div className="text-center">
                  <div className="text-base font-semibold leading-none text-ink">VS</div>
                  <div className="mt-1 text-[11px] uppercase text-ink-2">
                    {marketTypeLabel(row.marketType)}
                  </div>
                </div>
                {row.awayTeam ? <TeamBadge {...row.awayTeam} /> : <div className="w-[88px]" />}
              </div>

              <h3 className="mb-2 text-[18px] font-semibold leading-6 text-ink">{titleLabel}</h3>
              <div className="mb-5 font-mono text-xs text-ink-2">{row.question}</div>
            </>
          )}
        </Link>
      )}
      renderOutcomes={() =>
        onBet && !isWinnerMarket ? (
          <OutcomeFlexButtons row={row} bettingOpen={bettingOpen} onBet={onBet} />
        ) : (
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
        )
      }
      renderFooter={() => (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-hair pt-3 font-mono text-xs text-ink-2 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
          <div>
            <div className="mb-1 text-[11px] uppercase">Liquidity</div>
            <div className="font-medium text-ink">{liquidityLabel}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase">Position</div>
            <div className="font-medium text-ink">{positionLabel}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase">Closes in</div>
            <div className="font-medium text-ink">{countdownLabel}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase">Market balance</div>
            <div className="font-medium text-ink">{balanceLabel}</div>
          </div>
          <div className="flex items-end sm:justify-end">
            <Link
              href={detailHref}
              className="font-sans text-[11px] text-ink-2 transition hover:text-ink"
            >
              View details
            </Link>
          </div>
        </div>
      )}
      footerSlot={<AILensCompact input={lensInput} />}
    />
  );
}
