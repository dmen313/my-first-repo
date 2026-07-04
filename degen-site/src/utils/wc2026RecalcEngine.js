/**
 * Recalculate WC corner model team stats and dashboard rows from game logs.
 * Mirrors spreadsheet methodology (handoff 6-28): winsor, Elo normalization, shrinkage, φ.
 */

function numParam(parameters, key, fallback) {
  const raw = parameters?.[key]?.value ?? parameters?.[key] ?? fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function isRealTeamName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.includes('PRIOR') || name.includes('fotmob')) return false;
  return true;
}

function gAttMult(oppElo, baseElo, kElo, gFloor) {
  const opp = Number(oppElo);
  if (!Number.isFinite(opp)) return 1;
  return Math.max(gFloor, 1 + kElo * (baseElo - opp) / 400);
}

function gDefMult(oppElo, baseElo, kElo, gFloor) {
  const opp = Number(oppElo);
  if (!Number.isFinite(opp)) return 1;
  return Math.max(gFloor, 1 + kElo * (opp - baseElo) / 400);
}

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function variance(arr, m = mean(arr)) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
}

/** League-wide winsor cap = mean(CF) + 2·SD(CF) over all included games. */
export function computeWinsorCap(allIncludedGames) {
  const cfs = allIncludedGames.map((g) => Number(g.cf)).filter((n) => Number.isFinite(n));
  if (!cfs.length) return 11;
  const m = mean(cfs);
  const sd = Math.sqrt(variance(cfs, m));
  return m + 2 * sd;
}

export function buildEloLookup(dashboardRows = [], eloRatings = []) {
  const map = {};
  (dashboardRows || []).forEach((row) => {
    if (row?.team && row.elo != null) map[row.team] = row.elo;
  });
  (eloRatings || []).forEach((row) => {
    if (row?.team && row.elo != null) map[row.team] = row.elo;
  });
  return map;
}

function sortGames(games) {
  return [...(games || [])]
    .filter((g) => g && g.included !== false)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))
      || (a.num || 0) - (b.num || 0));
}

/** Recalculate one team's games + summary + dashboard row fields. */
export function recalcTeam(teamName, games, parameters, eloLookup, winsorCap) {
  const baseElo = numParam(parameters, 'BASE_ELO', 1700);
  const kElo = numParam(parameters, 'K_ELO', 0.15);
  const decay = numParam(parameters, 'DECAY', 0.9);
  const gFloor = numParam(parameters, 'GFLOOR', 0.25);
  const lgAvg = numParam(parameters, 'LGAVG (league corner avg)', 4.5);
  const kShrink = numParam(parameters, 'K_SHRINK (thin-sample)', 3);
  const minGames = numParam(parameters, 'MIN_GAMES', 3);
  const cap = winsorCap ?? numParam(parameters, 'WINSOR_CAP =mean+2SD (auto)', 11);

  const allGames = [...(games || [])];
  const included = sortGames(allGames.filter((g) => g.included !== false));
  const n = included.length;

  included.forEach((game, index) => {
    const oppElo = eloLookup[game.opponent] ?? game.oppElo ?? baseElo;
    const cf = Number(game.cf) || 0;
    const ca = Number(game.ca) || 0;
    game.oppElo = oppElo;
    game.wt = n > 0 ? decay ** (n - 1 - index) : 1;
    game.nAtt = cf > 0 ? Math.min(cf, cap) / gAttMult(oppElo, baseElo, kElo, gFloor) : 0;
    game.nDef = ca > 0 ? Math.min(ca, cap) / gDefMult(oppElo, baseElo, kElo, gFloor) : 0;
    game.num = index + 1;
  });

  const wtSum = included.reduce((s, g) => s + (g.wt || 0), 0) || 1;
  const weightedAttack = included.reduce((s, g) => s + (g.nAtt || 0) * (g.wt || 0), 0) / wtSum;
  const weightedDefense = included.reduce((s, g) => s + (g.nDef || 0) * (g.wt || 0), 0) / wtSum;

  const shrinkAttack = n > 0
    ? (n / (n + kShrink)) * weightedAttack + (kShrink / (n + kShrink)) * lgAvg
    : lgAvg;
  const shrinkDefense = n > 0
    ? (n / (n + kShrink)) * weightedDefense + (kShrink / (n + kShrink)) * lgAvg
    : lgAvg;

  const cfValues = included.map((g) => Number(g.cf) || 0);
  const caValues = included.map((g) => Number(g.ca) || 0);
  const rawFor = n ? mean(cfValues) : null;
  const rawAg = n ? mean(caValues) : null;
  const varFor = n ? variance(cfValues, rawFor) : null;
  const varMeanRatio = rawFor > 0 ? varFor / rawFor : null;
  const phi = varMeanRatio;

  let dispersion = null;
  if (varMeanRatio != null && varMeanRatio > 1.5) {
    dispersion = 'overdispersed';
  }

  const usesData = n >= minGames;
  const source = usesData ? `DATA(${n}) / DATA(${n})` : `PRIOR (<${minGames} games)`;

  const summary = {
    gamesFor: n,
    gamesAgainst: n,
    rawMeanFor: rawFor,
    rawMeanAgainst: rawAg,
    varianceFor: varFor,
    varMeanRatio,
    dispersionFlag: dispersion ? 'OVERDISPERSED — Poisson underprices tails' : null,
    priorAttack: lgAvg,
    priorDefense: lgAvg,
    adjAttack: shrinkAttack,
    adjDefense: shrinkDefense,
    source,
  };

  const dashboard = {
    team: teamName,
    games: n,
    rawFor,
    rawAg,
    adjAttack: shrinkAttack,
    adjDefense: shrinkDefense,
    dispersion,
    source,
    phi,
  };

  return { games: allGames, summary, dashboard };
}

/** Recalculate all teams, winsor parameters, and dashboard array. */
export function recalcWcModel({
  teams = {},
  dashboard = [],
  parameters = {},
  eloRatings = [],
}) {
  const teamNames = dashboard
    .map((r) => r.team)
    .filter(isRealTeamName);

  const allIncluded = [];
  teamNames.forEach((name) => {
    (teams[name]?.games || []).forEach((g) => {
      if (g.included !== false) allIncluded.push(g);
    });
  });

  const winsorCap = computeWinsorCap(allIncluded);
  const winsorMean = allIncluded.length ? mean(allIncluded.map((g) => Number(g.cf) || 0)) : null;
  const winsorSd = allIncluded.length
    ? Math.sqrt(variance(allIncluded.map((g) => Number(g.cf) || 0), winsorMean))
    : null;

  const updatedParameters = {
    ...parameters,
    'WINSOR mean (auto)': { ...(parameters['WINSOR mean (auto)'] || {}), value: winsorMean },
    'WINSOR SD (auto)': { ...(parameters['WINSOR SD (auto)'] || {}), value: winsorSd },
    'WINSOR_CAP =mean+2SD (auto)': { ...(parameters['WINSOR_CAP =mean+2SD (auto)'] || {}), value: winsorCap },
  };

  const eloLookup = buildEloLookup(dashboard, eloRatings);
  const updatedTeams = { ...teams };
  const updatedDashboard = [];

  teamNames.forEach((teamName) => {
    const existing = teams[teamName] || { games: [], summary: {} };
    const existingElo = dashboard.find((r) => r.team === teamName)?.elo;
    const result = recalcTeam(teamName, existing.games, updatedParameters, eloLookup, winsorCap);
    updatedTeams[teamName] = {
      ...existing,
      games: result.games,
      summary: result.summary,
    };
    updatedDashboard.push({
      ...(dashboard.find((r) => r.team === teamName) || {}),
      ...result.dashboard,
      elo: existingElo ?? eloLookup[teamName] ?? null,
    });
  });

  // Preserve placeholder / non-team dashboard rows
  dashboard.filter((r) => !isRealTeamName(r.team)).forEach((row) => updatedDashboard.push(row));

  updatedDashboard.sort((a, b) => String(a.team || '').localeCompare(String(b.team || '')));

  return {
    teams: updatedTeams,
    dashboard: updatedDashboard,
    parameters: updatedParameters,
    winsorCap,
  };
}
