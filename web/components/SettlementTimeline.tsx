import React from 'react';

type EventOracleStatus = 'pending' | 'proposed' | 'challenged' | 'finalized';

export type SettlementEvidenceItem = {
  label: string;
  value: string;
  href?: string;
};

type PriceTimelineProps = {
  kind: 'price';
  resolveAfter: number;
  outcome: number;
  pendingPayout: bigint;
  claimed: boolean;
  nowSeconds?: number;
  sourceHref?: string;
  evidence?: readonly SettlementEvidenceItem[];
};

type EventTimelineProps = {
  kind: 'event';
  resolveAfter: number;
  settledOutcome: number;
  oracleStatus: EventOracleStatus;
  proposedAt?: number;
  pendingPayout: bigint;
  claimed: boolean;
  nowSeconds?: number;
  sourceHref?: string;
  evidence?: readonly SettlementEvidenceItem[];
};

type SettlementTimelineProps = PriceTimelineProps | EventTimelineProps;

type TimelineStep = {
  label: string;
  detail: string;
  state: 'complete' | 'current' | 'pending';
};

const EVENT_UNRESOLVED_OUTCOME = 255;
const PRICE_INVALID_OUTCOME = 3;
const CHALLENGE_WINDOW_SECONDS = 72 * 3_600;

function stateClassName(state: TimelineStep['state']): string {
  if (state === 'complete') {
    return 'border-arc-glow/40 bg-arc/10 text-ink';
  }

  if (state === 'current') {
    return 'border-heat/35 bg-heat/10 text-ink';
  }

  return 'border-hair text-ink-2';
}

function renderClaimStep(pendingPayout: bigint, claimed: boolean): TimelineStep {
  if (claimed) {
    return {
      label: 'Claimable',
      detail: 'Position already claimed.',
      state: 'complete',
    };
  }

  if (pendingPayout > 0n) {
    return {
      label: 'Claimable',
      detail: 'Winning shares can be claimed now.',
      state: 'current',
    };
  }

  return {
    label: 'Claimable',
    detail: 'Claim unlocks after settlement and winning balance confirmation.',
    state: 'pending',
  };
}

function formatChallengeDetail(
  oracleStatus: EventOracleStatus,
  proposedAt: number | undefined,
  nowSeconds: number,
): TimelineStep {
  if (oracleStatus === 'challenged') {
    return {
      label: 'Challenge Window',
      detail: 'A challenge is active and awaiting final oracle resolution.',
      state: 'current',
    };
  }

  if (oracleStatus !== 'proposed') {
    return {
      label: 'Challenge Window',
      detail: 'The 72h challenge window starts after a result proposal.',
      state: oracleStatus === 'finalized' ? 'complete' : 'pending',
    };
  }

  const challengeEndsAt = (proposedAt ?? nowSeconds) + CHALLENGE_WINDOW_SECONDS;
  const remainingSeconds = Math.max(0, challengeEndsAt - nowSeconds);
  const remainingHours = Math.max(1, Math.ceil(remainingSeconds / 3_600));

  return {
    label: 'Challenge Window',
    detail:
      remainingSeconds > 0
        ? `${remainingHours}h left in the challenge window.`
        : 'Challenge window ended; awaiting finalization.',
    state: 'current',
  };
}

function buildPriceSteps(props: PriceTimelineProps): TimelineStep[] {
  const nowSeconds = props.nowSeconds ?? Math.floor(Date.now() / 1000);
  const resolved = props.outcome !== 0;
  const invalid = props.outcome === PRICE_INVALID_OUTCOME;

  return [
    {
      label: 'Pyth',
      detail: 'Resolution uses the final Pyth price snapshot.',
      state: nowSeconds >= props.resolveAfter ? 'complete' : 'current',
    },
    {
      label: 'Resolved',
      detail: invalid
        ? 'This market resolved as invalid instead of YES or NO.'
        : 'A valid YES/NO outcome is recorded on-chain after the resolve window.',
      state:
        resolved && !invalid
          ? 'complete'
          : !resolved && nowSeconds >= props.resolveAfter
            ? 'current'
            : 'pending',
    },
    {
      label: 'Invalid',
      detail: 'Invalid is used only when the price source cannot produce a valid settlement.',
      state: invalid ? 'complete' : 'pending',
    },
    renderClaimStep(props.pendingPayout, props.claimed),
  ];
}

function buildEventSteps(props: EventTimelineProps): TimelineStep[] {
  const nowSeconds = props.nowSeconds ?? Math.floor(Date.now() / 1000);
  const finalized =
    props.oracleStatus === 'finalized' || props.settledOutcome !== EVENT_UNRESOLVED_OUTCOME;

  return [
    {
      label: 'AdminEventOracle',
      detail: 'Owner proposal plus a 72h dispute window determines the final event result.',
      state: props.oracleStatus === 'pending' ? 'current' : 'complete',
    },
    formatChallengeDetail(props.oracleStatus, props.proposedAt, nowSeconds),
    {
      label: 'Finalized',
      detail: finalized
        ? 'The oracle result is finalized and can be consumed by the market contract.'
        : nowSeconds >= props.resolveAfter
          ? 'Awaiting finalization after the challenge window closes.'
          : 'Finalization starts after the event reaches its resolve window.',
      state:
        finalized
          ? 'complete'
          : nowSeconds >= props.resolveAfter
            ? 'current'
            : 'pending',
    },
    renderClaimStep(props.pendingPayout, props.claimed),
  ];
}

function renderStep(step: TimelineStep) {
  return React.createElement(
    'div',
    {
      key: step.label,
      className: `rounded-2xl border px-4 py-3 ${stateClassName(step.state)}`,
    },
    React.createElement(
      'div',
      { className: 'flex items-center justify-between gap-3' },
      React.createElement('div', { className: 'font-mono text-sm' }, step.label),
      React.createElement(
        'div',
        { className: 'text-[11px] uppercase tracking-[0.18em]' },
        step.state,
      ),
    ),
    React.createElement('p', { className: 'mt-2 text-sm leading-6' }, step.detail),
  );
}

function renderEvidenceItem(item: SettlementEvidenceItem) {
  const valueNode = item.href
    ? React.createElement(
        'a',
        {
          href: item.href,
          target: '_blank',
          rel: 'noreferrer',
          className: 'break-all text-sm text-arc-glow transition hover:text-ink',
        },
        item.value,
      )
    : React.createElement('div', { className: 'break-all text-sm text-ink' }, item.value);

  return React.createElement(
    'div',
    {
      key: `${item.label}:${item.value}`,
      className: 'rounded-2xl border border-hair px-4 py-3',
    },
    React.createElement(
      'div',
      { className: 'text-[11px] uppercase tracking-[0.18em] text-ink-2' },
      item.label,
    ),
    React.createElement('div', { className: 'mt-2' }, valueNode),
  );
}

export function SettlementTimeline(props: SettlementTimelineProps) {
  const steps = props.kind === 'event' ? buildEventSteps(props) : buildPriceSteps(props);
  const sourceLabel =
    props.kind === 'event'
      ? 'Resolution Source: AdminEventOracle'
      : 'Resolution Source: Pyth';

  return React.createElement(
    'section',
    { className: 'glass rounded-3xl p-6' },
    React.createElement(
      'div',
      { className: 'mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between' },
      React.createElement(
        'div',
        null,
        React.createElement(
          'div',
          { className: 'text-xs uppercase text-arc-glow' },
          'Settlement timeline',
        ),
        React.createElement(
          'h3',
          { className: 'mt-2 text-lg font-semibold text-ink' },
          sourceLabel,
        ),
      ),
      props.sourceHref
        ? React.createElement(
            'a',
            {
              href: props.sourceHref,
              target: '_blank',
              rel: 'noreferrer',
              className: 'text-sm text-arc-glow transition hover:text-ink',
            },
            'View source on explorer',
          )
        : null,
    ),
    props.evidence?.length
      ? React.createElement(
          'div',
          { className: 'mb-4 rounded-2xl border border-hair/70 bg-bg-0/40 p-4' },
          React.createElement(
            'div',
            { className: 'text-xs uppercase text-arc-glow' },
            'Evidence',
          ),
          React.createElement(
            'div',
            { className: 'mt-3 grid gap-3' },
            props.evidence.map(renderEvidenceItem),
          ),
        )
      : null,
    React.createElement('div', { className: 'space-y-3' }, steps.map(renderStep)),
  );
}
