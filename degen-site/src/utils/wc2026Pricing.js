/** EV%, tier ladder, and American odds helpers (Tracker / Matchup Engine parity). */

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

export function shadowTierUnits(evPct) {
  if (evPct === null || evPct === undefined || evPct < 0.05) return 0;
  if (evPct < 0.1) return 1;
  if (evPct < 0.15) return 1.5;
  if (evPct < 0.2) return 2;
  if (evPct < 0.25) return 2.5;
  return 3;
}

export function clvPct(oddsTaken, oddsClose) {
  const decTaken = americanToDecimal(oddsTaken);
  const decClose = americanToDecimal(oddsClose);
  if (!decTaken || !decClose) return null;
  return decTaken / decClose - 1;
}
