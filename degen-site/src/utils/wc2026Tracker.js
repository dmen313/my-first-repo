import {
  americanProfit,
  clvPct,
  evFromProbAndAmerican,
  fairAmerican,
  impliedProbFromAmerican,
  shadowTierUnits,
} from './wc2026Pricing.js';

export function enrichBet(bet) {
  const modelPct = Number(bet.modelPct);
  const oddsTaken = Number(bet.oddsTaken);
  const stake = Number(bet.stake) || 1;
  const close = bet.close != null && bet.close !== '' ? Number(bet.close) : null;
  const result = (bet.result || 'Pending').toUpperCase();

  const fairOdds = Number.isFinite(modelPct) ? fairAmerican(modelPct) : null;
  const implPct = Number.isFinite(oddsTaken) ? impliedProbFromAmerican(oddsTaken) : null;
  const evPct = Number.isFinite(modelPct) && Number.isFinite(oddsTaken)
    ? evFromProbAndAmerican(modelPct, oddsTaken)
    : null;
  const tierUnits = evPct != null ? shadowTierUnits(evPct) : 0;

  let profit = 0;
  if (result === 'W') {
    const winProfit = americanProfit(oddsTaken);
    profit = winProfit != null ? winProfit * stake : stake;
  } else if (result === 'L') {
    profit = -stake;
  }

  const clv = close != null ? clvPct(oddsTaken, close) : null;
  const beatClose = clv != null ? (clv > 0 ? 'Y' : 'N') : null;
  const tieredProfit = tierUnits > 0 && result === 'W'
    ? (americanProfit(oddsTaken) || 0) * tierUnits
    : result === 'L' && tierUnits > 0
      ? -tierUnits
      : result === 'W'
        ? profit
        : result === 'L'
          ? profit
          : null;

  return {
    ...bet,
    modelPct,
    oddsTaken,
    stake,
    close,
    result: result === 'PENDING' ? 'Pending' : result,
    fairOdds,
    implPct,
    evPct,
    profit,
    clvPct: clv,
    beatClose,
    tierUnits,
    tieredProfit,
  };
}

export function computeTrackerSummary(bets = []) {
  const enriched = bets.map((b) => enrichBet(b));
  const settled = enriched.filter((b) => b.result && b.result !== 'Pending');
  const wins = settled.filter((b) => b.result === 'W').length;
  const losses = settled.filter((b) => b.result === 'L').length;
  const pushes = settled.filter((b) => b.result === 'P').length;
  const unitsStaked = settled.reduce((s, b) => s + (Number(b.stake) || 1), 0);
  const unitsPL = settled.reduce((s, b) => s + (Number(b.profit) || 0), 0);
  const tieredStaked = settled.reduce((s, b) => s + (Number(b.tierUnits) || Number(b.stake) || 1), 0);
  const tieredPL = settled.reduce((s, b) => s + (Number(b.tieredProfit ?? b.profit) || 0), 0);

  const withClv = settled.filter((b) => b.clvPct != null);
  const avgClv = withClv.length
    ? withClv.reduce((s, b) => s + b.clvPct, 0) / withClv.length
    : null;
  const beatCloseCount = withClv.filter((b) => b.beatClose === 'Y').length;

  return {
    totalPlays: enriched.length,
    settled: settled.length,
    record: settled.length ? `${wins}-${losses}${pushes ? `-${pushes}` : ''}` : null,
    winRate: settled.length ? wins / settled.length : null,
    unitsStaked,
    unitsPL,
    roi: unitsStaked > 0 ? unitsPL / unitsStaked : null,
    tieredUnitsStaked: tieredStaked,
    tieredUnitsPL: tieredPL,
    tieredRoi: tieredStaked > 0 ? tieredPL / tieredStaked : null,
    avgClv,
    pctBeatClose: withClv.length ? beatCloseCount / withClv.length : null,
  };
}
