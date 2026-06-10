import { formatUnits, parseUnits } from 'viem';

import { USDC_DECIMALS } from './chain';

const groupThousands = (digits: string) =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const incrementDigits = (digits: string) => {
  let carry = 1;
  let next = '';

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    const sum = Number(digits[index]) + carry;
    next = `${sum % 10}${next}`;
    carry = Math.floor(sum / 10);
  }

  return carry > 0 ? `${carry}${next}` : next;
};

const roundDecimalParts = (intPart: string, fracPart: string, max: number) => {
  if (max <= 0) {
    return {
      intPart: fracPart[0] >= '5' ? incrementDigits(intPart) : intPart,
      fracPart: '',
    };
  }

  if (fracPart.length <= max) {
    return {
      intPart,
      fracPart: fracPart.replace(/0+$/, ''),
    };
  }

  const keptFraction = fracPart.slice(0, max);

  if (fracPart[max] < '5') {
    return {
      intPart,
      fracPart: keptFraction.replace(/0+$/, ''),
    };
  }

  const roundedDigits = incrementDigits(`${intPart}${keptFraction}`).padStart(
    intPart.length + max,
    '0',
  );
  const splitIndex = roundedDigits.length - max;

  return {
    intPart: roundedDigits.slice(0, splitIndex),
    fracPart: roundedDigits.slice(splitIndex).replace(/0+$/, ''),
  };
};

export const fmtUsdc = (raw: bigint, max = 2) => {
  const maximumFractionDigits = Math.floor(max);

  if (
    !Number.isFinite(maximumFractionDigits) ||
    maximumFractionDigits < 0 ||
    maximumFractionDigits > 100
  ) {
    throw new RangeError('maximumFractionDigits value is out of range.');
  }

  const formatted = formatUnits(raw, USDC_DECIMALS);
  const negative = formatted.startsWith('-');
  const unsigned = negative ? formatted.slice(1) : formatted;
  const [intPart, fracPart = ''] = unsigned.split('.');
  const rounded = roundDecimalParts(intPart, fracPart, maximumFractionDigits);
  const suffix = rounded.fracPart ? `.${rounded.fracPart}` : '';

  return `${negative ? '-' : ''}${groupThousands(rounded.intPart)}${suffix}`;
};

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
