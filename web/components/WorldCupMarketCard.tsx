'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BaseMarketCard } from '@/components/BaseMarketCard';
import { flagIconUrlForTeam } from '@/lib/flag-icons';
import { fmtCountdown, fmtUsdc } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import type { WorldCupMarketRow } from '@/lib/worldcup-markets';
import { WorldCupOutcomePanel } from './WorldCupOutcomePanel';

const nowInSeconds = () => BigInt(Math.floor(Date.now() / 1000));

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

function TeamBadge({ nameZh, shortCode, teamId }: WorldCupMarketRow['homeTeam']) {
  const flagUrl = teamId ? flagIconUrlForTeam(teamId) : null;

  return (
    <div className="flex items-center gap-2">
      {flagUrl ? (
        <span
          className="inline-block h-4 w-6 rounded-[4px] border border-black/5 bg-cover bg-center shadow-sm"
          style={{ backgroundImage: `url(${flagUrl})` }}
          aria-hidden="true"
        />
      ) : (
        <span className="inline-flex h-4 min-w-6 items-center justify-center rounded-[4px] bg-canvas px-1 text-[10px] font-semibold text-ink-2">
          {shortCode}
        </span>
      )}
      <div>
        <div className="font-mono text-sm text-ink">{shortCode}</div>
        <div className="text-[11px] text-ink-2">{nameZh}</div>
      </div>
    </div>
  );
}

export function WorldCupMarketCard({ row }: { row: WorldCupMarketRow }) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [now, setNow] = useState<bigint>(() => nowInSeconds());

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
  const countdownLabel =
    row.betDeadline > now ? `⚽ ${fmtCountdown(row.betDeadline, now)}` : '⚽ 已封盘';
  const detailHref = `/market/${row.id.toString()}?kind=event`;
  const titleLabel =
    row.marketType === 'winner'
      ? 'World Cup Winner'
      : `${row.homeTeam.nameZh} VS ${row.awayTeam?.nameZh ?? ''}`;

  return (
    <BaseMarketCard
      className="border-emerald-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(242,250,244,0.98)_100%)]"
      renderHeader={() => (
        <Link
          href={detailHref}
          className="block rounded-[12px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          <div className="mb-[18px] flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-[10px]">
              <span className="inline-flex h-8 items-center justify-center rounded-full bg-emerald-100 px-3 text-[11px] font-semibold uppercase text-emerald-800">
                {stageLabel}
              </span>
              <span className="font-mono text-xs text-ink-2">#{row.id.toString()}</span>
            </div>
            <span className="rounded-[12px] bg-emerald-50 px-[10px] py-1 text-[11px] font-semibold uppercase text-emerald-700">
              {kickoffLabel}
            </span>
          </div>

          <div className="mb-4 flex items-center justify-between gap-3">
            <TeamBadge {...row.homeTeam} />
            <div className="text-center">
              <div className="font-display text-[28px] leading-none text-emerald-700">VS</div>
              <div className="mt-1 text-[11px] uppercase text-ink-2">
                {row.marketType.toUpperCase()}
              </div>
            </div>
            {row.awayTeam ? <TeamBadge {...row.awayTeam} /> : <div className="w-[88px]" />}
          </div>

          <h3 className="mb-2 font-display text-[26px] leading-[1.18] text-ink">{titleLabel}</h3>
          <div className="mb-5 font-mono text-xs text-ink-2">{row.question}</div>
        </Link>
      )}
      renderOutcomes={() => (
        <WorldCupOutcomePanel
          marketType={row.marketType}
          outcomes={row.outcomes}
          isMobile={isMobile}
          homeTeamLabel={row.homeTeam.nameZh}
        />
      )}
      renderFooter={() => (
        <div className="mt-[18px] grid grid-cols-1 gap-3 border-t border-dashed border-hair pt-[14px] font-mono text-xs text-ink-2 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
          <div>
            <div className="mb-1 text-[11px] uppercase">流动性</div>
            <div className="font-medium text-ink">{liquidityLabel}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase">持仓</div>
            <div className="font-medium text-ink">{positionLabel}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] uppercase">倒计时</div>
            <div className="font-medium text-ink">{countdownLabel}</div>
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
    />
  );
}
