import {
  computeSlatePlayStats,
  gradePlay,
  handicapCovers,
  overHalfLineWins,
} from './wc2026BetGrading.js';

describe('wc2026BetGrading', () => {
  const mexEng = { homeTeam: 'Mexico', awayTeam: 'England', cornersHome: 12, cornersAway: 2 };

  test('grades game total under', () => {
    expect(gradePlay({
      marketType: 'game_total',
      side: 'Under',
      line: 9.5,
    }, mexEng)).toBe('L');
    expect(gradePlay({
      marketType: 'game_total',
      side: 'Under',
      line: 14.5,
    }, mexEng)).toBe('W');
  });

  test('grades team total', () => {
    expect(gradePlay({
      marketType: 'team_total',
      team: 'England',
      side: 'Under',
      line: 4.5,
    }, mexEng)).toBe('W');
    expect(gradePlay({
      marketType: 'team_total',
      team: 'Mexico',
      side: 'Over',
      line: 7.5,
    }, mexEng)).toBe('W');
  });

  test('grades handicap', () => {
    expect(handicapCovers(12, 2, -2.5)).toBe(true);
    expect(gradePlay({
      marketType: 'handicap',
      team: 'Mexico',
      side: 'Handicap',
      line: -2.5,
    }, mexEng)).toBe('W');
  });

  test('over half line threshold', () => {
    expect(overHalfLineWins(10, 8.5)).toBe(true);
    expect(overHalfLineWins(8, 8.5)).toBe(false);
  });

  test('computeSlatePlayStats aggregates graded plays', () => {
    const plays = [
      { grade: 'W', tier: 1, tierProfit: 0.9, evPct: 0.12 },
      { grade: 'L', tier: 2, tierProfit: -2, evPct: 0.15 },
      { grade: null, tier: 1 },
    ];
    const stats = computeSlatePlayStats(plays);
    expect(stats.record).toBe('1-1');
    expect(stats.unitsPL).toBeCloseTo(-1.1);
    expect(stats.pending).toBe(1);
  });
});
