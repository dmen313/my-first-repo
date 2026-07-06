import {
  getOverProjectionBanner,
  getProjectionBiasBanner,
  getUnderProjectionBanner,
} from './wc2026Accuracy.js';

describe('wc2026Accuracy bias banners', () => {
  test('over-projection banner on positive bias', () => {
    const banner = getOverProjectionBanner({
      count: 8,
      meanBias: 1.2,
      underRate: 7 / 8,
      underCount: 7,
    });
    expect(banner?.kind).toBe('over');
    expect(banner?.level).toBe('strong');
  });

  test('under-projection banner on negative bias', () => {
    const banner = getUnderProjectionBanner({
      count: 8,
      meanBias: -1.3,
      underRate: 0.25,
      underCount: 2,
    });
    expect(banner?.kind).toBe('under');
    expect(banner?.message).toMatch(/under-projection/i);
  });

  test('getProjectionBiasBanner prefers over when both could apply', () => {
    const over = getProjectionBiasBanner({
      count: 8,
      meanBias: 1.2,
      underRate: 0.75,
      underCount: 6,
    });
    expect(over?.kind).toBe('over');
  });
});
