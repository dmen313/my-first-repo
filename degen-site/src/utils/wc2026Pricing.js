/** EV%, tier ladder, and American odds helpers (Tracker / Matchup Engine parity). */

/** Minimum EV to flag a play (slate + Markets tab). */
export const MIN_PLAY_EV = 0.1;

/** Game-total unders require higher edge (poor calibration in tracker). */
export const GAME_TOTAL_UNDER_MIN_EV = 0.12;

/** Exclude tail prices that produce fake huge EV (Kalshi / alt books). */
export const MAX_AMERICAN_ODDS = 500;
export const MIN_IMPLIED_PROB = 0.03;
export const MAX_IMPLIED_PROB = 0.97;

/** Cap reported EV and tier sizing. */
export const MAX_REPORTED_EV = 0.25;

/** Model must beat market implied by at least this many percentage points. */
export const MIN_MODEL_MARKET_GAP = 0.08;

export function americanToDecimal(odds) {
  const n = Number(odds);
  if (!n || Number.isNaN(n)) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

export function americanProfit(odds) {
  const n = Number(odds);
  if (!n || Number.isNaN(n)) return null;
  return n > 0 ? n / 100 : 100 / Math.abs(n);
}

export function impliedProbFromAmerican(odds) {
  const dec = americanToDecimal(odds);
  if (!dec) return null;
  return 1 / dec;
}

export function fairAmerican(prob) {
  if (!prob || prob <= 0 || prob >= 1) return null;
  if (prob >= 0.5) {
    return Math.round(-100 * prob / (1 - prob));
  }
  return Math.round(100 * (1 - prob) / prob);
}

/** EV = p·profit − (1−p) as decimal return per unit risked. */
export function evFromProbAndAmerican(prob, americanOdds) {
  const profit = americanProfit(americanOdds);
  if (profit === null || prob === null || prob === undefined) return null;
  return prob * profit - (1 - prob);
}

/** True when American odds are in a range suitable for EV / slate selection. */
export function isSaneMarketPrice(americanOdds) {
  const n = Number(americanOdds);
  if (!n || Number.isNaN(n)) return false;
  if (Math.abs(n) > MAX_AMERICAN_ODDS) return false;
  const impl = impliedProbFromAmerican(n);
  if (impl == null || impl < MIN_IMPLIED_PROB || impl > MAX_IMPLIED_PROB) return false;
  return true;
}

function marketImpliedProb(marketLine) {
  if (marketLine?.impliedProb != null) return marketLine.impliedProb;
  if (marketLine?.price != null) return impliedProbFromAmerican(marketLine.price);
  return null;
}

/**
 * EV with sanity filters: sane odds, min model−market gap, capped reported EV.
 * Returns null when the line should not be considered a play.
 */
export function cappedEvFromProbAndAmerican(prob, marketLine) {
  if (!marketLine?.price || prob == null) return null;
  if (!isSaneMarketPrice(marketLine.price)) return null;

  const impl = marketImpliedProb(marketLine);
  if (impl != null && prob - impl < MIN_MODEL_MARKET_GAP) return null;

  const raw = evFromProbAndAmerican(prob, marketLine.price);
  if (raw == null || raw < 0) return null;
  return Math.min(raw, MAX_REPORTED_EV);
}

export function shadowTierUnits(evPct, modelMarketGap = null) {
  if (evPct === null || evPct === undefined || evPct < MIN_PLAY_EV) return 0;
  let units = 0;
  if (evPct < 0.15) units = 1;
  else if (evPct < 0.2) units = 1.5;
  else if (evPct < 0.25) units = 2;
  else units = 2.5;
  if (evPct >= MAX_REPORTED_EV) units = 3;
  if (modelMarketGap != null && modelMarketGap > 0.15) {
    units = Math.min(units, 2);
  }
  return units;
}

export function clvPct(oddsTaken, oddsClose) {
  const decTaken = americanToDecimal(oddsTaken);
  const decClose = americanToDecimal(oddsClose);
  if (!decTaken || !decClose) return null;
  return decTaken / decClose - 1;
}
