export type Outcome = 'Unresolved' | 'Yes' | 'No' | 'Invalid';

export type Market = {
  pythPriceId: `0x${string}`;
  threshold: bigint;
  thresholdExpo: number;
  betDeadline: bigint;
  resolveAfter: bigint;
  yesPool: bigint;
  noPool: bigint;
  winnerPool: bigint;
  protocolFee: bigint;
  feeBpsSnapshot: number;
  feeRecipientSnapshot: `0x${string}`;
  outcome: number;
  settlePrice: bigint;
  settleTime: bigint;
  question: string;
};

export type DashboardRow = {
  id: bigint;
  market: Market;
  yesStake: bigint;
  noStake: bigint;
  claimed_: boolean;
  pendingPayout: bigint;
};

export const OUTCOMES: Outcome[] = ['Unresolved', 'Yes', 'No', 'Invalid'];

export type Status =
  | 'active'
  | 'resolving'
  | 'awaiting'
  | 'resolved'
  | 'force-invalidatable';

export function deriveStatus(row: DashboardRow, now: bigint): Status {
  const { market } = row;

  if (market.outcome !== 0) {
    return 'resolved';
  }

  if (now < market.resolveAfter) {
    return 'active';
  }

  if (now < market.resolveAfter + 300n) {
    return 'resolving';
  }

  if (now < market.resolveAfter + 7n * 24n * 3600n) {
    return 'awaiting';
  }

  return 'force-invalidatable';
}

export type UserPosition = 'none' | 'yes' | 'no' | 'both';

export function userPositionOf(row: DashboardRow): UserPosition {
  if (row.yesStake > 0n && row.noStake > 0n) {
    return 'both';
  }

  if (row.yesStake > 0n) {
    return 'yes';
  }

  if (row.noStake > 0n) {
    return 'no';
  }

  return 'none';
}

export function userIsWinner(row: DashboardRow): boolean {
  const outcome = OUTCOMES[row.market.outcome];

  if (outcome === 'Invalid') {
    return row.yesStake > 0n || row.noStake > 0n;
  }

  if (outcome === 'Yes') {
    return row.yesStake > 0n;
  }

  if (outcome === 'No') {
    return row.noStake > 0n;
  }

  return false;
}

export function yesPercent(market: Market): number {
  const total = market.yesPool + market.noPool;

  if (total === 0n) {
    return 50;
  }

  return Number((market.yesPool * 10000n) / total) / 100;
}
