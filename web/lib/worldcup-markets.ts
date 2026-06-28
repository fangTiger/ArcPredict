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
  type MarketCategory,
  type WorldCupStage,
} from './market-kind';
import type { EventMarketDeploymentId } from './markets/deployments';

export type WorldCupMarketType = '1x2' | 'spread' | 'totals' | 'winner';

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

export type MarketThemeVisual = {
  id: string;
  imageUrl: string;
  alt: string;
  title: string;
  subtitle: string;
};

export type WorldCupMarketRow = {
  id: bigint;
  deploymentId?: EventMarketDeploymentId;
  eventMarketAddress?: `0x${string}`;
  oracleAddress?: `0x${string}`;
  marketKind: 'event';
  category: MarketCategory;
  sourceId?: string;
  externalKey?: string;
  themeId?: string;
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
  themeVisual?: MarketThemeVisual;
};

export type EventMarketDashboardRow = {
  id: bigint;
  deploymentId?: EventMarketDeploymentId;
  eventMarketAddress?: `0x${string}`;
  oracleAddress?: `0x${string}`;
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
const MATCH_ID_PATTERN = /\b(group-[a-l]-[1-6]|r32-(?:[1-9]|1[0-6])|r16-[1-8]|qf-[1-4]|sf-[1-2]|final-[12])\b/iu;
const WINNER_MARKET_PATTERN = /winner|champion|冠军/iu;
const TOTAL_GOALS_MARKET_PATTERN = /(?:total\s+goals?|goals?)[\s-]*(?:over|o\/u)?\s*([0-9]+(?:\.[0-9]+)?)/iu;
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

const GENERIC_MACRO_TEAM: WorldCupDisplayTeam = {
  shortCode: 'MACRO',
  nameZh: 'Macro',
  nameEn: 'Macro',
};

const GENERIC_CHAIN_TEAM: WorldCupDisplayTeam = {
  shortCode: 'CHAIN',
  nameZh: 'On-chain',
  nameEn: 'On-chain',
};
const CHAIN_TVL_QUESTION_PATTERN =
  /^Will\s+(Ethereum|Arbitrum)\s+TVL\s+be\s+>=\s+\$([0-9]+(?:\.[0-9]+)?)B\s+by\s+(\d{4}-\d{2}-\d{2})\?$/iu;

const winnerProbabilityByTeamId: Record<string, number> = {
  BRA: 12.8,
  ARG: 11.9,
  FRA: 10.8,
  ENG: 9.6,
  ESP: 8.4,
  GER: 7.2,
  POR: 6.6,
  NED: 5.4,
  BEL: 4.6,
  USA: 3.8,
  CRO: 3.4,
  URU: 3.0,
  COL: 2.8,
  MEX: 2.4,
  SUI: 2.2,
  MAR: 2.0,
};

const winnerFavorites = WORLDCUP_TEAMS.map((team) => ({
  teamId: team.id,
  probability: winnerProbabilityByTeamId[team.id] ?? 1.0,
})).sort((left, right) => right.probability - left.probability);

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

function requiredSeedMatch(matchId: string): WorldCupMatch {
  const match = MATCH_BY_ID(matchId);
  if (!match) {
    throw new Error(`缺少 World Cup seed match: ${matchId}`);
  }
  return match;
}

function betDeadlineBefore(kickoffTime: string, minutesBefore: number): bigint {
  return toUnixSeconds(kickoffTime) - BigInt(minutesBefore * 60);
}

function skeletonOutcomes(
  marketType: WorldCupMarketType,
  homeTeam: WorldCupDisplayTeam,
  awayTeam: WorldCupDisplayTeam | null,
  question: string,
): WorldCupMarketOutcome[] {
  if (homeTeam.teamId && awayTeam?.teamId) {
    return buildTemplateOutcomes(marketType, homeTeam, awayTeam, question);
  }

  if (marketType === 'spread') {
    return [
      createOutcome('home-cover', 'Home covers', 50),
      createOutcome('away-cover', 'Away covers', 50),
    ];
  }

  return [
    createOutcome('home-win', 'Home Win', 33.4),
    createOutcome('draw', 'Draw', 33.3),
    createOutcome('away-win', 'Away Win', 33.3),
  ];
}

function createSkeletonMatchRow({
  id,
  matchId,
  marketType,
  question,
  liquidity,
  minutesBeforeDeadline = 30,
}: {
  id: bigint;
  matchId: string;
  marketType: Exclude<WorldCupMarketType, 'winner'>;
  question: string;
  liquidity: bigint;
  minutesBeforeDeadline?: number;
}): WorldCupMarketRow {
  const match = requiredSeedMatch(matchId);
  const homeTeam = findTeam(match.homeTeam);
  const awayTeam = findTeam(match.awayTeam);
  const outcomes = skeletonOutcomes(marketType, homeTeam, awayTeam, question);

  return {
    id,
    marketKind: 'event',
    category: 'worldcup',
    matchId,
    stage: match.stage,
    stageLabel: stageLabelForMatch(match.stage, match),
    marketType,
    question,
    kickoffTime: match.kickoffTime,
    betDeadline: betDeadlineBefore(match.kickoffTime, minutesBeforeDeadline),
    eventId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    outcomePools: [],
    userOutcomeStakes: Array.from({ length: outcomes.length }, () => 0n),
    claimed_: false,
    pendingPayout: 0n,
    settledOutcome: EVENT_UNRESOLVED_OUTCOME,
    homeTeam,
    awayTeam,
    outcomes,
    liquidity,
    positionLabel: 'No position',
  };
}

const SCHEDULE_FALLBACK_ID_BASE = 9000n;

function fallbackLiquidityForMatch(index: number): bigint {
  return 110_000_000n + BigInt(index % 8) * 18_000_000n;
}

const skeletonMatchRows: WorldCupMarketRow[] = WORLDCUP_MATCHES.flatMap((match, index) => {
  const homeTeam = findWorldCupTeam(match.homeTeam);
  const awayTeam = findWorldCupTeam(match.awayTeam);

  if (!homeTeam || !awayTeam) {
    return [];
  }

  return createSkeletonMatchRow({
    id: SCHEDULE_FALLBACK_ID_BASE + BigInt(index + 1),
    matchId: match.matchId,
    marketType: '1x2',
    question: `${homeTeam.nameEn} vs ${awayTeam.nameEn} 1X2`,
    liquidity: fallbackLiquidityForMatch(index),
  });
});

const skeletonRows: WorldCupMarketRow[] = [
  ...skeletonMatchRows,
  {
    id: SCHEDULE_FALLBACK_ID_BASE + BigInt(WORLDCUP_MATCHES.length + 1),
    marketKind: 'event',
    category: 'worldcup',
    matchId: null,
    stage: 'winner',
    stageLabel: 'Winner',
    marketType: 'winner',
    question: '2026 World Cup Winner',
    kickoffTime: requiredSeedMatch('final-1').kickoffTime,
    betDeadline: betDeadlineBefore(requiredSeedMatch('final-1').kickoffTime, 30),
    eventId: '0x0000000000000000000000000000000000000000000000000000000000000000',
    outcomePools: [],
    userOutcomeStakes: Array.from({ length: winnerFavorites.length }, () => 0n),
    claimed_: false,
    pendingPayout: 0n,
    settledOutcome: EVENT_UNRESOLVED_OUTCOME,
    homeTeam: GENERIC_WINNER_TEAM,
    awayTeam: null,
    outcomes: winnerFavorites.map((entry) =>
      createOutcome(
        entry.teamId.toLowerCase(),
        findTeam(entry.teamId).nameEn,
        entry.probability,
        entry.teamId,
      ),
    ),
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
const SEEDED_GROUP_MARKET_COUNT = BigInt(GROUP_SEEDED_MATCH_IDS.length * 2);

export function resolveWorldCupOnchainMarketId(id: bigint): bigint {
  const skeleton = WORLDCUP_SKELETON_MARKETS.find((market) => market.id === id);

  if (!skeleton) {
    return id;
  }

  if (skeleton.marketType === 'winner') {
    return SEEDED_GROUP_MARKET_COUNT + 1n;
  }

  if (skeleton.matchId === 'final-1' && skeleton.marketType === '1x2') {
    return SEEDED_GROUP_MARKET_COUNT;
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

export function getUpcomingWorldCupMarkets<T extends Pick<WorldCupMarketRow, 'id' | 'betDeadline' | 'settledOutcome'>>(
  markets: readonly T[],
  now: bigint = BigInt(Math.floor(Date.now() / 1000)),
): T[] {
  return markets
    .filter((market) => {
      if (market.settledOutcome !== EVENT_UNRESOLVED_OUTCOME) {
        return false;
      }

      const kickoffTime =
        'kickoffTime' in market && typeof market.kickoffTime === 'string'
          ? toUnixSeconds(market.kickoffTime)
          : null;

      return kickoffTime ? kickoffTime > now : market.betDeadline > now;
    })
    .sort((left, right) => {
      if (left.betDeadline !== right.betDeadline) {
        return left.betDeadline > right.betDeadline ? -1 : 1;
      }

      if (left.id === right.id) {
        return 0;
      }

      return left.id < right.id ? -1 : 1;
    });
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

function totalGoalsLine(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return TOTAL_GOALS_MARKET_PATTERN.exec(value)?.[1] ?? null;
}

function inferMarketType(
  outcomeCount: number,
  question: string,
  readableEventId?: string | null,
): WorldCupMarketType {
  if (outcomeCount >= 32 || isWinnerDescriptor(question) || isWinnerDescriptor(readableEventId)) {
    return 'winner';
  }

  if (totalGoalsLine(question) || totalGoalsLine(readableEventId)) {
    return 'totals';
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

  if (descriptor.includes('round of 32') || descriptor.includes('r32')) {
    return 'r32';
  }

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
  return new Date(Number(kickoffTime) * 1000).toISOString().replace('.000Z', 'Z');
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

function hasRenderableWorldCupParticipants(
  marketType: WorldCupMarketType,
  homeTeam: WorldCupDisplayTeam,
  awayTeam: WorldCupDisplayTeam | null,
): boolean {
  if (marketType === 'winner') {
    return true;
  }

  return Boolean(homeTeam.teamId && awayTeam?.teamId);
}

function buildTemplateOutcomes(
  marketType: WorldCupMarketType,
  homeTeam: WorldCupDisplayTeam,
  awayTeam: WorldCupDisplayTeam | null,
  question = '',
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

  if (marketType === 'totals') {
    const line = totalGoalsLine(question) ?? '2.5';
    const idSuffix = line.replace('.', '-');
    return [
      createOutcome(`over-${idSuffix}`, `Over ${line}`, 50),
      createOutcome(`under-${idSuffix}`, `Under ${line}`, 50),
    ];
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
    marketType === 'winner' ? winnerFavorites.length : marketType === 'spread' || marketType === 'totals' ? 2 : 3;
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

function inferEventCategory(question: string, readableEventId?: string | null): MarketCategory {
  const descriptor = `${readableEventId ?? ''} ${question}`.toLowerCase();

  if (/\b(?:us cpi|cpi y?o?y?|fed funds|nfp|non-farm|payrolls?)\b/u.test(descriptor)) {
    return 'macro';
  }

  if (/\b(?:tvl|defillama|ethereum|arbitrum)\b/u.test(descriptor)) {
    return 'chain';
  }

  return 'worldcup';
}

const MARKET_THEME_VISUALS = {
  macroCpi: {
    id: 'macro-cpi',
    imageUrl: '/market-themes/macro-cpi.png',
    alt: 'Macro inflation market theme image',
    title: 'Inflation print',
    subtitle: 'US CPI YoY',
  },
  macroFedFunds: {
    id: 'macro-fed-funds',
    imageUrl: '/market-themes/macro-fed-funds.png',
    alt: 'Macro central bank rates market theme image',
    title: 'Rate corridor',
    subtitle: 'Fed Funds',
  },
  macroNfp: {
    id: 'macro-nfp',
    imageUrl: '/market-themes/macro-nfp.png',
    alt: 'Macro labor market theme image',
    title: 'Labor pulse',
    subtitle: 'NFP momentum',
  },
  chainEthereumTvl: {
    id: 'chain-ethereum-tvl',
    imageUrl: '/market-themes/chain-ethereum-tvl.png',
    alt: 'On-chain Ethereum TVL market theme image',
    title: 'Ethereum TVL',
    subtitle: 'Liquidity threshold',
  },
  chainArbitrumTvl: {
    id: 'chain-arbitrum-tvl',
    imageUrl: '/market-themes/chain-arbitrum-tvl.png',
    alt: 'On-chain Arbitrum TVL market theme image',
    title: 'Arbitrum TVL',
    subtitle: 'Layer-2 liquidity',
  },
  chainTokenUnlock: {
    id: 'chain-token-unlock',
    imageUrl: '/market-themes/chain-token-unlock.png',
    alt: 'On-chain token unlock market theme image',
    title: 'Unlock schedule',
    subtitle: 'Vesting cliff',
  },
} satisfies Record<string, MarketThemeVisual>;

function automatedThemeVisual(
  category: MarketCategory,
  question: string,
  readableEventId?: string | null,
): MarketThemeVisual | undefined {
  const descriptor = `${readableEventId ?? ''} ${question}`.toLowerCase();

  if (category === 'macro') {
    if (/\b(?:fed funds?|rate|rates)\b/u.test(descriptor)) {
      return MARKET_THEME_VISUALS.macroFedFunds;
    }

    if (/\b(?:nfp|non-farm|payrolls?|labor|employment)\b/u.test(descriptor)) {
      return MARKET_THEME_VISUALS.macroNfp;
    }

    return MARKET_THEME_VISUALS.macroCpi;
  }

  if (category === 'chain') {
    if (/\b(?:unlock|vesting|cliff)\b/u.test(descriptor)) {
      return MARKET_THEME_VISUALS.chainTokenUnlock;
    }

    if (/\b(?:arbitrum|arb)\b/u.test(descriptor)) {
      return MARKET_THEME_VISUALS.chainArbitrumTvl;
    }

    return MARKET_THEME_VISUALS.chainEthereumTvl;
  }

  return undefined;
}

function automatedStageLabel(category: MarketCategory): string {
  if (category === 'macro') {
    return 'Macro';
  }

  if (category === 'chain') {
    return 'On-chain';
  }

  return 'Event';
}

function automatedHomeTeam(category: MarketCategory): WorldCupDisplayTeam {
  return category === 'macro' ? GENERIC_MACRO_TEAM : GENERIC_CHAIN_TEAM;
}

function thresholdUsdFromBillionsLabel(value: string): string {
  const [wholePart, fractionPart = ''] = value.split('.');
  const normalizedWhole = wholePart.replace(/^0+(?=\d)/u, '') || '0';
  const normalizedFraction = `${fractionPart}000000000`.slice(0, 9);

  return `${normalizedWhole}${normalizedFraction}`.replace(/^0+(?=\d)/u, '');
}

function automatedSourceIdentity(
  category: MarketCategory,
  question: string,
): Pick<WorldCupMarketRow, 'sourceId' | 'externalKey'> {
  if (category !== 'chain') {
    return {};
  }

  const match = CHAIN_TVL_QUESTION_PATTERN.exec(question);
  if (!match) {
    return {};
  }

  const [, chainName, thresholdLabel, deadline] = match;
  const chainId = chainName.toLowerCase() === 'ethereum' ? 'eth' : 'arb';

  return {
    sourceId: 'chain-event',
    externalKey: `${chainId}:tvl:gte:${thresholdUsdFromBillionsLabel(thresholdLabel)}:${deadline}`,
  };
}

function fallbackOutcomeLabels(outcomeCount: number): string[] {
  return Array.from({ length: Math.max(0, outcomeCount) }, (_, index) => `Outcome ${index + 1}`);
}

function automatedOutcomeLabels(
  category: MarketCategory,
  question: string,
  outcomeCount: number,
): string[] {
  if (category === 'chain') {
    return outcomeCount === 2 ? ['Yes', 'No'] : fallbackOutcomeLabels(outcomeCount);
  }

  if (category === 'macro') {
    const lowerQuestion = question.toLowerCase();

    if (lowerQuestion.includes('cpi')) {
      return ['< 2.5%', '2.5%-3.5%', '> 3.5%'];
    }

    if (lowerQuestion.includes('fed funds')) {
      return ['< 4.5%', '4.5%-5.0%', '> 5.0%'];
    }

    if (lowerQuestion.includes('nfp') || lowerQuestion.includes('payroll')) {
      return ['< 100k', '100k-200k', '> 200k'];
    }
  }

  return fallbackOutcomeLabels(outcomeCount);
}

function automatedMarketType(outcomeCount: number): WorldCupMarketType {
  return outcomeCount === 2 ? 'spread' : '1x2';
}

function buildAutomatedTemplateOutcomes(
  category: MarketCategory,
  question: string,
  outcomeCount: number,
): WorldCupMarketOutcome[] {
  const labels = automatedOutcomeLabels(category, question, outcomeCount);
  const fallbackProbability = labels.length > 0 ? Number((100 / labels.length).toFixed(1)) : 0;

  return labels.map((label, index) =>
    createOutcome(
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-|-$/gu, '') || `outcome-${index + 1}`,
      label,
      fallbackProbability,
    ),
  );
}

function worldCupMarketKey(row: Pick<WorldCupMarketRow, 'marketType' | 'matchId'>): string {
  return `${row.marketType}:${row.matchId ?? 'tournament'}`;
}

function isWorldCupMatchMarket(row: Pick<WorldCupMarketRow, 'category' | 'marketType'>): boolean {
  return row.category === 'worldcup' && row.marketType !== 'winner';
}

function appendCurrentFallbackWorldCupMarkets(
  rows: readonly WorldCupMarketRow[],
  now: bigint,
): WorldCupMarketRow[] {
  const existingWorldCupKeys = new Set(
    rows.filter((row) => row.category === 'worldcup').map((row) => worldCupMarketKey(row)),
  );
  const fallbackRows = getUpcomingWorldCupMarkets(WORLDCUP_SKELETON_MARKETS, now).filter(
    (row) => !existingWorldCupKeys.has(worldCupMarketKey(row)),
  );

  return [...rows, ...fallbackRows];
}

export function resolveWorldCupMarkets(
  eventRows: readonly EventMarketDashboardRow[],
  now: bigint = BigInt(Math.floor(Date.now() / 1000)),
): WorldCupMarketRow[] {
  if (eventRows.length === 0) {
    return getUpcomingWorldCupMarkets(WORLDCUP_SKELETON_MARKETS, now);
  }

  const resolvedRows = eventRows.flatMap((row): WorldCupMarketRow[] => {
    const readableEventId = decodeReadableEventId(row.market.eventId);
    const category = inferEventCategory(row.market.question, readableEventId);
    const sourceIdentity = automatedSourceIdentity(category, row.market.question);
    const marketType = inferMarketType(row.market.outcomeCount, row.market.question, readableEventId);
    const resolvedMarketType =
      category === 'worldcup' ? marketType : automatedMarketType(row.market.outcomeCount);
    const match = category === 'worldcup' ? resolveMatchedMatch(row, marketType) : null;
    const stage =
      category === 'worldcup'
        ? match?.stage ?? inferGenericStage(row.market.question, marketType, readableEventId)
        : 'group';
    const { homeTeam, awayTeam } =
      category === 'worldcup'
        ? resolveTeams(marketType, match, row.market.question)
        : { homeTeam: automatedHomeTeam(category), awayTeam: null };

    if (
      category === 'worldcup' &&
      !hasRenderableWorldCupParticipants(resolvedMarketType, homeTeam, awayTeam)
    ) {
      return [];
    }

    const pools = normalizeOutcomePools(row, resolvedMarketType);
    const stakes = normalizeOutcomeStakes(row, pools.length);
    const totalPool = sum(pools);
    const templateOutcomes =
      category === 'worldcup'
        ? buildTemplateOutcomes(marketType, homeTeam, awayTeam, row.market.question)
        : buildAutomatedTemplateOutcomes(category, row.market.question, pools.length);
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

    return [{
      id: row.id,
      deploymentId: row.deploymentId,
      eventMarketAddress: row.eventMarketAddress,
      oracleAddress: row.oracleAddress,
      marketKind: 'event',
      category,
      ...sourceIdentity,
      matchId: category === 'worldcup' ? match?.matchId ?? extractMatchId(readableEventId) : null,
      stage,
      stageLabel: category === 'worldcup' ? stageLabelForMatch(stage, match) : automatedStageLabel(category),
      marketType: resolvedMarketType,
      question: row.market.question,
      kickoffTime: fallbackKickoffTime(row.market.resolveAfter),
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
      themeVisual: automatedThemeVisual(category, row.market.question, readableEventId),
    }];
  });

  return appendCurrentFallbackWorldCupMarkets(resolvedRows, now);
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
