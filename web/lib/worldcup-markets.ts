import {
  findWorldCupTeam,
  MATCH_BY_ID,
  WORLDCUP_MATCHES,
  WORLDCUP_TEAMS,
  worldCupParticipantCode,
  worldCupParticipantLabel,
  type WorldCupMatch,
  type WorldCupParticipant,
  type WorldCupTeam,
} from './worldcup-seed';
import {
  worldCupStageLabel,
  type WorldCupStage,
} from './market-kind';

export type WorldCupMarketType = '1x2' | 'spread' | 'winner';

export type WorldCupDisplayTeam = {
  teamId?: WorldCupTeam['id'];
  shortCode: string;
  nameZh: string;
  nameEn: string;
};

export type WorldCupMarketOutcome = {
  id: string;
  label: string;
  openingProbability: number;
  impliedProbability: number;
  odds: number;
  teamId?: WorldCupTeam['id'];
};

export type WorldCupMarketRow = {
  id: bigint;
  marketKind: 'event';
  category: 'worldcup';
  matchId: string | null;
  stage: WorldCupStage;
  stageLabel: string;
  marketType: WorldCupMarketType;
  question: string;
  kickoffTime: string;
  betDeadline: bigint;
  eventId: `0x${string}`;
  outcomePools: bigint[];
  userOutcomeStakes: bigint[];
  claimed_: boolean;
  pendingPayout: bigint;
  settledOutcome: number;
  homeTeam: WorldCupDisplayTeam;
  awayTeam: WorldCupDisplayTeam | null;
  outcomes: WorldCupMarketOutcome[];
  liquidity: bigint;
  positionLabel: string;
};

export type EventMarketDashboardRow = {
  id: bigint;
  market: {
    eventId: `0x${string}`;
    outcomeCount: number;
    betDeadline: bigint;
    resolveAfter: bigint;
    outcomePools: bigint[];
    winnerPool: bigint;
    protocolFee: bigint;
    feeBpsSnapshot: number;
    feeRecipientSnapshot: `0x${string}`;
    settledOutcome: number;
    settleTime: bigint;
    question: string;
  };
  userOutcomeStakes: bigint[];
  claimed_: boolean;
  pendingPayout: bigint;
};

export const EVENT_UNRESOLVED_OUTCOME = 255;
export const EVENT_INVALID_OUTCOME = 254;

const toUnixSeconds = (iso: string) => BigInt(Math.floor(Date.parse(iso) / 1000));

const MATCH_DURATION_SECONDS = 150n * 60n;
const MATCH_ID_PATTERN = /\b(group-[a-h]-[1-6]|r16-[1-8]|qf-[1-4]|sf-[1-2]|final-[12])\b/iu;
const WINNER_MARKET_PATTERN = /winner|champion|冠军/iu;
const SEEDED_MATCH_ID_BY_EVENT_HASH: Record<string, string> = {
  // SeedWorldCupMarkets._eventId("1x2", "final-1")
  '0x2b902d6a9c3a763f380d5c1af8475ea4efa1142488ebc730dc7c1c8851b061b1': 'final-1',
};

const findTeam = (participant: WorldCupParticipant): WorldCupDisplayTeam => {
  const team = findWorldCupTeam(participant);

  if (!team) {
    return {
      shortCode: worldCupParticipantCode(participant),
      nameZh: worldCupParticipantLabel(participant),
      nameEn: worldCupParticipantCode(participant),
    };
  }

  return {
    teamId: team.id,
    shortCode: team.id,
    nameZh: team.shortNameZh,
    nameEn: team.nameEn,
  };
};

const GENERIC_HOME_TEAM: WorldCupDisplayTeam = {
  shortCode: 'HOME',
  nameZh: '主队',
  nameEn: 'Home',
};

const GENERIC_AWAY_TEAM: WorldCupDisplayTeam = {
  shortCode: 'AWAY',
  nameZh: '客队',
  nameEn: 'Away',
};

const GENERIC_WINNER_TEAM: WorldCupDisplayTeam = {
  shortCode: 'WC',
  nameZh: '冠军盘',
  nameEn: 'World Cup',
};

const winnerFavorites = [
  { teamId: 'BRA', probability: 14.2 },
  { teamId: 'ARG', probability: 12.8 },
  { teamId: 'FRA', probability: 11.6 },
  { teamId: 'ENG', probability: 9.1 },
  { teamId: 'ESP', probability: 7.8 },
  { teamId: 'GER', probability: 6.6 },
  { teamId: 'POR', probability: 5.9 },
  { teamId: 'CMR', probability: 4.4 },
  { teamId: 'NED', probability: 3.9 },
  { teamId: 'CRO', probability: 3.1 },
  { teamId: 'BEL', probability: 2.8 },
  { teamId: 'URU', probability: 2.4 },
  { teamId: 'USA', probability: 2.2 },
  { teamId: 'MEX', probability: 1.9 },
  { teamId: 'DEN', probability: 1.8 },
  { teamId: 'SEN', probability: 1.7 },
  { teamId: 'SUI', probability: 1.6 },
  { teamId: 'MAR', probability: 1.5 },
  { teamId: 'POL', probability: 1.3 },
  { teamId: 'JPN', probability: 1.2 },
  { teamId: 'KOR', probability: 1.1 },
  { teamId: 'CAN', probability: 1.0 },
  { teamId: 'SRB', probability: 0.9 },
  { teamId: 'ECU', probability: 0.8 },
  { teamId: 'IRN', probability: 0.7 },
  { teamId: 'WAL', probability: 0.7 },
  { teamId: 'AUS', probability: 0.6 },
  { teamId: 'TUN', probability: 0.5 },
  { teamId: 'GHA', probability: 0.5 },
  { teamId: 'CRC', probability: 0.4 },
  { teamId: 'KSA', probability: 0.3 },
  { teamId: 'QAT', probability: 0.2 },
] as const;

const createOutcome = (
  id: string,
  label: string,
  impliedProbability: number,
  teamId?: WorldCupTeam['id'],
  openingProbability = impliedProbability,
): WorldCupMarketOutcome => ({
  id,
  label,
  openingProbability,
  impliedProbability,
  odds: impliedProbability <= 0 ? Number.POSITIVE_INFINITY : Number((100 / impliedProbability).toFixed(2)),
  teamId,
});

function poolsFromOutcomes(
  liquidity: bigint,
  outcomes: readonly WorldCupMarketOutcome[],
): bigint[] {
  const scaledTotal = outcomes.reduce(
    (total, outcome) => total + BigInt(Math.round(outcome.impliedProbability * 100)),
    0n,
  );

  if (scaledTotal === 0n || liquidity === 0n) {
    return outcomes.map(() => 0n);
  }

  let allocated = 0n;

  return outcomes.map((outcome, index) => {
    if (index === outcomes.length - 1) {
      return liquidity - allocated;
    }

    const scaledProbability = BigInt(Math.round(outcome.impliedProbability * 100));
    const nextValue = (liquidity * scaledProbability) / scaledTotal;
    allocated += nextValue;
    return nextValue;
  });
}

const skeletonRows: WorldCupMarketRow[] = [
  {
    id: 9001n,
    marketKind: 'event',
    category: 'worldcup',
    matchId: 'group-c-4',
    stage: 'group',
    stageLabel: 'Group A',
    marketType: '1x2',
    question: 'Argentina vs Mexico 1X2',
    kickoffTime: '2026-06-18T19:00:00Z',
    betDeadline: toUnixSeconds('2026-06-18T18:30:00Z'),
    eventId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    outcomePools: [],
    userOutcomeStakes: [0n, 0n, 0n],
    claimed_: false,
    pendingPayout: 0n,
    settledOutcome: EVENT_UNRESOLVED_OUTCOME,
    homeTeam: findTeam('ARG'),
    awayTeam: findTeam('MEX'),
    outcomes: [
      createOutcome('arg-win', 'Home Win', 48.5, 'ARG'),
      createOutcome('draw', 'Draw', 27.5),
      createOutcome('mex-win', 'Away Win', 24.0, 'MEX'),
    ],
    liquidity: 182_000_000n,
    positionLabel: 'No position',
  },
  {
    id: 9002n,
    marketKind: 'event',
    category: 'worldcup',
    matchId: 'group-b-6',
    stage: 'group',
    stageLabel: 'Group B',
    marketType: 'spread',
    question: 'England -1.5 vs Wales',
    kickoffTime: '2026-06-19T15:00:00Z',
    betDeadline: toUnixSeconds('2026-06-19T14:45:00Z'),
    eventId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    outcomePools: [],
    userOutcomeStakes: [0n, 0n],
    claimed_: false,
    pendingPayout: 0n,
    settledOutcome: EVENT_UNRESOLVED_OUTCOME,
    homeTeam: findTeam('ENG'),
    awayTeam: findTeam('WAL'),
    outcomes: [
      createOutcome('eng-cover', 'England -1.5', 57.2, 'ENG'),
      createOutcome('wal-cover', 'Wales +1.5', 42.8, 'WAL'),
    ],
    liquidity: 126_500_000n,
    positionLabel: 'No position',
  },
  {
    id: 9003n,
    marketKind: 'event',
    category: 'worldcup',
    matchId: 'r16-1',
    stage: 'r16',
    stageLabel: 'R16',
    marketType: '1x2',
    question: 'Netherlands vs United States 1X2',
    kickoffTime: '2026-06-24T19:00:00Z',
    betDeadline: toUnixSeconds('2026-06-24T18:45:00Z'),
    eventId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    outcomePools: [],
    userOutcomeStakes: [0n, 0n, 0n],
    claimed_: false,
    pendingPayout: 0n,
    settledOutcome: EVENT_UNRESOLVED_OUTCOME,
    homeTeam: findTeam('NED'),
    awayTeam: findTeam('USA'),
    outcomes: [
      createOutcome('ned-win', 'Home Win', 45.0, 'NED'),
      createOutcome('r16-draw', 'Draw', 30.0),
      createOutcome('usa-win', 'Away Win', 25.0, 'USA'),
    ],
    liquidity: 143_200_000n,
    positionLabel: 'No position',
  },
  {
    id: 9004n,
    marketKind: 'event',
    category: 'worldcup',
    matchId: 'qf-1',
    stage: 'qf',
    stageLabel: 'QF',
    marketType: '1x2',
    question: 'Brazil vs Croatia 1X2',
    kickoffTime: '2026-06-28T15:00:00Z',
    betDeadline: toUnixSeconds('2026-06-28T14:40:00Z'),
    eventId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    outcomePools: [],
    userOutcomeStakes: [0n, 0n, 0n],
    claimed_: false,
    pendingPayout: 0n,
    settledOutcome: EVENT_UNRESOLVED_OUTCOME,
    homeTeam: findTeam('BRA'),
    awayTeam: findTeam('CRO'),
    outcomes: [
      createOutcome('bra-win', 'Home Win', 52.0, 'BRA'),
      createOutcome('qf-draw', 'Draw', 24.0),
      createOutcome('cro-win', 'Away Win', 24.0, 'CRO'),
    ],
    liquidity: 210_000_000n,
    positionLabel: 'No position',
  },
  {
    id: 9005n,
    marketKind: 'event',
    category: 'worldcup',
    matchId: 'sf-1',
    stage: 'sf',
    stageLabel: 'SF',
    marketType: 'spread',
    question: 'France -0.5 vs England',
    kickoffTime: '2026-07-02T19:00:00Z',
    betDeadline: toUnixSeconds('2026-07-02T18:45:00Z'),
    eventId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    outcomePools: [],
    userOutcomeStakes: [0n, 0n],
    claimed_: false,
    pendingPayout: 0n,
    settledOutcome: EVENT_UNRESOLVED_OUTCOME,
    homeTeam: findTeam('FRA'),
    awayTeam: findTeam('ENG'),
    outcomes: [
      createOutcome('fra-cover', 'France -0.5', 54.0, 'FRA'),
      createOutcome('eng-cover', 'England +0.5', 46.0, 'ENG'),
    ],
    liquidity: 198_400_000n,
    positionLabel: 'No position',
  },
  {
    id: 9006n,
    marketKind: 'event',
    category: 'worldcup',
    matchId: 'final-1',
    stage: 'final',
    stageLabel: 'Final',
    marketType: '1x2',
    question: 'Argentina vs France Final 1X2',
    kickoffTime: '2026-07-10T19:00:00Z',
    betDeadline: toUnixSeconds('2026-07-10T18:45:00Z'),
    eventId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    outcomePools: [],
    userOutcomeStakes: [0n, 0n, 0n],
    claimed_: false,
    pendingPayout: 0n,
    settledOutcome: EVENT_UNRESOLVED_OUTCOME,
    homeTeam: findTeam('ARG'),
    awayTeam: findTeam('FRA'),
    outcomes: [
      createOutcome('final-arg', 'Home Win', 37.5, 'ARG'),
      createOutcome('final-draw', 'Draw', 29.0),
      createOutcome('final-fra', 'Away Win', 33.5, 'FRA'),
    ],
    liquidity: 312_800_000n,
    positionLabel: 'No position',
  },
  {
    id: 9007n,
    marketKind: 'event',
    category: 'worldcup',
    matchId: null,
    stage: 'winner',
    stageLabel: 'Winner',
    marketType: 'winner',
    question: '2026 World Cup Winner',
    kickoffTime: '2026-07-11T19:00:00Z',
    betDeadline: toUnixSeconds('2026-07-11T18:45:00Z'),
    eventId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    outcomePools: [],
    userOutcomeStakes: Array.from({ length: winnerFavorites.length }, () => 0n),
    claimed_: false,
    pendingPayout: 0n,
    settledOutcome: EVENT_UNRESOLVED_OUTCOME,
    homeTeam: findTeam('ARG'),
    awayTeam: findTeam('FRA'),
    outcomes: winnerFavorites.map((entry) => createOutcome(entry.teamId.toLowerCase(), findTeam(entry.teamId).nameEn, entry.probability, entry.teamId)),
    liquidity: 641_000_000n,
    positionLabel: 'No position',
  },
];

export const WORLDCUP_SKELETON_MARKETS: WorldCupMarketRow[] = skeletonRows.map((row) => ({
  ...row,
  outcomePools:
    row.outcomePools.length > 0 ? [...row.outcomePools] : poolsFromOutcomes(row.liquidity, row.outcomes),
  userOutcomeStakes: [...row.userOutcomeStakes],
}));

const GROUP_SEEDED_MATCH_IDS = WORLDCUP_MATCHES
  .filter((match) => match.stage === 'group')
  .map((match) => match.matchId);

export function resolveWorldCupOnchainMarketId(id: bigint): bigint {
  const skeleton = WORLDCUP_SKELETON_MARKETS.find((market) => market.id === id);

  if (!skeleton) {
    return id;
  }

  if (skeleton.marketType === 'winner') {
    return 97n;
  }

  if (skeleton.matchId === 'final-1' && skeleton.marketType === '1x2') {
    return 96n;
  }

  if (!skeleton.matchId) {
    return id;
  }

  const groupIndex = GROUP_SEEDED_MATCH_IDS.indexOf(skeleton.matchId);

  if (groupIndex < 0) {
    return id;
  }

  const marketOffset = skeleton.marketType === 'spread' ? 1 : 0;
  return BigInt(groupIndex * 2 + marketOffset);
}

const TEAM_MATCHERS = WORLDCUP_TEAMS.map((team) => ({
  teamId: team.id,
  chineseAliases: [team.shortNameZh],
  latinAliases: [team.id.toLowerCase(), team.nameEn.toLowerCase()],
}));

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function decodeReadableEventId(eventId: `0x${string}`): string | null {
  const hex = eventId.slice(2);
  let decoded = '';

  for (let index = 0; index < hex.length; index += 2) {
    const byte = Number.parseInt(hex.slice(index, index + 2), 16);

    if (!Number.isFinite(byte)) {
      return null;
    }

    if (byte === 0) {
      break;
    }

    if (byte < 32 || byte > 126) {
      return null;
    }

    decoded += String.fromCharCode(byte);
  }

  return decoded.length > 0 ? decoded : null;
}

function extractMatchId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.toLowerCase().match(MATCH_ID_PATTERN)?.[1] ?? null;
}

function resolveMatchIdFromEvent(
  eventId: `0x${string}`,
  readableEventId: string | null,
): string | null {
  return extractMatchId(readableEventId) ?? SEEDED_MATCH_ID_BY_EVENT_HASH[eventId.toLowerCase()] ?? null;
}

function isWinnerDescriptor(value: string | null | undefined): boolean {
  return value ? WINNER_MARKET_PATTERN.test(value) : false;
}

function inferMarketType(
  outcomeCount: number,
  question: string,
  readableEventId?: string | null,
): WorldCupMarketType {
  if (outcomeCount >= 32 || isWinnerDescriptor(question) || isWinnerDescriptor(readableEventId)) {
    return 'winner';
  }

  return outcomeCount === 2 ? 'spread' : '1x2';
}

function sum(values: readonly bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}

function stageLabelForMatch(stage: WorldCupStage, match?: WorldCupMatch | null): string {
  if (stage === 'group' && match?.group) {
    return `Group ${match.group}`;
  }

  return worldCupStageLabel(stage);
}

function findMentionedTeams(question: string): WorldCupTeam['id'][] {
  const lowerQuestion = question.toLowerCase();
  const mentions = TEAM_MATCHERS.flatMap((matcher) => {
    let firstIndex = Number.POSITIVE_INFINITY;

    for (const alias of matcher.chineseAliases) {
      const index = question.indexOf(alias);
      if (index >= 0) {
        firstIndex = Math.min(firstIndex, index);
      }
    }

    for (const alias of matcher.latinAliases) {
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias)}([^a-z0-9]|$)`, 'iu');
      const match = pattern.exec(lowerQuestion);
      if (match && match.index >= 0) {
        firstIndex = Math.min(firstIndex, match.index);
      }
    }

    return Number.isFinite(firstIndex) ? [{ teamId: matcher.teamId, index: firstIndex }] : [];
  });

  return mentions
    .sort((left, right) => left.index - right.index)
    .map((match) => match.teamId)
    .filter((teamId, index, values) => values.indexOf(teamId) === index);
}

function matchFromQuestion(question: string): WorldCupMatch | null {
  const directMatchId = extractMatchId(question);
  if (directMatchId) {
    return MATCH_BY_ID(directMatchId) ?? null;
  }

  const teams = findMentionedTeams(question);
  if (teams.length < 2) {
    return null;
  }

  const [firstTeam, secondTeam] = teams;
  const exactOrderMatch =
    WORLDCUP_MATCHES.find(
      (match) => match.homeTeam === firstTeam && match.awayTeam === secondTeam,
    ) ?? null;

  if (exactOrderMatch) {
    return exactOrderMatch;
  }

  const pairMatches = WORLDCUP_MATCHES.filter((match) => {
    const homeTeam = findWorldCupTeam(match.homeTeam);
    const awayTeam = findWorldCupTeam(match.awayTeam);

    return (
      homeTeam &&
      awayTeam &&
      [homeTeam.id, awayTeam.id].includes(firstTeam) &&
      [homeTeam.id, awayTeam.id].includes(secondTeam)
    );
  });

  return pairMatches.length === 1 ? pairMatches[0] : null;
}

function resolveMatchedMatch(
  row: EventMarketDashboardRow,
  marketType: WorldCupMarketType,
): WorldCupMatch | null {
  const readableEventId = decodeReadableEventId(row.market.eventId);

  if (marketType === 'winner') {
    return null;
  }

  const eventMatchId = resolveMatchIdFromEvent(row.market.eventId, readableEventId);
  if (eventMatchId) {
    return MATCH_BY_ID(eventMatchId) ?? null;
  }

  return matchFromQuestion(row.market.question);
}

function inferGenericStage(
  question: string,
  marketType: WorldCupMarketType,
  readableEventId?: string | null,
): WorldCupStage {
  if (marketType === 'winner') {
    return 'winner';
  }

  const descriptor = `${readableEventId ?? ''} ${question}`.toLowerCase();

  if (descriptor.includes('round of 16') || descriptor.includes('r16')) {
    return 'r16';
  }

  if (descriptor.includes('quarter') || descriptor.includes('qf')) {
    return 'qf';
  }

  if (descriptor.includes('semi') || descriptor.includes('sf')) {
    return 'sf';
  }

  if (descriptor.includes('final') || descriptor.includes('决赛')) {
    return 'final';
  }

  return 'group';
}

function fallbackKickoffTime(resolveAfter: bigint): string {
  const kickoffTime = resolveAfter > MATCH_DURATION_SECONDS ? resolveAfter - MATCH_DURATION_SECONDS : resolveAfter;
  return new Date(Number(kickoffTime) * 1000).toISOString();
}

function resolveTeamsFromQuestion(
  question: string,
): Pick<WorldCupMarketRow, 'homeTeam' | 'awayTeam'> | null {
  const teams = findMentionedTeams(question);

  if (teams.length < 2) {
    return null;
  }

  return {
    homeTeam: findTeam(teams[0]),
    awayTeam: findTeam(teams[1]),
  };
}

function resolveTeams(
  marketType: WorldCupMarketType,
  match: WorldCupMatch | null,
  question: string,
): Pick<WorldCupMarketRow, 'homeTeam' | 'awayTeam'> {
  if (marketType === 'winner') {
    return {
      homeTeam: GENERIC_WINNER_TEAM,
      awayTeam: null,
    };
  }

  if (!match) {
    return {
      homeTeam: GENERIC_HOME_TEAM,
      awayTeam: GENERIC_AWAY_TEAM,
    };
  }

  const hasPlaceholderParticipants =
    !findWorldCupTeam(match.homeTeam) || !findWorldCupTeam(match.awayTeam);

  if (hasPlaceholderParticipants) {
    const questionTeams = resolveTeamsFromQuestion(question);
    if (questionTeams) {
      return questionTeams;
    }
  }

  return {
    homeTeam: findTeam(match.homeTeam),
    awayTeam: findTeam(match.awayTeam),
  };
}

function buildTemplateOutcomes(
  marketType: WorldCupMarketType,
  homeTeam: WorldCupDisplayTeam,
  awayTeam: WorldCupDisplayTeam | null,
): WorldCupMarketOutcome[] {
  if (marketType === 'winner') {
    return winnerFavorites.map((entry) =>
      createOutcome(
        entry.teamId.toLowerCase(),
        findTeam(entry.teamId).nameEn,
        entry.probability,
        entry.teamId,
      ),
    );
  }

  if (marketType === 'spread') {
    return [
      createOutcome(`${homeTeam.shortCode.toLowerCase()}-cover`, `${homeTeam.nameEn} covers`, 50, homeTeam.teamId),
      createOutcome(
        `${awayTeam?.shortCode.toLowerCase() ?? 'away'}-cover`,
        `${awayTeam?.nameEn ?? 'Away'} covers`,
        50,
        awayTeam?.teamId,
      ),
    ];
  }

  return [
    createOutcome(`${homeTeam.shortCode.toLowerCase()}-win`, 'Home Win', 33.4, homeTeam.teamId),
    createOutcome('draw', 'Draw', 33.3),
    createOutcome(
      `${awayTeam?.shortCode.toLowerCase() ?? 'away'}-win`,
      'Away Win',
      33.3,
      awayTeam?.teamId,
    ),
  ];
}

function normalizeOutcomePools(
  row: EventMarketDashboardRow,
  marketType: WorldCupMarketType,
): bigint[] {
  const fallbackCount =
    marketType === 'winner' ? winnerFavorites.length : marketType === 'spread' ? 2 : 3;
  const outcomeCount = row.market.outcomeCount > 0 ? row.market.outcomeCount : fallbackCount;
  const pools =
    row.market.outcomePools.length > 0
      ? [...row.market.outcomePools]
      : Array.from({ length: outcomeCount }, () => 0n);

  while (pools.length < outcomeCount) {
    pools.push(0n);
  }

  return pools;
}

function normalizeOutcomeStakes(
  row: EventMarketDashboardRow,
  outcomeCount: number,
): bigint[] {
  const stakes = [...row.userOutcomeStakes];

  while (stakes.length < outcomeCount) {
    stakes.push(0n);
  }

  return stakes;
}

export function resolveWorldCupMarkets(
  eventRows: readonly EventMarketDashboardRow[],
): WorldCupMarketRow[] {
  if (eventRows.length === 0) {
    return WORLDCUP_SKELETON_MARKETS;
  }

  return eventRows.map((row) => {
    const readableEventId = decodeReadableEventId(row.market.eventId);
    const marketType = inferMarketType(row.market.outcomeCount, row.market.question, readableEventId);
    const match = resolveMatchedMatch(row, marketType);
    const stage = match?.stage ?? inferGenericStage(row.market.question, marketType, readableEventId);
    const { homeTeam, awayTeam } = resolveTeams(marketType, match, row.market.question);
    const pools = normalizeOutcomePools(row, marketType);
    const stakes = normalizeOutcomeStakes(row, pools.length);
    const totalPool = sum(pools);
    const templateOutcomes = buildTemplateOutcomes(marketType, homeTeam, awayTeam);
    const outcomes = pools.map((pool, outcomeIndex) => {
      const templateOutcome =
        templateOutcomes[outcomeIndex] ??
        createOutcome(`fallback-${outcomeIndex}`, `Outcome ${outcomeIndex + 1}`, 0);
      const impliedProbability =
        totalPool === 0n ? templateOutcome.impliedProbability : Number((pool * 10_000n) / totalPool) / 100;

      return createOutcome(
        templateOutcome.id,
        templateOutcome.label,
        impliedProbability,
        templateOutcome.teamId,
        templateOutcome.impliedProbability,
      );
    });
    const activeStake = sum(stakes);

    return {
      id: row.id,
      marketKind: 'event',
      category: 'worldcup',
      matchId: match?.matchId ?? extractMatchId(readableEventId),
      stage,
      stageLabel: stageLabelForMatch(stage, match),
      marketType,
      question: row.market.question,
      kickoffTime: match?.kickoffTime ?? fallbackKickoffTime(row.market.resolveAfter),
      betDeadline: row.market.betDeadline,
      eventId: row.market.eventId,
      outcomePools: pools,
      userOutcomeStakes: stakes,
      claimed_: row.claimed_,
      pendingPayout: row.pendingPayout,
      settledOutcome: row.market.settledOutcome,
      homeTeam,
      awayTeam,
      outcomes,
      liquidity: totalPool,
      positionLabel: activeStake > 0n ? `Position ${Number(activeStake) / 1_000_000} USDC` : 'No position',
    };
  });
}

export function fallbackWinnerOutcomeTeam(
  teamId?: WorldCupTeam['id'],
): WorldCupDisplayTeam | null {
  if (!teamId) {
    return null;
  }

  const team = findWorldCupTeam(teamId);
  if (!team) {
    return null;
  }

    return {
      teamId: team.id,
      shortCode: team.id,
      nameZh: team.shortNameZh,
      nameEn: team.nameEn,
    };
  }
