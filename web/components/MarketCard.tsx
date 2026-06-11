'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { parseCadenceTag } from '@/lib/cadence-tag';
import type { DashboardRow } from '@/lib/derivePosition';
import { OUTCOMES, yesPercent } from '@/lib/derivePosition';
import { PYTH_PRICE_ID_TO_ASSET } from '@/lib/asset-price-map';
import { fmtCountdown, fmtUsdc } from '@/lib/format';

const nowInSeconds = () => BigInt(Math.floor(Date.now() / 1000));

const cadenceLabelMap = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  unknown: 'Live',
} as const;

const cadenceClosingLabelMap = {
  daily: 'Daily · closing',
  weekly: 'Weekly · closing',
  monthly: 'Monthly · closing',
  quarterly: 'Quarterly · closing',
  unknown: 'Live · closing',
} as const;

const assetAccentClassName: Record<string, string> = {
  BTC: 'bg-[#F7931A]',
  ETH: 'bg-[#627EEA]',
  SOL: 'bg-[linear-gradient(135deg,#9945FF_0%,#14F195_100%)]',
};

function groupThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
}

function formatThresholdValue(raw: bigint, expo: number): string {
  const negative = raw < 0n;
  const digitsSource = negative ? (-raw).toString() : raw.toString();

  if (expo >= 0) {
    const intPart = `${digitsSource}${'0'.repeat(expo)}`;
    return `${negative ? '-' : ''}$${groupThousands(intPart)}`;
  }

  const decimals = Math.abs(expo);
  const padded = digitsSource.padStart(decimals + 1, '0');
  const splitIndex = padded.length - decimals;
  const intPart = padded.slice(0, splitIndex);
  const fracPart = padded.slice(splitIndex).replace(/0+$/u, '').slice(0, 2);

  return `${negative ? '-' : ''}$${groupThousands(intPart)}${fracPart ? `.${fracPart}` : ''}`;
}

function formatShortDate(timestamp: bigint): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Number(timestamp) * 1000));
}

function formatUtcTimestamp(timestamp: bigint): string {
  return `${new Date(Number(timestamp) * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function formatOddsMultiple(sidePool: bigint, totalPool: bigint): string {
  if (sidePool === 0n) {
    return '∞';
  }

  const scaled = Number((totalPool * 100n) / sidePool) / 100;
  return `×${scaled.toFixed(2)}`;
}

function deriveAssetLabel(row: DashboardRow): string {
  const mapped = PYTH_PRICE_ID_TO_ASSET[row.market.pythPriceId.toLowerCase()];

  if (mapped) {
    return mapped;
  }

  const questionPrefix = row.market.question.match(/^([A-Z]+)\/USD/u)?.[1];
  return questionPrefix ?? 'ARC';
}

export function MarketCard({
  row,
  onBet,
}: {
  row: DashboardRow;
  onBet: (id: bigint, yes: boolean) => void;
}) {
  const [now, setNow] = useState<bigint>(() => nowInSeconds());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(nowInSeconds());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const m = row.market;
  const yesPct = yesPercent(m);
  const noPct = 100 - yesPct;
  const totalPool = m.yesPool + m.noPool;
  const outcome = OUTCOMES[m.outcome];
  const isUnresolved = outcome === 'Unresolved';
  const bettingOpen = isUnresolved && now < m.betDeadline;
  const asset = deriveAssetLabel(row);
  const cadence = parseCadenceTag(m.question);
  const isClosingSoon = isUnresolved && bettingOpen && m.betDeadline - now < 24n * 60n * 60n;
  const cadenceLabel = isClosingSoon ? cadenceClosingLabelMap[cadence] : cadenceLabelMap[cadence];
  const countdownLabel = isUnresolved
    ? bettingOpen
      ? `Closes in ${fmtCountdown(m.betDeadline, now)}`
      : 'Betting closed'
    : `Settled ${outcome}`;
  const yesMultiple = formatOddsMultiple(m.yesPool, totalPool);
  const noMultiple = formatOddsMultiple(m.noPool, totalPool);
  const detailHref = `/market/${row.id.toString()}`;

  return (
    <article className="group relative overflow-hidden rounded-[16px] border border-hair bg-paper p-6 shadow-[0_1px_0_rgba(10,11,15,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-arc/25 hover:shadow-[0_12px_32px_rgba(10,11,15,0.08)]">
      <svg
        className="pointer-events-none absolute right-0 top-0 h-[120px] w-[120px] opacity-60"
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="120" cy="0" r="110" stroke="#1652F0" strokeOpacity="0.06" strokeWidth="1" />
        <circle cx="120" cy="0" r="80" stroke="#1652F0" strokeOpacity="0.05" strokeWidth="1" />
        <circle cx="120" cy="0" r="50" stroke="#1652F0" strokeOpacity="0.04" strokeWidth="1" />
      </svg>

      <div className="relative z-10">
        <Link
          href={detailHref}
          className="block rounded-[12px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-arc/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          <div className="mb-[18px] flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-[10px]">
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-mono text-[11px] font-semibold text-paper ${assetAccentClassName[asset] ?? 'bg-ink'}`}
              >
                {asset}
              </span>
              <span className="font-mono text-xs text-ink-2">#{row.id.toString()}</span>
            </div>

            <span
              className={`rounded-[12px] px-[10px] py-1 text-[11px] font-semibold uppercase ${
                isClosingSoon ? 'bg-heat/10 text-heat' : 'bg-arc-tint text-arc-deep'
              }`}
            >
              {cadenceLabel}
            </span>
          </div>

          <h3 className="mb-2 font-display text-[26px] leading-[1.18] text-ink">
            {asset}/USD <span className="mx-1 text-arc">≥</span>{' '}
            <span className="whitespace-nowrap text-arc">
              {formatThresholdValue(m.threshold, m.thresholdExpo)}
            </span>{' '}
            by {formatShortDate(m.resolveAfter)}
          </h3>

          <div className="mb-5 font-mono text-xs text-ink-2">
            Resolves {formatUtcTimestamp(m.resolveAfter)}
          </div>

          <div className="mb-4">
            <div className="mb-2 flex items-end justify-between gap-4">
              <div className="flex items-end gap-1.5 text-yes">
                <span className="font-display text-[28px] leading-none">{yesPct.toFixed(0)}</span>
                <span>%</span>
                <span className="pb-0.5 text-xs uppercase">YES</span>
              </div>
              <div className="flex items-end gap-1.5 text-no">
                <span className="pb-0.5 text-xs uppercase">NO</span>
                <span className="font-display text-[28px] leading-none">{noPct.toFixed(0)}</span>
                <span>%</span>
              </div>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-no/15">
              <div
                className="h-full rounded-full bg-yes transition-[width]"
                style={{ width: `${yesPct}%` }}
              />
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 font-mono text-xs text-ink-2">
            <div className="flex items-center justify-between rounded-[12px] bg-canvas px-3 py-2">
              <span>YES pool</span>
              <span className="text-ink">{fmtUsdc(m.yesPool)} USDC</span>
            </div>
            <div className="flex items-center justify-between rounded-[12px] bg-canvas px-3 py-2">
              <span>NO pool</span>
              <span className="text-ink">{fmtUsdc(m.noPool)} USDC</span>
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onBet(row.id, true)}
            disabled={!bettingOpen}
            className="inline-flex items-center justify-between gap-3 rounded-full border border-yes/30 bg-paper px-[18px] py-3.5 text-sm font-semibold text-yes transition duration-150 hover:-translate-y-px hover:border-yes hover:bg-yes hover:text-paper disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:bg-paper disabled:hover:text-yes"
          >
            <span>Bet YES</span>
            <span className="font-mono text-[11px] opacity-75">{yesMultiple}</span>
          </button>
          <button
            type="button"
            onClick={() => onBet(row.id, false)}
            disabled={!bettingOpen}
            className="inline-flex items-center justify-between gap-3 rounded-full border border-no/30 bg-paper px-[18px] py-3.5 text-sm font-semibold text-no transition duration-150 hover:-translate-y-px hover:border-no hover:bg-no hover:text-paper disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:bg-paper disabled:hover:text-no"
          >
            <span>Bet NO</span>
            <span className="font-mono text-[11px] opacity-75">{noMultiple}</span>
          </button>
        </div>

        <div className="mt-[18px] flex items-center justify-between gap-4 border-t border-dashed border-hair pt-[14px] font-mono text-xs text-ink-2">
          <span className={`font-medium ${isClosingSoon ? 'text-heat' : 'text-ink'}`}>
            {countdownLabel}
          </span>
          <Link
            href={detailHref}
            className="font-sans text-[11px] text-ink-2 transition hover:text-ink"
          >
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}
