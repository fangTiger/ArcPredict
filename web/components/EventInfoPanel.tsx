'use client';

import { useEffect, useRef, useState } from 'react';
import { ADMIN_EVENT_ORACLE_ADDRESS } from '@/lib/addresses';
import { useLiveScore } from '@/lib/event-source';
import { flagIconUrlForTeam } from '@/lib/flag-icons';
import type { WorldCupMarketRow } from '@/lib/worldcup-markets';

const MATCH_DURATION_MS = 150 * 60 * 1000;

function formatKickoff(kickoffTime: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
    .format(new Date(kickoffTime))
    .replace(',', ' ')
    .replace(/\//gu, '-');
}

function TeamBadge({
  nameZh,
  shortCode,
  teamId,
}: WorldCupMarketRow['homeTeam']) {
  const flagUrl = teamId ? flagIconUrlForTeam(teamId) : null;

  return (
    <div className="rounded-[14px] border border-hair bg-canvas px-4 py-3">
      <div className="flex items-center gap-3">
        {flagUrl ? (
          <span
            className="inline-block h-6 w-9 rounded-[6px] border border-black/5 bg-cover bg-center shadow-sm"
            style={{ backgroundImage: `url(${flagUrl})` }}
            aria-hidden="true"
          />
        ) : (
          <span className="inline-flex h-6 min-w-9 items-center justify-center rounded-[6px] bg-paper px-2 text-[11px] font-semibold text-ink-2">
            {shortCode}
          </span>
        )}

        <div className="min-w-0">
          <div className="font-mono text-sm text-ink">{shortCode}</div>
          <div className="truncate text-xs text-ink-2">{nameZh}</div>
        </div>
      </div>
    </div>
  );
}

function statusMessage(
  row: WorldCupMarketRow,
  liveLabel: string | null,
): string {
  if (row.marketType === 'winner') {
    return '冠军盘无单场比分。';
  }

  return liveLabel ? `比赛状态：${liveLabel}` : '比分服务暂不可用，已回退到赛程信息。';
}

export function EventInfoPanel({ row }: { row: WorldCupMarketRow }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const kickoffMs = Date.parse(row.kickoffTime);
  const matchInProgress =
    row.matchId !== null &&
    Number.isFinite(kickoffMs) &&
    nowTs >= kickoffMs &&
    nowTs <= kickoffMs + MATCH_DURATION_MS;
  const liveScore = useLiveScore(row.matchId ?? '', {
    containerRef,
    matchInProgress,
  });
  const explorerHref = `https://testnet.arcscan.app/address/${ADMIN_EVENT_ORACLE_ADDRESS}`;

  return (
    <section
      ref={containerRef}
      className="rounded-[18px] border border-hair bg-paper p-5"
    >
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs uppercase text-emerald-700">
            Event Info
          </div>
          <h3 className="mt-2 text-lg font-semibold text-ink">{row.stageLabel}</h3>
          <p className="mt-1 text-sm text-ink-2">Kickoff · {formatKickoff(row.kickoffTime)} UTC</p>
        </div>

        <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="font-medium">Resolution Source: AdminEventOracle (Owner + 72h Dispute Window)</div>
          <a
            href={explorerHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 font-mono text-xs text-emerald-800 underline decoration-emerald-300 underline-offset-4"
          >
            {ADMIN_EVENT_ORACLE_ADDRESS}
          </a>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <TeamBadge {...row.homeTeam} />
        <div className="flex items-center justify-center rounded-[14px] border border-dashed border-hair px-4 py-3 font-display text-2xl text-emerald-700">
          VS
        </div>
        {row.awayTeam ? (
          <TeamBadge {...row.awayTeam} />
        ) : (
          <div className="rounded-[14px] border border-hair bg-canvas px-4 py-3 text-sm text-ink-2">
            该市场为多结果赛事盘，暂无单场对阵。
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[14px] border border-hair bg-canvas px-4 py-3">
          <div className="text-xs text-ink-2">实时比分</div>
          {matchInProgress &&
          liveScore.status === 'success' &&
          liveScore.score?.home !== null &&
          liveScore.score?.away !== null ? (
            <div className="mt-2 font-display text-2xl text-ink">
              {liveScore.score.home} - {liveScore.score.away}
            </div>
          ) : (
            <div className="mt-2 text-sm text-ink">
              {row.marketType === 'winner'
                ? '冠军盘不展示实时比分。'
                : matchInProgress
                  ? '正在同步比分…'
                  : '实时比分仅在比赛进行中显示。'}
            </div>
          )}
          <p className="mt-2 text-xs text-ink-2">
            {statusMessage(row, liveScore.score?.label ?? null)}
          </p>
        </div>

        <div className="rounded-[14px] border border-hair bg-canvas px-4 py-3">
          <div className="text-xs text-ink-2">市场说明</div>
          <p className="mt-2 text-sm leading-6 text-ink">{row.question}</p>
          <p className="mt-2 text-xs text-ink-2">
            实时比分只用于前端展示，不参与链上结算；最终结果仅以 AdminEventOracle 最终化结果为准。
          </p>
        </div>
      </div>
    </section>
  );
}
