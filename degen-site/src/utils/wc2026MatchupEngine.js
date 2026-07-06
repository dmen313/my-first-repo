import { fairAmerican } from './wc2026Pricing.js';

const DOM_SCALE = 400;
const ELO_GAP_SCALE = 400;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numParam(parameters, key, fallback) {
  const raw = parameters?.[key]?.value ?? parameters?.[key] ?? fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function dominanceMult(eloA, eloB, dom = 0.25) {
  const gap = eloA - eloB;
  const adj = dom * Math.abs(gap) / DOM_SCALE;
  if (gap >= 0) {
    return { multA: 1 + adj, multB: 1 - adj };
  }
  return { multA: 1 - adj, multB: 1 + adj };
}

export function lambdaTeam(adjAttack, adjDefense, dominance, manual = 1) {
  return Math.sqrt(adjAttack * adjDefense) * dominance * manual;
}

/** φ = clamp(dashboard φ, floor, cap) if games ≥ 4, else 1 (spreadsheet rule). */
export function effectivePhi(rawPhi, games, phiFloor = 1, phiCap = 2) {
  if ((games || 0) < 4) return 1;
  return clamp(rawPhi || 1, phiFloor, phiCap);
}

/** ρ = −MIN(RHO_CAP, RHO_BASE + RHO_SLOPE × |EloA−EloB| / 400) */
export function matchCorrelation(eloA, eloB, parameters) {
  const rhoBase = numParam(parameters, 'RHO_BASE (corr)', 0.22);
  const rhoSlope = numParam(parameters, 'RHO_SLOPE (corr)', 0.3);
  const rhoCap = numParam(parameters, 'RHO_CAP (corr)', 0.6);
  const gap = Math.abs(eloA - eloB);
  const magnitude = Math.min(rhoCap, rhoBase + rhoSlope * (gap / ELO_GAP_SCALE));
  return -magnitude;
}

/** Knockout read: July fixtures or both teams past group stage (3+ WC games). */
export function isKnockoutStage(fixture, teamA, teamB) {
  if (fixture?.knockout) return true;
  const kickoff = fixture?.commenceTime;
  if (kickoff && String(kickoff).slice(0, 10) >= '2026-07-01') return true;
  const gamesA = teamA?.games ?? 0;
  const gamesB = teamB?.games ?? 0;
  return gamesA >= 3 && gamesB >= 3;
}

function applyLambdaCalibration(lambdaA, lambdaB, teamA, teamB, parameters, options = {}) {
  let la = lambdaA;
  let lb = lambdaB;

  const knockoutMult = numParam(parameters, 'KNOCKOUT_LAMBDA_MULT', 1.1);
  if (isKnockoutStage(options.fixture, teamA, teamB)) {
    la *= knockoutMult;
    lb *= knockoutMult;
  }

  const recentBump = numParam(parameters, 'RECENT_FORM_LAMBDA_BUMP', 0.5);
  const recentA = teamA?.recentCornersFor;
  const recentB = teamB?.recentCornersFor;
  if (
    recentA != null
    && recentB != null
    && recentA > teamA.adjAttack
    && recentB > teamB.adjAttack
  ) {
    la += recentBump;
    lb += recentBump;
  }

  return { lambdaA: la, lambdaB: lb };
}

function teamVariance(lambda, phi) {
  return phi * lambda;
}

function nbParams(mu, phi, phiFloor = 1, phiCap = 2) {
  const cappedPhi = clamp(phi || 1, phiFloor, phiCap);
  if (cappedPhi <= 1.01) {
    return { mu, k: 1e6, phi: 1 };
  }
  return { mu, k: mu / (cappedPhi - 1), phi: cappedPhi };
}

function logGamma(z) {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.984369200019859e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  z -= 1;
  let x = coef[0];
  for (let i = 1; i < g + 2; i += 1) {
    x += coef[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function poissonPmf(k, lambda) {
  if (k < 0) return 0;
  return Math.exp(-lambda + k * Math.log(lambda) - logGamma(k + 1));
}

function poissonCdf(k, lambda) {
  let sum = 0;
  for (let i = 0; i <= k; i += 1) {
    sum += poissonPmf(i, lambda);
  }
  return clamp(sum, 0, 1);
}

function nbPmf(x, mu, k) {
  if (x < 0) return 0;
  const p = k / (k + mu);
  const logCoef = logGamma(x + k) - logGamma(k) - logGamma(x + 1);
  return Math.exp(logCoef + k * Math.log(p) + x * Math.log(1 - p));
}

function nbCdf(x, mu, k) {
  let sum = 0;
  for (let i = 0; i <= x; i += 1) {
    sum += nbPmf(i, mu, k);
  }
  return clamp(sum, 0, 1);
}

function probOverHalfLineDist(cdfFn, line) {
  const threshold = Math.floor(line + 0.5);
  return 1 - cdfFn(threshold - 1);
}

function buildLineTableFromCdf(lines, cdfFn) {
  return lines.map((line) => {
    const pOver = probOverHalfLineDist(cdfFn, line);
    const pUnder = 1 - pOver;
    return {
      line,
      pOver,
      pUnder,
      fairAmOver: fairAmerican(pOver),
      fairAmUnder: fairAmerican(pUnder),
    };
  });
}

/** Skellam: D = X − Y, X~Poi(μ1), Y~Poi(μ2). */
function skellamCdf(d, mu1, mu2) {
  const maxY = Math.min(250, Math.ceil(mu2 + 12 * Math.sqrt(Math.max(mu2, 0.1))));
  let cdf = 0;
  for (let y = 0; y <= maxY; y += 1) {
    const pY = poissonPmf(y, mu2);
    if (pY < 1e-14 && y > mu2 + 5) break;
    const xMax = y + Math.floor(d);
    cdf += pY * poissonCdf(xMax, mu1);
  }
  return clamp(cdf, 0, 1);
}

function skellamPmf(k, mu1, mu2) {
  const maxX = Math.min(250, Math.ceil(mu1 + 12 * Math.sqrt(Math.max(mu1, 0.1))));
  let pmf = 0;
  for (let x = Math.max(0, k); x <= maxX; x += 1) {
    const y = x - k;
    if (y < 0) continue;
    pmf += poissonPmf(x, mu1) * poissonPmf(y, mu2);
  }
  return pmf;
}

function momentMatchedTotalDist(lambdaA, lambdaB, phiA, phiB, rho) {
  const mean = lambdaA + lambdaB;
  const varA = teamVariance(lambdaA, phiA);
  const varB = teamVariance(lambdaB, phiB);
  const corrTerm = 2 * rho * Math.sqrt(varA * varB);
  const variance = varA + varB + corrTerm;

  if (variance <= mean + 1e-9) {
    return {
      mean,
      variance,
      dist: 'poisson',
      cdf: (k) => poissonCdf(k, mean),
    };
  }

  const phiTotal = variance / mean;
  const { k } = nbParams(mean, phiTotal);
  return {
    mean,
    variance,
    dist: 'nb',
    phi: phiTotal,
    k,
    cdf: (x) => nbCdf(x, mean, k),
  };
}

export function computeMatchup(teamA, teamB, parameters, manualA = 1, manualB = 1, options = {}) {
  const dom = numParam(parameters, 'DOM', 0.25);
  const phiFloor = numParam(parameters, 'PHI_FLOOR (NB)', 1);
  const phiCap = numParam(parameters, 'PHI_CAP (NB)', 2);

  const phiA = effectivePhi(teamA.phi, teamA.games, phiFloor, phiCap);
  const phiB = effectivePhi(teamB.phi, teamB.games, phiFloor, phiCap);

  const { multA, multB } = dominanceMult(teamA.elo, teamB.elo, dom);
  let lambdaA = lambdaTeam(teamA.adjAttack, teamB.adjDefense, multA, manualA);
  let lambdaB = lambdaTeam(teamB.adjAttack, teamA.adjDefense, multB, manualB);
  ({ lambdaA, lambdaB } = applyLambdaCalibration(lambdaA, lambdaB, teamA, teamB, parameters, options));
  const lambdaTotal = lambdaA + lambdaB;

  const rho = matchCorrelation(teamA.elo, teamB.elo, parameters);
  const varA = teamVariance(lambdaA, phiA);
  const varB = teamVariance(lambdaB, phiB);
  const corrTerm = 2 * rho * Math.sqrt(varA * varB);
  const varTotal = varA + varB + corrTerm;
  const varDiff = varA + varB - corrTerm;
  const deltaLambda = lambdaA - lambdaB;
  const mu1Eff = (varDiff + deltaLambda) / 2;
  const mu2Eff = (varDiff - deltaLambda) / 2;

  const teamALines = [2.5, 3.5, 4.5, 5.5, 6.5, 7.5];
  const teamBLines = [2.5, 3.5, 4.5, 5.5, 6.5, 7.5];
  const totalLines = [7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5];

  const nbA = nbParams(lambdaA, phiA, phiFloor, phiCap);
  const nbB = nbParams(lambdaB, phiB, phiFloor, phiCap);
  const totalDist = momentMatchedTotalDist(lambdaA, lambdaB, phiA, phiB, rho);

  const handicapLines = [-4.5, -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
  const handicapTable = handicapLines.map((line) => {
    // A covers Asian handicap `line` when (A − B) + line > 0  ⇔  D > −line
    const need = -line;
    const threshold = Math.floor(need + 0.5);
    const pACovers = 1 - skellamCdf(threshold - 1, mu1Eff, mu2Eff);
    return {
      line,
      aCoversProb: pACovers,
      bCoversProb: 1 - pACovers,
      fairAmA: fairAmerican(pACovers),
      fairAmB: fairAmerican(1 - pACovers),
    };
  });

  const pTie = skellamPmf(0, mu1Eff, mu2Eff);
  const pAMost = 1 - skellamCdf(0, mu1Eff, mu2Eff);
  const pBMost = skellamCdf(-1, mu1Eff, mu2Eff);

  return {
    teamA: teamA.team,
    teamB: teamB.team,
    eloA: teamA.elo,
    eloB: teamB.elo,
    adjAttackA: teamA.adjAttack,
    adjAttackB: teamB.adjAttack,
    adjDefenseA: teamA.adjDefense,
    adjDefenseB: teamB.adjDefense,
    phiA,
    phiB,
    phiARaw: teamA.phi,
    phiBRaw: teamB.phi,
    manualA,
    manualB,
    dominanceA: multA,
    dominanceB: multB,
    lambdaA,
    lambdaB,
    lambdaTotal,
    knockoutStage: isKnockoutStage(options.fixture, teamA, teamB),
    rho,
    varA,
    varB,
    varTotal,
    varDiff,
    corrTerm,
    mu1Eff,
    mu2Eff,
    totalDist: totalDist.dist,
    totalPhi: totalDist.phi || 1,
    teamAOverUnder: buildLineTableFromCdf(teamALines, (k) => nbCdf(k, lambdaA, nbA.k)),
    teamBOverUnder: buildLineTableFromCdf(teamBLines, (k) => nbCdf(k, lambdaB, nbB.k)),
    totalOverUnder: buildLineTableFromCdf(totalLines, totalDist.cdf),
    handicapTable,
    mostCorners: {
      teamA: pAMost,
      tie: pTie,
      teamB: pBMost,
      fairAmA: fairAmerican(pAMost),
      fairAmTie: fairAmerican(pTie),
      fairAmB: fairAmerican(pBMost),
    },
  };
}

export function findTeam(dashboard, name) {
  return dashboard.find((t) => t.team === name) || null;
}

/** Attach model vs market edge rows for a line table. */
export function enrichLinesWithMarket(modelLines, marketLines, side = 'Over') {
  const marketByPoint = {};
  (marketLines || []).forEach((m) => {
    if (String(m.name).toLowerCase() === side.toLowerCase()) {
      marketByPoint[m.point] = m;
    }
  });

  return (modelLines || []).map((row) => {
    const m = marketByPoint[row.line];
    const edge = m?.impliedProb != null ? row.pOver - m.impliedProb : null;
    return { ...row, market: m || null, edge };
  });
}
