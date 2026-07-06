import { computeMatchup, isKnockoutStage } from './wc2026MatchupEngine.js';

const baseTeam = (name, overrides = {}) => ({
  team: name,
  elo: 1700,
  adjAttack: 4.5,
  adjDefense: 4.5,
  phi: 1.2,
  games: 2,
  ...overrides,
});

describe('wc2026MatchupEngine calibration', () => {
  test('isKnockoutStage detects July fixtures', () => {
    expect(isKnockoutStage({ commenceTime: '2026-07-04T20:00:00Z' }, baseTeam('A'), baseTeam('B'))).toBe(true);
    expect(isKnockoutStage({ commenceTime: '2026-06-20T20:00:00Z' }, baseTeam('A'), baseTeam('B'))).toBe(false);
  });

  test('isKnockoutStage detects teams past group stage', () => {
    expect(isKnockoutStage(null, baseTeam('A', { games: 3 }), baseTeam('B', { games: 3 }))).toBe(true);
  });

  test('knockout multiplier raises lambdas', () => {
    const params = { 'KNOCKOUT_LAMBDA_MULT': { value: 1.1 } };
    const group = computeMatchup(baseTeam('A'), baseTeam('B'), params, 1, 1, {
      fixture: { commenceTime: '2026-06-15T00:00:00Z' },
    });
    const knockout = computeMatchup(baseTeam('A'), baseTeam('B'), params, 1, 1, {
      fixture: { commenceTime: '2026-07-05T00:00:00Z' },
    });
    expect(knockout.lambdaTotal).toBeGreaterThan(group.lambdaTotal);
    expect(knockout.knockoutStage).toBe(true);
  });

  test('recent-form bump when both teams hot', () => {
    const params = { 'RECENT_FORM_LAMBDA_BUMP': { value: 0.5 } };
    const cold = computeMatchup(
      baseTeam('A', { recentCornersFor: 4 }),
      baseTeam('B', { recentCornersFor: 4 }),
      params
    );
    const hot = computeMatchup(
      baseTeam('A', { adjAttack: 4, recentCornersFor: 6 }),
      baseTeam('B', { adjAttack: 4, recentCornersFor: 6 }),
      params
    );
    expect(hot.lambdaTotal).toBeGreaterThan(cold.lambdaTotal);
  });
});
