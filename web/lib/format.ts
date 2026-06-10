import { formatUnits, parseUnits } from 'viem';

import { USDC_DECIMALS } from './chain';

export const fmtUsdc = (raw: bigint, max = 2) =>
  Number(formatUnits(raw, USDC_DECIMALS)).toLocaleString('en-US', {
    maximumFractionDigits: max,
  });

export const parseUsdc = (s: string) => parseUnits(s, USDC_DECIMALS);

export const truncateAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export const fmtCountdown = (target: bigint, now: bigint) => {
  const diff = Number(target - now);

  if (diff <= 0) {
    return 'Closed';
  }

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};
