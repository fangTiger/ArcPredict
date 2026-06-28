import { describe, expect, test } from 'vitest';

import {
  MATCHES_BY_STAGE,
  MATCH_BY_ID,
  WORLDCUP_MATCHES,
  WORLDCUP_TEAMS,
} from '../lib/worldcup-seed';
import { flagIconUrlForTeam } from '../lib/flag-icons';

describe('worldcup-seed', () => {
  test('导出完整赛程与阶段 helper', () => {
    expect(WORLDCUP_TEAMS).toHaveLength(48);
    expect(new Set(WORLDCUP_TEAMS.map((team) => team.group))).toEqual(
      new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']),
    );
    expect(WORLDCUP_MATCHES).toHaveLength(104);
    expect(MATCHES_BY_STAGE('group')).toHaveLength(72);
    expect(MATCHES_BY_STAGE('r32')).toHaveLength(16);
    expect(MATCHES_BY_STAGE('r16')).toHaveLength(8);
    expect(MATCHES_BY_STAGE('qf')).toHaveLength(4);
    expect(MATCHES_BY_STAGE('sf')).toHaveLength(2);
    expect(MATCHES_BY_STAGE('final')).toHaveLength(2);
    expect(MATCHES_BY_STAGE('winner')).toHaveLength(0);
    expect(MATCH_BY_ID('group-a-1')).toMatchObject({
      matchId: 'group-a-1',
      stage: 'group',
      kickoffTime: '2026-06-11T19:00:00Z',
      homeTeam: 'MEX',
      awayTeam: 'RSA',
    });
    expect(MATCH_BY_ID('missing-match')).toBeUndefined();
  });

  test('淘汰赛结构稳定', () => {
    expect(MATCH_BY_ID('r32-1')).toMatchObject({
      homeTeam: 'RSA',
      awayTeam: 'CAN',
      stage: 'r32',
      round: 'Round of 32',
      kickoffTime: '2026-06-28T19:00:00Z',
    });
    expect(MATCH_BY_ID('r32-7')).toMatchObject({
      homeTeam: 'MEX',
      awayTeam: 'ECU',
    });
    expect(MATCH_BY_ID('r32-8')).toMatchObject({
      homeTeam: 'ENG',
      awayTeam: 'COD',
    });
    expect(MATCH_BY_ID('r32-9')).toMatchObject({
      homeTeam: 'BEL',
      awayTeam: 'SEN',
    });
    expect(MATCH_BY_ID('r32-11')).toMatchObject({
      homeTeam: 'ESP',
      awayTeam: 'AUT',
    });
    expect(MATCH_BY_ID('r32-12')).toMatchObject({
      homeTeam: 'POR',
      awayTeam: 'CRO',
    });
    expect(MATCH_BY_ID('r32-13')).toMatchObject({
      homeTeam: 'SUI',
      awayTeam: 'ALG',
    });
    expect(MATCH_BY_ID('r32-16')).toMatchObject({
      homeTeam: 'COL',
      awayTeam: 'GHA',
    });
    expect(MATCH_BY_ID('final-2')).toMatchObject({
      stage: 'final',
      homeTeam: 'MATCH_101_L',
      awayTeam: 'MATCH_102_L',
      label: 'Match for third place',
      round: 'Match for third place',
      sportsDbEventId: null,
    });
    expect(MATCH_BY_ID('r16-1')).toMatchObject({
      homeTeam: 'MATCH_73_W',
      awayTeam: 'MATCH_75_W',
      stage: 'r16',
      sportsDbEventId: null,
    });
    expect(MATCH_BY_ID('winner-1')).toBeUndefined();
  });

  test('每支世界杯队伍都有可用国旗 logo', () => {
    const missingFlagTeams = WORLDCUP_TEAMS.filter((team) => !flagIconUrlForTeam(team.id));

    expect(missingFlagTeams).toEqual([]);
  });
});
