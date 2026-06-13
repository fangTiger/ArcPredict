import type { WorldCupStage } from './market-kind';

type GroupCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export type WorldCupTeam = {
  id: string;
  iso2: string;
  flagCode: string;
  nameEn: string;
  shortNameZh: string;
  group: GroupCode;
};

export type WorldCupPlaceholder =
  | 'GROUP_A_W'
  | 'GROUP_A_RU'
  | 'GROUP_B_W'
  | 'GROUP_B_RU'
  | 'GROUP_C_W'
  | 'GROUP_C_RU'
  | 'GROUP_D_W'
  | 'GROUP_D_RU'
  | 'GROUP_E_W'
  | 'GROUP_E_RU'
  | 'GROUP_F_W'
  | 'GROUP_F_RU'
  | 'GROUP_G_W'
  | 'GROUP_G_RU'
  | 'GROUP_H_W'
  | 'GROUP_H_RU'
  | 'R16_1_W'
  | 'R16_2_W'
  | 'R16_3_W'
  | 'R16_4_W'
  | 'R16_5_W'
  | 'R16_6_W'
  | 'R16_7_W'
  | 'R16_8_W'
  | 'QF_1_W'
  | 'QF_2_W'
  | 'QF_3_W'
  | 'QF_4_W'
  | 'SF_1_W'
  | 'SF_2_W'
  | 'SF_1_L'
  | 'SF_2_L';

export type WorldCupParticipant = WorldCupTeam['id'] | WorldCupPlaceholder;

export type WorldCupMatch = {
  matchId: string;
  stage: WorldCupStage;
  kickoffTime: string;
  homeTeam: WorldCupParticipant;
  awayTeam: WorldCupParticipant;
  sportsDbEventId: string | null;
  group?: GroupCode;
  label?: string;
  round?: string;
};

type RawWorldCupMatch = Omit<WorldCupMatch, 'sportsDbEventId'>;

// 英格兰与威尔士没有独立 ISO 3166-1 alpha-2，沿用 GB 并单独提供 flagCode。
export const WORLDCUP_TEAMS: WorldCupTeam[] = [
  { id: 'QAT', iso2: 'QA', flagCode: 'qa', nameEn: 'Qatar', shortNameZh: '卡塔尔', group: 'A' },
  { id: 'ECU', iso2: 'EC', flagCode: 'ec', nameEn: 'Ecuador', shortNameZh: '厄瓜多尔', group: 'A' },
  { id: 'SEN', iso2: 'SN', flagCode: 'sn', nameEn: 'Senegal', shortNameZh: '塞内加尔', group: 'A' },
  { id: 'NED', iso2: 'NL', flagCode: 'nl', nameEn: 'Netherlands', shortNameZh: '荷兰', group: 'A' },
  { id: 'ENG', iso2: 'GB', flagCode: 'gb-eng', nameEn: 'England', shortNameZh: '英格兰', group: 'B' },
  { id: 'IRN', iso2: 'IR', flagCode: 'ir', nameEn: 'Iran', shortNameZh: '伊朗', group: 'B' },
  { id: 'USA', iso2: 'US', flagCode: 'us', nameEn: 'United States', shortNameZh: '美国', group: 'B' },
  { id: 'WAL', iso2: 'GB', flagCode: 'gb-wls', nameEn: 'Wales', shortNameZh: '威尔士', group: 'B' },
  { id: 'ARG', iso2: 'AR', flagCode: 'ar', nameEn: 'Argentina', shortNameZh: '阿根廷', group: 'C' },
  { id: 'KSA', iso2: 'SA', flagCode: 'sa', nameEn: 'Saudi Arabia', shortNameZh: '沙特', group: 'C' },
  { id: 'MEX', iso2: 'MX', flagCode: 'mx', nameEn: 'Mexico', shortNameZh: '墨西哥', group: 'C' },
  { id: 'POL', iso2: 'PL', flagCode: 'pl', nameEn: 'Poland', shortNameZh: '波兰', group: 'C' },
  { id: 'FRA', iso2: 'FR', flagCode: 'fr', nameEn: 'France', shortNameZh: '法国', group: 'D' },
  { id: 'AUS', iso2: 'AU', flagCode: 'au', nameEn: 'Australia', shortNameZh: '澳大利亚', group: 'D' },
  { id: 'DEN', iso2: 'DK', flagCode: 'dk', nameEn: 'Denmark', shortNameZh: '丹麦', group: 'D' },
  { id: 'TUN', iso2: 'TN', flagCode: 'tn', nameEn: 'Tunisia', shortNameZh: '突尼斯', group: 'D' },
  { id: 'ESP', iso2: 'ES', flagCode: 'es', nameEn: 'Spain', shortNameZh: '西班牙', group: 'E' },
  { id: 'GER', iso2: 'DE', flagCode: 'de', nameEn: 'Germany', shortNameZh: '德国', group: 'E' },
  { id: 'JPN', iso2: 'JP', flagCode: 'jp', nameEn: 'Japan', shortNameZh: '日本', group: 'E' },
  { id: 'CRC', iso2: 'CR', flagCode: 'cr', nameEn: 'Costa Rica', shortNameZh: '哥斯达黎加', group: 'E' },
  { id: 'BEL', iso2: 'BE', flagCode: 'be', nameEn: 'Belgium', shortNameZh: '比利时', group: 'F' },
  { id: 'CRO', iso2: 'HR', flagCode: 'hr', nameEn: 'Croatia', shortNameZh: '克罗地亚', group: 'F' },
  { id: 'MAR', iso2: 'MA', flagCode: 'ma', nameEn: 'Morocco', shortNameZh: '摩洛哥', group: 'F' },
  { id: 'CAN', iso2: 'CA', flagCode: 'ca', nameEn: 'Canada', shortNameZh: '加拿大', group: 'F' },
  { id: 'BRA', iso2: 'BR', flagCode: 'br', nameEn: 'Brazil', shortNameZh: '巴西', group: 'G' },
  { id: 'SRB', iso2: 'RS', flagCode: 'rs', nameEn: 'Serbia', shortNameZh: '塞尔维亚', group: 'G' },
  { id: 'SUI', iso2: 'CH', flagCode: 'ch', nameEn: 'Switzerland', shortNameZh: '瑞士', group: 'G' },
  { id: 'CMR', iso2: 'CM', flagCode: 'cm', nameEn: 'Cameroon', shortNameZh: '喀麦隆', group: 'G' },
  { id: 'POR', iso2: 'PT', flagCode: 'pt', nameEn: 'Portugal', shortNameZh: '葡萄牙', group: 'H' },
  { id: 'GHA', iso2: 'GH', flagCode: 'gh', nameEn: 'Ghana', shortNameZh: '加纳', group: 'H' },
  { id: 'URU', iso2: 'UY', flagCode: 'uy', nameEn: 'Uruguay', shortNameZh: '乌拉圭', group: 'H' },
  { id: 'KOR', iso2: 'KR', flagCode: 'kr', nameEn: 'South Korea', shortNameZh: '韩国', group: 'H' },
];

const CONFIRMED_SPORTSDB_EVENT_IDS: Record<string, string> = {
  'group-a-1': '1543883',
  'group-a-2': '1543881',
  'group-a-3': '1543894',
  'group-a-4': '1543895',
  'group-a-5': '1543908',
  'group-a-6': '1543907',
  'group-b-1': '1543882',
  'group-b-2': '1570148',
  'group-b-3': '1570149',
  'group-b-4': '1543896',
  'group-b-5': '1570150',
  'group-b-6': '1543909',
  'group-c-1': '1543884',
  'group-c-2': '1543886',
  'group-c-3': '1543897',
  'group-c-4': '1543899',
  'group-c-5': '1543911',
  'group-c-6': '1543912',
  'group-d-1': '1543885',
  'group-d-2': '1574659',
  'group-d-3': '1574661',
  'group-d-4': '1543898',
  'group-d-5': '1574663',
  'group-d-6': '1543910',
  'group-e-1': '1543888',
  'group-e-2': '1574660',
  'group-e-3': '1574662',
  'group-e-4': '1543902',
  'group-e-5': '1543915',
  'group-e-6': '1574664',
  'group-f-1': '1543887',
  'group-f-2': '1543889',
  'group-f-3': '1543900',
  'group-f-4': '1543901',
  'group-f-5': '1543913',
  'group-f-6': '1543914',
  'group-g-1': '1543890',
  'group-g-2': '1543893',
  'group-g-3': '1543903',
  'group-g-4': '1543905',
  'group-g-5': '1543919',
  'group-g-6': '1543918',
  'group-h-1': '1543891',
  'group-h-2': '1543892',
  'group-h-3': '1543904',
  'group-h-4': '1543906',
  'group-h-5': '1543916',
  'group-h-6': '1543917',
  'r16-1': '1665048',
  'r16-2': '1665112',
  'r16-3': '1665113',
  'r16-4': '1665049',
  'r16-5': '1665565',
  'r16-6': '1665657',
  'r16-7': '1665566',
  'r16-8': '1665658',
};

const RAW_WORLDCUP_MATCHES: RawWorldCupMatch[] = [
  { matchId: 'group-a-1', stage: 'group', group: 'A', round: 'Matchday 1', kickoffTime: '2022-11-20T16:00:00Z', homeTeam: 'QAT', awayTeam: 'ECU' },
  { matchId: 'group-a-2', stage: 'group', group: 'A', round: 'Matchday 1', kickoffTime: '2022-11-21T16:00:00Z', homeTeam: 'SEN', awayTeam: 'NED' },
  { matchId: 'group-a-3', stage: 'group', group: 'A', round: 'Matchday 2', kickoffTime: '2022-11-25T13:00:00Z', homeTeam: 'QAT', awayTeam: 'SEN' },
  { matchId: 'group-a-4', stage: 'group', group: 'A', round: 'Matchday 2', kickoffTime: '2022-11-25T16:00:00Z', homeTeam: 'NED', awayTeam: 'ECU' },
  { matchId: 'group-a-5', stage: 'group', group: 'A', round: 'Matchday 3', kickoffTime: '2022-11-29T15:00:00Z', homeTeam: 'ECU', awayTeam: 'SEN' },
  { matchId: 'group-a-6', stage: 'group', group: 'A', round: 'Matchday 3', kickoffTime: '2022-11-29T15:00:00Z', homeTeam: 'NED', awayTeam: 'QAT' },
  { matchId: 'group-b-1', stage: 'group', group: 'B', round: 'Matchday 1', kickoffTime: '2022-11-21T13:00:00Z', homeTeam: 'ENG', awayTeam: 'IRN' },
  { matchId: 'group-b-2', stage: 'group', group: 'B', round: 'Matchday 1', kickoffTime: '2022-11-21T19:00:00Z', homeTeam: 'USA', awayTeam: 'WAL' },
  { matchId: 'group-b-3', stage: 'group', group: 'B', round: 'Matchday 2', kickoffTime: '2022-11-25T10:00:00Z', homeTeam: 'WAL', awayTeam: 'IRN' },
  { matchId: 'group-b-4', stage: 'group', group: 'B', round: 'Matchday 2', kickoffTime: '2022-11-25T19:00:00Z', homeTeam: 'ENG', awayTeam: 'USA' },
  { matchId: 'group-b-5', stage: 'group', group: 'B', round: 'Matchday 3', kickoffTime: '2022-11-29T19:00:00Z', homeTeam: 'WAL', awayTeam: 'ENG' },
  { matchId: 'group-b-6', stage: 'group', group: 'B', round: 'Matchday 3', kickoffTime: '2022-11-29T19:00:00Z', homeTeam: 'IRN', awayTeam: 'USA' },
  { matchId: 'group-c-1', stage: 'group', group: 'C', round: 'Matchday 1', kickoffTime: '2022-11-22T10:00:00Z', homeTeam: 'ARG', awayTeam: 'KSA' },
  { matchId: 'group-c-2', stage: 'group', group: 'C', round: 'Matchday 1', kickoffTime: '2022-11-22T16:00:00Z', homeTeam: 'MEX', awayTeam: 'POL' },
  { matchId: 'group-c-3', stage: 'group', group: 'C', round: 'Matchday 2', kickoffTime: '2022-11-26T13:00:00Z', homeTeam: 'POL', awayTeam: 'KSA' },
  { matchId: 'group-c-4', stage: 'group', group: 'C', round: 'Matchday 2', kickoffTime: '2022-11-26T19:00:00Z', homeTeam: 'ARG', awayTeam: 'MEX' },
  { matchId: 'group-c-5', stage: 'group', group: 'C', round: 'Matchday 3', kickoffTime: '2022-11-30T19:00:00Z', homeTeam: 'POL', awayTeam: 'ARG' },
  { matchId: 'group-c-6', stage: 'group', group: 'C', round: 'Matchday 3', kickoffTime: '2022-11-30T19:00:00Z', homeTeam: 'KSA', awayTeam: 'MEX' },
  { matchId: 'group-d-1', stage: 'group', group: 'D', round: 'Matchday 1', kickoffTime: '2022-11-22T13:00:00Z', homeTeam: 'DEN', awayTeam: 'TUN' },
  { matchId: 'group-d-2', stage: 'group', group: 'D', round: 'Matchday 1', kickoffTime: '2022-11-22T19:00:00Z', homeTeam: 'FRA', awayTeam: 'AUS' },
  { matchId: 'group-d-3', stage: 'group', group: 'D', round: 'Matchday 2', kickoffTime: '2022-11-26T10:00:00Z', homeTeam: 'TUN', awayTeam: 'AUS' },
  { matchId: 'group-d-4', stage: 'group', group: 'D', round: 'Matchday 2', kickoffTime: '2022-11-26T16:00:00Z', homeTeam: 'FRA', awayTeam: 'DEN' },
  { matchId: 'group-d-5', stage: 'group', group: 'D', round: 'Matchday 3', kickoffTime: '2022-11-30T15:00:00Z', homeTeam: 'AUS', awayTeam: 'DEN' },
  { matchId: 'group-d-6', stage: 'group', group: 'D', round: 'Matchday 3', kickoffTime: '2022-11-30T15:00:00Z', homeTeam: 'TUN', awayTeam: 'FRA' },
  { matchId: 'group-e-1', stage: 'group', group: 'E', round: 'Matchday 1', kickoffTime: '2022-11-23T13:00:00Z', homeTeam: 'GER', awayTeam: 'JPN' },
  { matchId: 'group-e-2', stage: 'group', group: 'E', round: 'Matchday 1', kickoffTime: '2022-11-23T16:00:00Z', homeTeam: 'ESP', awayTeam: 'CRC' },
  { matchId: 'group-e-3', stage: 'group', group: 'E', round: 'Matchday 2', kickoffTime: '2022-11-27T10:00:00Z', homeTeam: 'JPN', awayTeam: 'CRC' },
  { matchId: 'group-e-4', stage: 'group', group: 'E', round: 'Matchday 2', kickoffTime: '2022-11-27T19:00:00Z', homeTeam: 'ESP', awayTeam: 'GER' },
  { matchId: 'group-e-5', stage: 'group', group: 'E', round: 'Matchday 3', kickoffTime: '2022-12-01T19:00:00Z', homeTeam: 'JPN', awayTeam: 'ESP' },
  { matchId: 'group-e-6', stage: 'group', group: 'E', round: 'Matchday 3', kickoffTime: '2022-12-01T19:00:00Z', homeTeam: 'CRC', awayTeam: 'GER' },
  { matchId: 'group-f-1', stage: 'group', group: 'F', round: 'Matchday 1', kickoffTime: '2022-11-23T10:00:00Z', homeTeam: 'MAR', awayTeam: 'CRO' },
  { matchId: 'group-f-2', stage: 'group', group: 'F', round: 'Matchday 1', kickoffTime: '2022-11-23T19:00:00Z', homeTeam: 'BEL', awayTeam: 'CAN' },
  { matchId: 'group-f-3', stage: 'group', group: 'F', round: 'Matchday 2', kickoffTime: '2022-11-27T13:00:00Z', homeTeam: 'BEL', awayTeam: 'MAR' },
  { matchId: 'group-f-4', stage: 'group', group: 'F', round: 'Matchday 2', kickoffTime: '2022-11-27T16:00:00Z', homeTeam: 'CRO', awayTeam: 'CAN' },
  { matchId: 'group-f-5', stage: 'group', group: 'F', round: 'Matchday 3', kickoffTime: '2022-12-01T15:00:00Z', homeTeam: 'CRO', awayTeam: 'BEL' },
  { matchId: 'group-f-6', stage: 'group', group: 'F', round: 'Matchday 3', kickoffTime: '2022-12-01T15:00:00Z', homeTeam: 'CAN', awayTeam: 'MAR' },
  { matchId: 'group-g-1', stage: 'group', group: 'G', round: 'Matchday 1', kickoffTime: '2022-11-24T10:00:00Z', homeTeam: 'SUI', awayTeam: 'CMR' },
  { matchId: 'group-g-2', stage: 'group', group: 'G', round: 'Matchday 1', kickoffTime: '2022-11-24T19:00:00Z', homeTeam: 'BRA', awayTeam: 'SRB' },
  { matchId: 'group-g-3', stage: 'group', group: 'G', round: 'Matchday 2', kickoffTime: '2022-11-28T10:00:00Z', homeTeam: 'CMR', awayTeam: 'SRB' },
  { matchId: 'group-g-4', stage: 'group', group: 'G', round: 'Matchday 2', kickoffTime: '2022-11-28T16:00:00Z', homeTeam: 'BRA', awayTeam: 'SUI' },
  { matchId: 'group-g-5', stage: 'group', group: 'G', round: 'Matchday 3', kickoffTime: '2022-12-02T19:00:00Z', homeTeam: 'SRB', awayTeam: 'SUI' },
  { matchId: 'group-g-6', stage: 'group', group: 'G', round: 'Matchday 3', kickoffTime: '2022-12-02T19:00:00Z', homeTeam: 'CMR', awayTeam: 'BRA' },
  { matchId: 'group-h-1', stage: 'group', group: 'H', round: 'Matchday 1', kickoffTime: '2022-11-24T13:00:00Z', homeTeam: 'URU', awayTeam: 'KOR' },
  { matchId: 'group-h-2', stage: 'group', group: 'H', round: 'Matchday 1', kickoffTime: '2022-11-24T16:00:00Z', homeTeam: 'POR', awayTeam: 'GHA' },
  { matchId: 'group-h-3', stage: 'group', group: 'H', round: 'Matchday 2', kickoffTime: '2022-11-28T13:00:00Z', homeTeam: 'KOR', awayTeam: 'GHA' },
  { matchId: 'group-h-4', stage: 'group', group: 'H', round: 'Matchday 2', kickoffTime: '2022-11-28T19:00:00Z', homeTeam: 'POR', awayTeam: 'URU' },
  { matchId: 'group-h-5', stage: 'group', group: 'H', round: 'Matchday 3', kickoffTime: '2022-12-02T15:00:00Z', homeTeam: 'KOR', awayTeam: 'POR' },
  { matchId: 'group-h-6', stage: 'group', group: 'H', round: 'Matchday 3', kickoffTime: '2022-12-02T15:00:00Z', homeTeam: 'GHA', awayTeam: 'URU' },
  { matchId: 'r16-1', stage: 'r16', round: 'Round of 16', kickoffTime: '2022-12-03T15:00:00Z', homeTeam: 'GROUP_A_W', awayTeam: 'GROUP_B_RU' },
  { matchId: 'r16-2', stage: 'r16', round: 'Round of 16', kickoffTime: '2022-12-03T19:00:00Z', homeTeam: 'GROUP_C_W', awayTeam: 'GROUP_D_RU' },
  { matchId: 'r16-3', stage: 'r16', round: 'Round of 16', kickoffTime: '2022-12-04T15:00:00Z', homeTeam: 'GROUP_D_W', awayTeam: 'GROUP_C_RU' },
  { matchId: 'r16-4', stage: 'r16', round: 'Round of 16', kickoffTime: '2022-12-04T19:00:00Z', homeTeam: 'GROUP_B_W', awayTeam: 'GROUP_A_RU' },
  { matchId: 'r16-5', stage: 'r16', round: 'Round of 16', kickoffTime: '2022-12-05T15:00:00Z', homeTeam: 'GROUP_E_W', awayTeam: 'GROUP_F_RU' },
  { matchId: 'r16-6', stage: 'r16', round: 'Round of 16', kickoffTime: '2022-12-05T19:00:00Z', homeTeam: 'GROUP_G_W', awayTeam: 'GROUP_H_RU' },
  { matchId: 'r16-7', stage: 'r16', round: 'Round of 16', kickoffTime: '2022-12-06T15:00:00Z', homeTeam: 'GROUP_F_W', awayTeam: 'GROUP_E_RU' },
  { matchId: 'r16-8', stage: 'r16', round: 'Round of 16', kickoffTime: '2022-12-06T19:00:00Z', homeTeam: 'GROUP_H_W', awayTeam: 'GROUP_G_RU' },
  { matchId: 'qf-1', stage: 'qf', round: 'Quarter-final', kickoffTime: '2022-12-09T15:00:00Z', homeTeam: 'R16_1_W', awayTeam: 'R16_2_W' },
  { matchId: 'qf-2', stage: 'qf', round: 'Quarter-final', kickoffTime: '2022-12-09T19:00:00Z', homeTeam: 'R16_5_W', awayTeam: 'R16_6_W' },
  { matchId: 'qf-3', stage: 'qf', round: 'Quarter-final', kickoffTime: '2022-12-10T15:00:00Z', homeTeam: 'R16_7_W', awayTeam: 'R16_8_W' },
  { matchId: 'qf-4', stage: 'qf', round: 'Quarter-final', kickoffTime: '2022-12-10T19:00:00Z', homeTeam: 'R16_3_W', awayTeam: 'R16_4_W' },
  { matchId: 'sf-1', stage: 'sf', round: 'Semi-final', kickoffTime: '2022-12-13T19:00:00Z', homeTeam: 'QF_1_W', awayTeam: 'QF_2_W' },
  { matchId: 'sf-2', stage: 'sf', round: 'Semi-final', kickoffTime: '2022-12-14T19:00:00Z', homeTeam: 'QF_3_W', awayTeam: 'QF_4_W' },
  { matchId: 'final-2', stage: 'final', round: 'Third-place playoff', label: 'Third-place playoff', kickoffTime: '2022-12-17T15:00:00Z', homeTeam: 'SF_1_L', awayTeam: 'SF_2_L' },
  { matchId: 'final-1', stage: 'final', round: 'Final', kickoffTime: '2022-12-18T15:00:00Z', homeTeam: 'SF_1_W', awayTeam: 'SF_2_W' },
];

export const WORLDCUP_MATCHES: WorldCupMatch[] = RAW_WORLDCUP_MATCHES.map(
  (match) => ({
    ...match,
    sportsDbEventId: CONFIRMED_SPORTSDB_EVENT_IDS[match.matchId] ?? null,
  }),
);

const TEAM_INDEX = new Map(
  WORLDCUP_TEAMS.map((team) => [team.id, team] as const),
);

const MATCH_INDEX = new Map(
  WORLDCUP_MATCHES.map((match) => [match.matchId, match] as const),
);

const WORLD_CUP_STAGES: WorldCupStage[] = [
  'group',
  'r16',
  'qf',
  'sf',
  'final',
  'winner',
];

const STAGE_INDEX = new Map<WorldCupStage, WorldCupMatch[]>(
  WORLD_CUP_STAGES.map((stage) => [
    stage,
    WORLDCUP_MATCHES.filter((match) => match.stage === stage),
  ]),
);

export function MATCH_BY_ID(matchId: string): WorldCupMatch | undefined {
  return MATCH_INDEX.get(matchId);
}

export function MATCHES_BY_STAGE(stage: WorldCupStage): WorldCupMatch[] {
  return STAGE_INDEX.get(stage) ?? [];
}

export function sportsDbEventIdForMatch(matchId: string): string | null {
  return MATCH_INDEX.get(matchId)?.sportsDbEventId ?? null;
}

const PLACEHOLDER_LABELS: Record<WorldCupPlaceholder, string> = {
  GROUP_A_W: 'A1',
  GROUP_A_RU: 'A2',
  GROUP_B_W: 'B1',
  GROUP_B_RU: 'B2',
  GROUP_C_W: 'C1',
  GROUP_C_RU: 'C2',
  GROUP_D_W: 'D1',
  GROUP_D_RU: 'D2',
  GROUP_E_W: 'E1',
  GROUP_E_RU: 'E2',
  GROUP_F_W: 'F1',
  GROUP_F_RU: 'F2',
  GROUP_G_W: 'G1',
  GROUP_G_RU: 'G2',
  GROUP_H_W: 'H1',
  GROUP_H_RU: 'H2',
  R16_1_W: 'R16-1 胜者',
  R16_2_W: 'R16-2 胜者',
  R16_3_W: 'R16-3 胜者',
  R16_4_W: 'R16-4 胜者',
  R16_5_W: 'R16-5 胜者',
  R16_6_W: 'R16-6 胜者',
  R16_7_W: 'R16-7 胜者',
  R16_8_W: 'R16-8 胜者',
  QF_1_W: 'QF1 胜者',
  QF_2_W: 'QF2 胜者',
  QF_3_W: 'QF3 胜者',
  QF_4_W: 'QF4 胜者',
  SF_1_W: 'SF1 胜者',
  SF_2_W: 'SF2 胜者',
  SF_1_L: 'SF1 负者',
  SF_2_L: 'SF2 负者',
};

export function findWorldCupTeam(
  participant: WorldCupParticipant,
): WorldCupTeam | undefined {
  return TEAM_INDEX.get(participant as WorldCupTeam['id']);
}

export function worldCupParticipantLabel(
  participant: WorldCupParticipant,
): string {
  return findWorldCupTeam(participant)?.shortNameZh ?? PLACEHOLDER_LABELS[participant as WorldCupPlaceholder] ?? participant;
}

export function worldCupParticipantCode(
  participant: WorldCupParticipant,
): string {
  return findWorldCupTeam(participant)?.id ?? PLACEHOLDER_LABELS[participant as WorldCupPlaceholder] ?? participant;
}
