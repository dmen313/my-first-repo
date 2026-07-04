import {
  kalshiDisplayedNoProb,
  kalshiDisplayedYesProb,
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
    expect(kalshiThresholdToPoint(8)).toBe(7.5);
    expect(kalshiThresholdToPoint(9)).toBe(8.5);
    expect(kalshiThresholdToPoint(7)).toBe(6.5);
  });

  test('kalshiDisplayedYesProb prefers last trade then mid', () => {
    expect(kalshiDisplayedYesProb({
      last_price_dollars: '0.7000',
      yes_bid_dollars: '0.6500',
      yes_ask_dollars: '0.7200',
    })).toBe(0.7);

    expect(kalshiDisplayedYesProb({
      yes_bid_dollars: '0.7000',
      yes_ask_dollars: '0.7200',
    })).toBe(0.71);
  });

  test('Canada vs Morocco 8+ NO matches Kalshi 30% at line 7.5', () => {
    const market = {
      floor_strike: 8,
      last_price_dollars: '0.7000',
      yes_bid_dollars: '0.7000',
      yes_ask_dollars: '0.7200',
      no_bid_dollars: '0.2800',
      no_ask_dollars: '0.3000',
    };
    expect(kalshiDisplayedYesProb(market)).toBe(0.7);
    expect(kalshiDisplayedNoProb(market)).toBe(0.28);
    expect(kalshiThresholdToPoint(8)).toBe(7.5);
    expect(fairAmerican(0.7)).toBe(-233);
    expect(fairAmerican(0.28)).toBe(257);
  });
});
