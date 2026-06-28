import type { WorldCupStage } from './market-kind';

type GroupCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export type WorldCupTeam = {
  id: string;
  iso2: string;
  flagCode: string;
  nameEn: string;
  shortNameZh: string;
  group: GroupCode;
};

export type WorldCupPlaceholder = `GROUP_${GroupCode}_${'W' | 'RU'}` | `GROUP_${string}_3` | `MATCH_${number}_${'W' | 'L'}`;

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

// 英格兰与苏格兰没有独立 ISO 3166-1 alpha-2，沿用 GB 并单独提供 flagCode。
export const WORLDCUP_TEAMS: WorldCupTeam[] = [
  { id: 'MEX', iso2: 'MX', flagCode: 'mx', shortNameZh: '墨西哥', nameEn: 'Mexico', group: 'A' },
  { id: 'RSA', iso2: 'ZA', flagCode: 'za', shortNameZh: '南非', nameEn: 'South Africa', group: 'A' },
  { id: 'KOR', iso2: 'KR', flagCode: 'kr', shortNameZh: '韩国', nameEn: 'South Korea', group: 'A' },
  { id: 'CZE', iso2: 'CZ', flagCode: 'cz', shortNameZh: '捷克', nameEn: 'Czech Republic', group: 'A' },
  { id: 'SUI', iso2: 'CH', flagCode: 'ch', shortNameZh: '瑞士', nameEn: 'Switzerland', group: 'B' },
  { id: 'CAN', iso2: 'CA', flagCode: 'ca', shortNameZh: '加拿大', nameEn: 'Canada', group: 'B' },
  { id: 'BIH', iso2: 'BA', flagCode: 'ba', shortNameZh: '波黑', nameEn: 'Bosnia and Herzegovina', group: 'B' },
  { id: 'QAT', iso2: 'QA', flagCode: 'qa', shortNameZh: '卡塔尔', nameEn: 'Qatar', group: 'B' },
  { id: 'BRA', iso2: 'BR', flagCode: 'br', shortNameZh: '巴西', nameEn: 'Brazil', group: 'C' },
  { id: 'MAR', iso2: 'MA', flagCode: 'ma', shortNameZh: '摩洛哥', nameEn: 'Morocco', group: 'C' },
  { id: 'SCO', iso2: 'GB', flagCode: 'gb-sct', shortNameZh: '苏格兰', nameEn: 'Scotland', group: 'C' },
  { id: 'HAI', iso2: 'HT', flagCode: 'ht', shortNameZh: '海地', nameEn: 'Haiti', group: 'C' },
  { id: 'USA', iso2: 'US', flagCode: 'us', shortNameZh: '美国', nameEn: 'United States', group: 'D' },
  { id: 'AUS', iso2: 'AU', flagCode: 'au', shortNameZh: '澳大利亚', nameEn: 'Australia', group: 'D' },
  { id: 'PAR', iso2: 'PY', flagCode: 'py', shortNameZh: '巴拉圭', nameEn: 'Paraguay', group: 'D' },
  { id: 'TUR', iso2: 'TR', flagCode: 'tr', shortNameZh: '土耳其', nameEn: 'Turkey', group: 'D' },
  { id: 'GER', iso2: 'DE', flagCode: 'de', shortNameZh: '德国', nameEn: 'Germany', group: 'E' },
  { id: 'CIV', iso2: 'CI', flagCode: 'ci', shortNameZh: '科特迪瓦', nameEn: 'Ivory Coast', group: 'E' },
  { id: 'ECU', iso2: 'EC', flagCode: 'ec', shortNameZh: '厄瓜多尔', nameEn: 'Ecuador', group: 'E' },
  { id: 'CUW', iso2: 'CW', flagCode: 'cw', shortNameZh: '库拉索', nameEn: 'Curaçao', group: 'E' },
  { id: 'NED', iso2: 'NL', flagCode: 'nl', shortNameZh: '荷兰', nameEn: 'Netherlands', group: 'F' },
  { id: 'JPN', iso2: 'JP', flagCode: 'jp', shortNameZh: '日本', nameEn: 'Japan', group: 'F' },
  { id: 'SWE', iso2: 'SE', flagCode: 'se', shortNameZh: '瑞典', nameEn: 'Sweden', group: 'F' },
  { id: 'TUN', iso2: 'TN', flagCode: 'tn', shortNameZh: '突尼斯', nameEn: 'Tunisia', group: 'F' },
  { id: 'BEL', iso2: 'BE', flagCode: 'be', shortNameZh: '比利时', nameEn: 'Belgium', group: 'G' },
  { id: 'EGY', iso2: 'EG', flagCode: 'eg', shortNameZh: '埃及', nameEn: 'Egypt', group: 'G' },
  { id: 'IRN', iso2: 'IR', flagCode: 'ir', shortNameZh: '伊朗', nameEn: 'Iran', group: 'G' },
  { id: 'NZL', iso2: 'NZ', flagCode: 'nz', shortNameZh: '新西兰', nameEn: 'New Zealand', group: 'G' },
  { id: 'ESP', iso2: 'ES', flagCode: 'es', shortNameZh: '西班牙', nameEn: 'Spain', group: 'H' },
  { id: 'CPV', iso2: 'CV', flagCode: 'cv', shortNameZh: '佛得角', nameEn: 'Cape Verde', group: 'H' },
  { id: 'URU', iso2: 'UY', flagCode: 'uy', shortNameZh: '乌拉圭', nameEn: 'Uruguay', group: 'H' },
  { id: 'KSA', iso2: 'SA', flagCode: 'sa', shortNameZh: '沙特', nameEn: 'Saudi Arabia', group: 'H' },
  { id: 'FRA', iso2: 'FR', flagCode: 'fr', shortNameZh: '法国', nameEn: 'France', group: 'I' },
  { id: 'NOR', iso2: 'NO', flagCode: 'no', shortNameZh: '挪威', nameEn: 'Norway', group: 'I' },
  { id: 'SEN', iso2: 'SN', flagCode: 'sn', shortNameZh: '塞内加尔', nameEn: 'Senegal', group: 'I' },
  { id: 'IRQ', iso2: 'IQ', flagCode: 'iq', shortNameZh: '伊拉克', nameEn: 'Iraq', group: 'I' },
  { id: 'ARG', iso2: 'AR', flagCode: 'ar', shortNameZh: '阿根廷', nameEn: 'Argentina', group: 'J' },
  { id: 'AUT', iso2: 'AT', flagCode: 'at', shortNameZh: '奥地利', nameEn: 'Austria', group: 'J' },
  { id: 'ALG', iso2: 'DZ', flagCode: 'dz', shortNameZh: '阿尔及利亚', nameEn: 'Algeria', group: 'J' },
  { id: 'JOR', iso2: 'JO', flagCode: 'jo', shortNameZh: '约旦', nameEn: 'Jordan', group: 'J' },
  { id: 'COL', iso2: 'CO', flagCode: 'co', shortNameZh: '哥伦比亚', nameEn: 'Colombia', group: 'K' },
  { id: 'POR', iso2: 'PT', flagCode: 'pt', shortNameZh: '葡萄牙', nameEn: 'Portugal', group: 'K' },
  { id: 'COD', iso2: 'CD', flagCode: 'cd', shortNameZh: '刚果民主共和国', nameEn: 'DR Congo', group: 'K' },
  { id: 'UZB', iso2: 'UZ', flagCode: 'uz', shortNameZh: '乌兹别克斯坦', nameEn: 'Uzbekistan', group: 'K' },
  { id: 'ENG', iso2: 'GB', flagCode: 'gb-eng', shortNameZh: '英格兰', nameEn: 'England', group: 'L' },
  { id: 'GHA', iso2: 'GH', flagCode: 'gh', shortNameZh: '加纳', nameEn: 'Ghana', group: 'L' },
  { id: 'CRO', iso2: 'HR', flagCode: 'hr', shortNameZh: '克罗地亚', nameEn: 'Croatia', group: 'L' },
  { id: 'PAN', iso2: 'PA', flagCode: 'pa', shortNameZh: '巴拿马', nameEn: 'Panama', group: 'L' },
];

const CONFIRMED_SPORTSDB_EVENT_IDS: Record<string, string> = {};

const RAW_WORLDCUP_MATCHES: RawWorldCupMatch[] = [
  { matchId: 'group-a-1', stage: 'group', group: 'A', round: 'Matchday 1', kickoffTime: '2026-06-11T19:00:00Z', homeTeam: 'MEX', awayTeam: 'RSA' },
  { matchId: 'group-a-2', stage: 'group', group: 'A', round: 'Matchday 1', kickoffTime: '2026-06-12T02:00:00Z', homeTeam: 'KOR', awayTeam: 'CZE' },
  { matchId: 'group-a-3', stage: 'group', group: 'A', round: 'Matchday 2', kickoffTime: '2026-06-18T16:00:00Z', homeTeam: 'CZE', awayTeam: 'RSA' },
  { matchId: 'group-a-4', stage: 'group', group: 'A', round: 'Matchday 2', kickoffTime: '2026-06-19T01:00:00Z', homeTeam: 'MEX', awayTeam: 'KOR' },
  { matchId: 'group-a-5', stage: 'group', group: 'A', round: 'Matchday 3', kickoffTime: '2026-06-25T01:00:00Z', homeTeam: 'CZE', awayTeam: 'MEX' },
  { matchId: 'group-a-6', stage: 'group', group: 'A', round: 'Matchday 3', kickoffTime: '2026-06-25T01:00:00Z', homeTeam: 'RSA', awayTeam: 'KOR' },
  { matchId: 'group-b-1', stage: 'group', group: 'B', round: 'Matchday 1', kickoffTime: '2026-06-12T19:00:00Z', homeTeam: 'CAN', awayTeam: 'BIH' },
  { matchId: 'group-b-2', stage: 'group', group: 'B', round: 'Matchday 1', kickoffTime: '2026-06-13T19:00:00Z', homeTeam: 'QAT', awayTeam: 'SUI' },
  { matchId: 'group-b-3', stage: 'group', group: 'B', round: 'Matchday 2', kickoffTime: '2026-06-18T19:00:00Z', homeTeam: 'SUI', awayTeam: 'BIH' },
  { matchId: 'group-b-4', stage: 'group', group: 'B', round: 'Matchday 2', kickoffTime: '2026-06-18T22:00:00Z', homeTeam: 'CAN', awayTeam: 'QAT' },
  { matchId: 'group-b-5', stage: 'group', group: 'B', round: 'Matchday 3', kickoffTime: '2026-06-24T19:00:00Z', homeTeam: 'SUI', awayTeam: 'CAN' },
  { matchId: 'group-b-6', stage: 'group', group: 'B', round: 'Matchday 3', kickoffTime: '2026-06-24T19:00:00Z', homeTeam: 'BIH', awayTeam: 'QAT' },
  { matchId: 'group-c-1', stage: 'group', group: 'C', round: 'Matchday 1', kickoffTime: '2026-06-13T22:00:00Z', homeTeam: 'BRA', awayTeam: 'MAR' },
  { matchId: 'group-c-2', stage: 'group', group: 'C', round: 'Matchday 1', kickoffTime: '2026-06-14T01:00:00Z', homeTeam: 'HAI', awayTeam: 'SCO' },
  { matchId: 'group-c-3', stage: 'group', group: 'C', round: 'Matchday 2', kickoffTime: '2026-06-19T22:00:00Z', homeTeam: 'SCO', awayTeam: 'MAR' },
  { matchId: 'group-c-4', stage: 'group', group: 'C', round: 'Matchday 2', kickoffTime: '2026-06-20T00:30:00Z', homeTeam: 'BRA', awayTeam: 'HAI' },
  { matchId: 'group-c-5', stage: 'group', group: 'C', round: 'Matchday 3', kickoffTime: '2026-06-24T22:00:00Z', homeTeam: 'SCO', awayTeam: 'BRA' },
  { matchId: 'group-c-6', stage: 'group', group: 'C', round: 'Matchday 3', kickoffTime: '2026-06-24T22:00:00Z', homeTeam: 'MAR', awayTeam: 'HAI' },
  { matchId: 'group-d-1', stage: 'group', group: 'D', round: 'Matchday 1', kickoffTime: '2026-06-13T01:00:00Z', homeTeam: 'USA', awayTeam: 'PAR' },
  { matchId: 'group-d-2', stage: 'group', group: 'D', round: 'Matchday 1', kickoffTime: '2026-06-14T04:00:00Z', homeTeam: 'AUS', awayTeam: 'TUR' },
  { matchId: 'group-d-3', stage: 'group', group: 'D', round: 'Matchday 2', kickoffTime: '2026-06-19T19:00:00Z', homeTeam: 'USA', awayTeam: 'AUS' },
  { matchId: 'group-d-4', stage: 'group', group: 'D', round: 'Matchday 2', kickoffTime: '2026-06-20T03:00:00Z', homeTeam: 'TUR', awayTeam: 'PAR' },
  { matchId: 'group-d-5', stage: 'group', group: 'D', round: 'Matchday 3', kickoffTime: '2026-06-26T02:00:00Z', homeTeam: 'TUR', awayTeam: 'USA' },
  { matchId: 'group-d-6', stage: 'group', group: 'D', round: 'Matchday 3', kickoffTime: '2026-06-26T02:00:00Z', homeTeam: 'PAR', awayTeam: 'AUS' },
  { matchId: 'group-e-1', stage: 'group', group: 'E', round: 'Matchday 1', kickoffTime: '2026-06-14T17:00:00Z', homeTeam: 'GER', awayTeam: 'CUW' },
  { matchId: 'group-e-2', stage: 'group', group: 'E', round: 'Matchday 1', kickoffTime: '2026-06-14T23:00:00Z', homeTeam: 'CIV', awayTeam: 'ECU' },
  { matchId: 'group-e-3', stage: 'group', group: 'E', round: 'Matchday 2', kickoffTime: '2026-06-20T20:00:00Z', homeTeam: 'GER', awayTeam: 'CIV' },
  { matchId: 'group-e-4', stage: 'group', group: 'E', round: 'Matchday 2', kickoffTime: '2026-06-21T00:00:00Z', homeTeam: 'ECU', awayTeam: 'CUW' },
  { matchId: 'group-e-5', stage: 'group', group: 'E', round: 'Matchday 3', kickoffTime: '2026-06-25T20:00:00Z', homeTeam: 'CUW', awayTeam: 'CIV' },
  { matchId: 'group-e-6', stage: 'group', group: 'E', round: 'Matchday 3', kickoffTime: '2026-06-25T20:00:00Z', homeTeam: 'ECU', awayTeam: 'GER' },
  { matchId: 'group-f-1', stage: 'group', group: 'F', round: 'Matchday 1', kickoffTime: '2026-06-14T20:00:00Z', homeTeam: 'NED', awayTeam: 'JPN' },
  { matchId: 'group-f-2', stage: 'group', group: 'F', round: 'Matchday 1', kickoffTime: '2026-06-15T02:00:00Z', homeTeam: 'SWE', awayTeam: 'TUN' },
  { matchId: 'group-f-3', stage: 'group', group: 'F', round: 'Matchday 2', kickoffTime: '2026-06-20T17:00:00Z', homeTeam: 'NED', awayTeam: 'SWE' },
  { matchId: 'group-f-4', stage: 'group', group: 'F', round: 'Matchday 2', kickoffTime: '2026-06-21T04:00:00Z', homeTeam: 'TUN', awayTeam: 'JPN' },
  { matchId: 'group-f-5', stage: 'group', group: 'F', round: 'Matchday 3', kickoffTime: '2026-06-25T23:00:00Z', homeTeam: 'JPN', awayTeam: 'SWE' },
  { matchId: 'group-f-6', stage: 'group', group: 'F', round: 'Matchday 3', kickoffTime: '2026-06-25T23:00:00Z', homeTeam: 'TUN', awayTeam: 'NED' },
  { matchId: 'group-g-1', stage: 'group', group: 'G', round: 'Matchday 1', kickoffTime: '2026-06-15T19:00:00Z', homeTeam: 'BEL', awayTeam: 'EGY' },
  { matchId: 'group-g-2', stage: 'group', group: 'G', round: 'Matchday 1', kickoffTime: '2026-06-16T01:00:00Z', homeTeam: 'IRN', awayTeam: 'NZL' },
  { matchId: 'group-g-3', stage: 'group', group: 'G', round: 'Matchday 2', kickoffTime: '2026-06-21T19:00:00Z', homeTeam: 'BEL', awayTeam: 'IRN' },
  { matchId: 'group-g-4', stage: 'group', group: 'G', round: 'Matchday 2', kickoffTime: '2026-06-22T01:00:00Z', homeTeam: 'NZL', awayTeam: 'EGY' },
  { matchId: 'group-g-5', stage: 'group', group: 'G', round: 'Matchday 3', kickoffTime: '2026-06-27T03:00:00Z', homeTeam: 'EGY', awayTeam: 'IRN' },
  { matchId: 'group-g-6', stage: 'group', group: 'G', round: 'Matchday 3', kickoffTime: '2026-06-27T03:00:00Z', homeTeam: 'NZL', awayTeam: 'BEL' },
  { matchId: 'group-h-1', stage: 'group', group: 'H', round: 'Matchday 1', kickoffTime: '2026-06-15T16:00:00Z', homeTeam: 'ESP', awayTeam: 'CPV' },
  { matchId: 'group-h-2', stage: 'group', group: 'H', round: 'Matchday 1', kickoffTime: '2026-06-15T22:00:00Z', homeTeam: 'KSA', awayTeam: 'URU' },
  { matchId: 'group-h-3', stage: 'group', group: 'H', round: 'Matchday 2', kickoffTime: '2026-06-21T16:00:00Z', homeTeam: 'ESP', awayTeam: 'KSA' },
  { matchId: 'group-h-4', stage: 'group', group: 'H', round: 'Matchday 2', kickoffTime: '2026-06-21T22:00:00Z', homeTeam: 'URU', awayTeam: 'CPV' },
  { matchId: 'group-h-5', stage: 'group', group: 'H', round: 'Matchday 3', kickoffTime: '2026-06-27T00:00:00Z', homeTeam: 'CPV', awayTeam: 'KSA' },
  { matchId: 'group-h-6', stage: 'group', group: 'H', round: 'Matchday 3', kickoffTime: '2026-06-27T00:00:00Z', homeTeam: 'URU', awayTeam: 'ESP' },
  { matchId: 'group-i-1', stage: 'group', group: 'I', round: 'Matchday 1', kickoffTime: '2026-06-16T19:00:00Z', homeTeam: 'FRA', awayTeam: 'SEN' },
  { matchId: 'group-i-2', stage: 'group', group: 'I', round: 'Matchday 1', kickoffTime: '2026-06-16T22:00:00Z', homeTeam: 'IRQ', awayTeam: 'NOR' },
  { matchId: 'group-i-3', stage: 'group', group: 'I', round: 'Matchday 2', kickoffTime: '2026-06-22T21:00:00Z', homeTeam: 'FRA', awayTeam: 'IRQ' },
  { matchId: 'group-i-4', stage: 'group', group: 'I', round: 'Matchday 2', kickoffTime: '2026-06-23T00:00:00Z', homeTeam: 'NOR', awayTeam: 'SEN' },
  { matchId: 'group-i-5', stage: 'group', group: 'I', round: 'Matchday 3', kickoffTime: '2026-06-26T19:00:00Z', homeTeam: 'NOR', awayTeam: 'FRA' },
  { matchId: 'group-i-6', stage: 'group', group: 'I', round: 'Matchday 3', kickoffTime: '2026-06-26T19:00:00Z', homeTeam: 'SEN', awayTeam: 'IRQ' },
  { matchId: 'group-j-1', stage: 'group', group: 'J', round: 'Matchday 1', kickoffTime: '2026-06-17T01:00:00Z', homeTeam: 'ARG', awayTeam: 'ALG' },
  { matchId: 'group-j-2', stage: 'group', group: 'J', round: 'Matchday 1', kickoffTime: '2026-06-17T04:00:00Z', homeTeam: 'AUT', awayTeam: 'JOR' },
  { matchId: 'group-j-3', stage: 'group', group: 'J', round: 'Matchday 2', kickoffTime: '2026-06-22T17:00:00Z', homeTeam: 'ARG', awayTeam: 'AUT' },
  { matchId: 'group-j-4', stage: 'group', group: 'J', round: 'Matchday 2', kickoffTime: '2026-06-23T03:00:00Z', homeTeam: 'JOR', awayTeam: 'ALG' },
  { matchId: 'group-j-5', stage: 'group', group: 'J', round: 'Matchday 3', kickoffTime: '2026-06-28T02:00:00Z', homeTeam: 'ALG', awayTeam: 'AUT' },
  { matchId: 'group-j-6', stage: 'group', group: 'J', round: 'Matchday 3', kickoffTime: '2026-06-28T02:00:00Z', homeTeam: 'JOR', awayTeam: 'ARG' },
  { matchId: 'group-k-1', stage: 'group', group: 'K', round: 'Matchday 1', kickoffTime: '2026-06-17T17:00:00Z', homeTeam: 'POR', awayTeam: 'COD' },
  { matchId: 'group-k-2', stage: 'group', group: 'K', round: 'Matchday 1', kickoffTime: '2026-06-18T02:00:00Z', homeTeam: 'UZB', awayTeam: 'COL' },
  { matchId: 'group-k-3', stage: 'group', group: 'K', round: 'Matchday 2', kickoffTime: '2026-06-23T17:00:00Z', homeTeam: 'POR', awayTeam: 'UZB' },
  { matchId: 'group-k-4', stage: 'group', group: 'K', round: 'Matchday 2', kickoffTime: '2026-06-24T02:00:00Z', homeTeam: 'COL', awayTeam: 'COD' },
  { matchId: 'group-k-5', stage: 'group', group: 'K', round: 'Matchday 3', kickoffTime: '2026-06-27T23:30:00Z', homeTeam: 'COL', awayTeam: 'POR' },
  { matchId: 'group-k-6', stage: 'group', group: 'K', round: 'Matchday 3', kickoffTime: '2026-06-27T23:30:00Z', homeTeam: 'COD', awayTeam: 'UZB' },
  { matchId: 'group-l-1', stage: 'group', group: 'L', round: 'Matchday 1', kickoffTime: '2026-06-17T20:00:00Z', homeTeam: 'ENG', awayTeam: 'CRO' },
  { matchId: 'group-l-2', stage: 'group', group: 'L', round: 'Matchday 1', kickoffTime: '2026-06-17T23:00:00Z', homeTeam: 'GHA', awayTeam: 'PAN' },
  { matchId: 'group-l-3', stage: 'group', group: 'L', round: 'Matchday 2', kickoffTime: '2026-06-23T20:00:00Z', homeTeam: 'ENG', awayTeam: 'GHA' },
  { matchId: 'group-l-4', stage: 'group', group: 'L', round: 'Matchday 2', kickoffTime: '2026-06-23T23:00:00Z', homeTeam: 'PAN', awayTeam: 'CRO' },
  { matchId: 'group-l-5', stage: 'group', group: 'L', round: 'Matchday 3', kickoffTime: '2026-06-27T21:00:00Z', homeTeam: 'PAN', awayTeam: 'ENG' },
  { matchId: 'group-l-6', stage: 'group', group: 'L', round: 'Matchday 3', kickoffTime: '2026-06-27T21:00:00Z', homeTeam: 'CRO', awayTeam: 'GHA' },
  { matchId: 'r32-1', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-06-28T19:00:00Z', homeTeam: 'RSA', awayTeam: 'CAN' },
  { matchId: 'r32-2', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-06-29T17:00:00Z', homeTeam: 'BRA', awayTeam: 'JPN' },
  { matchId: 'r32-3', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-06-29T20:30:00Z', homeTeam: 'GER', awayTeam: 'PAR' },
  { matchId: 'r32-4', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-06-30T01:00:00Z', homeTeam: 'NED', awayTeam: 'MAR' },
  { matchId: 'r32-5', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-06-30T17:00:00Z', homeTeam: 'CIV', awayTeam: 'NOR' },
  { matchId: 'r32-6', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-06-30T21:00:00Z', homeTeam: 'FRA', awayTeam: 'SWE' },
  { matchId: 'r32-7', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-07-01T01:00:00Z', homeTeam: 'MEX', awayTeam: 'ECU' },
  { matchId: 'r32-8', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-07-01T16:00:00Z', homeTeam: 'ENG', awayTeam: 'COD' },
  { matchId: 'r32-9', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-07-01T20:00:00Z', homeTeam: 'BEL', awayTeam: 'SEN' },
  { matchId: 'r32-10', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-07-02T00:00:00Z', homeTeam: 'USA', awayTeam: 'BIH' },
  { matchId: 'r32-11', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-07-02T19:00:00Z', homeTeam: 'ESP', awayTeam: 'AUT' },
  { matchId: 'r32-12', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-07-02T23:00:00Z', homeTeam: 'POR', awayTeam: 'CRO' },
  { matchId: 'r32-13', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-07-03T03:00:00Z', homeTeam: 'SUI', awayTeam: 'ALG' },
  { matchId: 'r32-14', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-07-03T18:00:00Z', homeTeam: 'AUS', awayTeam: 'EGY' },
  { matchId: 'r32-15', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-07-03T22:00:00Z', homeTeam: 'ARG', awayTeam: 'CPV' },
  { matchId: 'r32-16', stage: 'r32', round: 'Round of 32', kickoffTime: '2026-07-04T01:30:00Z', homeTeam: 'COL', awayTeam: 'GHA' },
  { matchId: 'r16-1', stage: 'r16', round: 'Round of 16', kickoffTime: '2026-07-04T17:00:00Z', homeTeam: 'MATCH_73_W', awayTeam: 'MATCH_75_W' },
  { matchId: 'r16-2', stage: 'r16', round: 'Round of 16', kickoffTime: '2026-07-04T21:00:00Z', homeTeam: 'MATCH_74_W', awayTeam: 'MATCH_77_W' },
  { matchId: 'r16-3', stage: 'r16', round: 'Round of 16', kickoffTime: '2026-07-05T20:00:00Z', homeTeam: 'MATCH_76_W', awayTeam: 'MATCH_78_W' },
  { matchId: 'r16-4', stage: 'r16', round: 'Round of 16', kickoffTime: '2026-07-06T00:00:00Z', homeTeam: 'MATCH_79_W', awayTeam: 'MATCH_80_W' },
  { matchId: 'r16-5', stage: 'r16', round: 'Round of 16', kickoffTime: '2026-07-06T19:00:00Z', homeTeam: 'MATCH_83_W', awayTeam: 'MATCH_84_W' },
  { matchId: 'r16-6', stage: 'r16', round: 'Round of 16', kickoffTime: '2026-07-07T00:00:00Z', homeTeam: 'MATCH_81_W', awayTeam: 'MATCH_82_W' },
  { matchId: 'r16-7', stage: 'r16', round: 'Round of 16', kickoffTime: '2026-07-07T16:00:00Z', homeTeam: 'MATCH_86_W', awayTeam: 'MATCH_88_W' },
  { matchId: 'r16-8', stage: 'r16', round: 'Round of 16', kickoffTime: '2026-07-07T20:00:00Z', homeTeam: 'MATCH_85_W', awayTeam: 'MATCH_87_W' },
  { matchId: 'qf-1', stage: 'qf', round: 'Quarter-final', kickoffTime: '2026-07-09T20:00:00Z', homeTeam: 'MATCH_89_W', awayTeam: 'MATCH_90_W' },
  { matchId: 'qf-2', stage: 'qf', round: 'Quarter-final', kickoffTime: '2026-07-10T19:00:00Z', homeTeam: 'MATCH_93_W', awayTeam: 'MATCH_94_W' },
  { matchId: 'qf-3', stage: 'qf', round: 'Quarter-final', kickoffTime: '2026-07-11T21:00:00Z', homeTeam: 'MATCH_91_W', awayTeam: 'MATCH_92_W' },
  { matchId: 'qf-4', stage: 'qf', round: 'Quarter-final', kickoffTime: '2026-07-12T01:00:00Z', homeTeam: 'MATCH_95_W', awayTeam: 'MATCH_96_W' },
  { matchId: 'sf-1', stage: 'sf', round: 'Semi-final', kickoffTime: '2026-07-14T19:00:00Z', homeTeam: 'MATCH_97_W', awayTeam: 'MATCH_98_W' },
  { matchId: 'sf-2', stage: 'sf', round: 'Semi-final', kickoffTime: '2026-07-15T19:00:00Z', homeTeam: 'MATCH_99_W', awayTeam: 'MATCH_100_W' },
  { matchId: 'final-2', stage: 'final', round: 'Match for third place', label: 'Match for third place', kickoffTime: '2026-07-18T21:00:00Z', homeTeam: 'MATCH_101_L', awayTeam: 'MATCH_102_L' },
  { matchId: 'final-1', stage: 'final', round: 'Final', kickoffTime: '2026-07-19T19:00:00Z', homeTeam: 'MATCH_101_W', awayTeam: 'MATCH_102_W' },
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
  'r32',
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

function placeholderLabel(participant: WorldCupPlaceholder): string | null {
  const groupRank = /^GROUP_([A-L])_(W|RU)$/u.exec(participant);
  if (groupRank) {
    return `${groupRank[1]}${groupRank[2] === 'W' ? '1' : '2'}`;
  }

  const thirdPlace = /^GROUP_([A-L]{2,3})_3$/u.exec(participant);
  if (thirdPlace) {
    return `${thirdPlace[1].split('').join('/')} 第三名`;
  }

  const matchResult = /^MATCH_([0-9]+)_([WL])$/u.exec(participant);
  if (matchResult) {
    return `Match ${matchResult[1]} ${matchResult[2] === 'W' ? '胜者' : '负者'}`;
  }

  return null;
}

export function findWorldCupTeam(
  participant: WorldCupParticipant,
): WorldCupTeam | undefined {
  return TEAM_INDEX.get(participant as WorldCupTeam['id']);
}

export function worldCupParticipantLabel(
  participant: WorldCupParticipant,
): string {
  return findWorldCupTeam(participant)?.shortNameZh ?? placeholderLabel(participant as WorldCupPlaceholder) ?? participant;
}

export function worldCupParticipantCode(
  participant: WorldCupParticipant,
): string {
  return findWorldCupTeam(participant)?.id ?? placeholderLabel(participant as WorldCupPlaceholder) ?? participant;
}
