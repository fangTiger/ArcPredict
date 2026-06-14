'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BaseMarketCard } from '@/components/BaseMarketCard';
import { PYTH_PRICE_ID_TO_ASSET } from '@/lib/asset-price-map';
import { parseCadenceTag } from '@/lib/cadence-tag';
import type { DashboardRow } from '@/lib/derivePosition';
import { OUTCOMES, yesPercent } from '@/lib/derivePosition';
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

function deriveAssetLabel(row: DashboardRow): string {
  const mapped = PYTH_PRICE_ID_TO_ASSET[row.market.pythPriceId.toLowerCase()];

  if (mapped) {
    return mapped;
  }

  const questionPrefix = row.market.question.match(/^([A-Z]+)\/USD/u)?.[1];
  return questionPrefix ?? 'ARC';
}

export function CryptoMarketCard({
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
  const detailHref = `/market/${row.id.toString()}`;

  return (
    <BaseMarketCard
      renderHeader={() => (
        <>
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
                  isClosingSoon ? 'bg-heat/10 text-heat' : 'bg-arc/15 text-arc-glow'
                }`}
              >
                {cadenceLabel}
              </span>
            </div>

            <h3 className="mb-2 font-display text-[26px] leading-[1.18] text-ink">
              {asset}/USD <span className="mx-1 text-arc-glow">≥</span>{' '}
              <span className="num-glow whitespace-nowrap text-arc-glow">
                {formatThresholdValue(m.threshold, m.thresholdExpo)}
              </span>{' '}
              by {formatShortDate(m.resolveAfter)}
            </h3>

            <div className="mb-5 font-mono text-xs text-ink-2">
              Resolves {formatUtcTimestamp(m.resolveAfter)}
            </div>
          </Link>
        </>
      )}
      renderOutcomes={() => (
        <>
          <div className="mb-4">
            <div className="mb-2 flex items-end justify-between gap-4">
              <div className="flex items-end gap-1.5 text-yes">
                <span className="num-glow font-display text-[28px] leading-none">{yesPct.toFixed(0)}</span>
                <span>%</span>
                <span className="pb-0.5 text-xs uppercase">YES</span>
              </div>
              <div className="flex items-end gap-1.5 text-no">
                <span className="pb-0.5 text-xs uppercase">NO</span>
                <span className="num-glow font-display text-[28px] leading-none">{noPct.toFixed(0)}</span>
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
            <div className="flex items-center justify-between rounded-[12px] px-3 py-2">
              <span>YES pool</span>
              <span className="text-ink">{fmtUsdc(m.yesPool)} USDC</span>
            </div>
            <div className="flex items-center justify-between rounded-[12px] px-3 py-2">
              <span>NO pool</span>
              <span className="text-ink">{fmtUsdc(m.noPool)} USDC</span>
            </div>
          </div>

          {(() => {
            const pct = yesPct;
            const yesFlex = Math.max(20, Math.min(80, pct));
            const noFlex = 100 - yesFlex;
            return (
              <div className="mt-4 flex w-full gap-2">
                <button
                  type="button"
                  onClick={() => onBet(row.id, true)}
                  disabled={!bettingOpen}
                  style={{ flex: yesFlex }}
                  className="rounded-2xl border border-yes/40 bg-yes/15 px-3 py-2.5 text-sm font-semibold text-yes transition hover:bg-yes/25 hover:shadow-[inset_0_0_24px_rgba(52,211,153,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  YES · {pct.toFixed(0)}%
                </button>
                <button
                  type="button"
                  onClick={() => onBet(row.id, false)}
                  disabled={!bettingOpen}
                  style={{ flex: noFlex }}
                  className="rounded-2xl border border-no/40 bg-no/15 px-3 py-2.5 text-sm font-semibold text-no transition hover:bg-no/25 hover:shadow-[inset_0_0_24px_rgba(248,113,113,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arc-glow/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-0 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  NO · {(100 - pct).toFixed(0)}%
                </button>
              </div>
            );
          })()}
        </>
      )}
      renderFooter={() => (
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
      )}
    />
  );
}
