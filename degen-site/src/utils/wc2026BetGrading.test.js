import {
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
});
