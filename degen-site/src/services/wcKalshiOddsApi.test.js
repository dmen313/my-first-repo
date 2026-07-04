import {
  kalshiThresholdToPoint,
  parseKalshiEventTeams,
  parseKalshiTeamMarketTitle,
} from '../services/wcKalshiOddsApi.js';
import { fairAmerican } from '../utils/wc2026Pricing.js';

describe('wcKalshiOddsApi', () => {
  test('parseKalshiEventTeams extracts normalized names', () => {
    expect(parseKalshiEventTeams('Mexico vs England: Total Corners')).toEqual(['Mexico', 'England']);
    expect(parseKalshiEventTeams('United States vs Belgium: Team Corners')).toEqual(['USA', 'Belgium']);
  });

  test('parseKalshiTeamMarketTitle extracts team', () => {
    expect(parseKalshiTeamMarketTitle('Mexico: 8+ corners')).toBe('Mexico');
    expect(parseKalshiTeamMarketTitle('USA: 7+ corners')).toBe('USA');
  });

  test('kalshiThresholdToPoint maps N+ to half-point line', () => {
    expect(kalshiThresholdToPoint(9)).toBe(8.5);
    expect(kalshiThresholdToPoint(7)).toBe(6.5);
  });

  test('fairAmerican round-trip for Kalshi ask prices', () => {
    expect(fairAmerican(0.68)).toBe(-213);
    expect(fairAmerican(0.32)).toBe(213);
  });
});
