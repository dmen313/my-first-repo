import {
  cappedEvFromProbAndAmerican,
  evFromProbAndAmerican,
  isSaneMarketPrice,
  MIN_PLAY_EV,
  shadowTierUnits,
} from './wc2026Pricing.js';

describe('wc2026Pricing', () => {
  test('isSaneMarketPrice rejects extreme American odds', () => {
    expect(isSaneMarketPrice(-110)).toBe(true);
    expect(isSaneMarketPrice(9900)).toBe(false);
    expect(isSaneMarketPrice(-9900)).toBe(false);
  });

  test('cappedEvFromProbAndAmerican requires model-market gap', () => {
    const line = { price: -110, impliedProb: 0.52 };
    expect(cappedEvFromProbAndAmerican(0.54, line)).toBeNull();
    const edge = cappedEvFromProbAndAmerican(0.62, line);
    expect(edge).not.toBeNull();
    expect(edge).toBeGreaterThan(0);
  });

  test('cappedEvFromProbAndAmerican caps reported EV', () => {
    const line = { price: 500, impliedProb: 0.17 };
    const ev = cappedEvFromProbAndAmerican(0.45, line);
    expect(ev).toBeLessThanOrEqual(0.25);
  });

  test('shadowTierUnits uses MIN_PLAY_EV floor', () => {
    expect(shadowTierUnits(0.08)).toBe(0);
    expect(shadowTierUnits(MIN_PLAY_EV)).toBeGreaterThan(0);
  });

  test('evFromProbAndAmerican unchanged for fair lines', () => {
    const ev = evFromProbAndAmerican(0.55, -122);
    expect(ev).toBeGreaterThan(0);
  });
});
