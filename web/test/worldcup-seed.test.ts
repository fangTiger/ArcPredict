import { describe, expect, test } from 'vitest';

import {
  MATCHES_BY_STAGE,
  MATCH_BY_ID,
  WORLDCUP_MATCHES,
  WORLDCUP_TEAMS,
} from '../lib/worldcup-seed';

describe('worldcup-seed', () => {
  test('导出完整赛程与阶段 helper', () => {
    expect(WORLDCUP_TEAMS).toHaveLength(32);
    expect(WORLDCUP_MATCHES).toHaveLength(64);
    expect(MATCHES_BY_STAGE('group')).toHaveLength(48);
    expect(MATCHES_BY_STAGE('r16')).toHaveLength(8);
    expect(MATCHES_BY_STAGE('qf')).toHaveLength(4);
    expect(MATCHES_BY_STAGE('sf')).toHaveLength(2);
    expect(MATCHES_BY_STAGE('final')).toHaveLength(2);
    expect(MATCHES_BY_STAGE('winner')).toHaveLength(0);
    expect(MATCH_BY_ID('group-a-1')).toMatchObject({
      matchId: 'group-a-1',
      stage: 'group',
      sportsDbEventId: '1543883',
    });
    expect(MATCH_BY_ID('missing-match')).toBeUndefined();
  });

  test('淘汰赛占位符结构稳定', () => {
    expect(MATCH_BY_ID('r16-1')).toMatchObject({
      homeTeam: 'GROUP_A_W',
      awayTeam: 'GROUP_B_RU',
      stage: 'r16',
    });
    expect(MATCH_BY_ID('final-2')).toMatchObject({
      stage: 'final',
      homeTeam: 'SF_1_L',
      awayTeam: 'SF_2_L',
      label: 'Third-place playoff',
      round: 'Third-place playoff',
      sportsDbEventId: null,
    });
    expect(MATCH_BY_ID('r16-1')).toMatchObject({
      sportsDbEventId: '1665048',
    });
    expect(MATCH_BY_ID('winner-1')).toBeUndefined();
  });
});
