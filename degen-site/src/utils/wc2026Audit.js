/**
 * Mirror / Elo / duplicate checks (handoff validate.py equivalent).
 */

function normalizeGameDate(input) {
  if (!input) return '';
  const trimmed = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const month = slash[1].padStart(2, '0');
    const day = slash[2].padStart(2, '0');
    let year = slash[3] ? Number(slash[3]) : 2026;
    if (year < 100) year += 2000;
    return `${year}-${month}-${day}`;
  }

  return trimmed.slice(0, 10);
}

function gameKey(date, opponent) {
  return `${normalizeGameDate(date)}|${opponent}`;
}

function dayDiff(a, b) {
  const da = new Date(`${normalizeGameDate(a)}T12:00:00Z`);
  const db = new Date(`${normalizeGameDate(b)}T12:00:00Z`);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) {
    return normalizeGameDate(a) === normalizeGameDate(b) ? 0 : 999;
  }
  return Math.round(Math.abs(da - db) / 86400000);
}

function cfCaMatches(a, b) {
  return Number(a.cf) === Number(b.ca) && Number(a.ca) === Number(b.cf);
}

/**
 * Find opponent-tab row for the same fixture.
 * Returns { mirror, matchType } where matchType is exact | fixture_id | date_skew | stats_far.
 */
function findMirrorGame(teams, team, game) {
  const oppData = teams[game.opponent];
  if (!oppData) return null;

  const candidates = (oppData.games || []).filter(
    (m) => m.included !== false && m.opponent === team
  );
  if (!candidates.length) return null;

  if (game.apiFixtureId) {
    const byId = candidates.find((m) => m.apiFixtureId === game.apiFixtureId);
    if (byId) {
      const skew = dayDiff(game.date, byId.date);
      if (skew === 0) return { mirror: byId, matchType: 'exact' };
      if (skew <= 1) return { mirror: byId, matchType: 'date_skew' };
      return { mirror: byId, matchType: 'date_skew' };
    }
  }

  const exactDate = candidates.find(
    (m) => normalizeGameDate(m.date) === normalizeGameDate(game.date)
  );
  if (exactDate) return { mirror: exactDate, matchType: 'exact' };

  const byStats = candidates.filter((m) => cfCaMatches(game, m));
  if (byStats.length) {
    byStats.sort((a, b) => dayDiff(game.date, a.date) - dayDiff(game.date, b.date));
    const best = byStats[0];
    const skew = dayDiff(game.date, best.date);
    if (skew <= 1) return { mirror: best, matchType: 'date_skew' };
    return { mirror: best, matchType: 'stats_far' };
  }

  return null;
}

export const AUTO_PARAMETER_KEYS = new Set([
  'WINSOR mean (auto)',
  'WINSOR SD (auto)',
  'WINSOR_CAP =mean+2SD (auto)',
]);

export function runWcModelAudit({ dashboard = [], teams = {}, eloRatings = [] } = {}) {
  const issues = [];
  const eloNames = new Set();
  (eloRatings || []).forEach((r) => {
    if (r?.team) eloNames.add(r.team);
  });
  (dashboard || []).forEach((row) => {
    if (row?.team) eloNames.add(row.team);
  });

  const dashByTeam = {};
  (dashboard || []).forEach((row) => {
    dashByTeam[row.team] = row;
  });

  const modelTeams = new Set(Object.keys(teams || {}));
  const reportedPairs = new Set();
  const reportedEloOpponents = new Set();

  Object.entries(teams || {}).forEach(([team, data]) => {
    const included = (data.games || []).filter((g) => g.included !== false);
    const seen = new Set();

    included.forEach((g) => {
      const key = gameKey(g.date, g.opponent);
      if (seen.has(key)) {
        issues.push({
          severity: 'error',
          type: 'duplicate_game',
          team,
          opponent: g.opponent,
          date: g.date,
          message: `${team}: duplicate ${g.opponent} on ${g.date}`,
        });
      }
      seen.add(key);

      // Pair-level checks once per fixture (avoid double count when dates differ by a day).
      if (team > g.opponent) return;

      const pairKey = [team, g.opponent].sort().join('|') + '|' + (g.apiFixtureId || normalizeGameDate(g.date));
      if (reportedPairs.has(pairKey)) return;
      reportedPairs.add(pairKey);

      const oppInModel = modelTeams.has(g.opponent) || dashByTeam[g.opponent];
      if (!oppInModel) {
        issues.push({
          severity: 'warn',
          type: 'missing_opponent_team',
          team,
          opponent: g.opponent,
          date: g.date,
          message: `${team} vs ${g.opponent} (${g.date}): opponent not in WC model (friendly / reference row)`,
        });
        return;
      }

      const hit = findMirrorGame(teams, team, g);
      if (!hit) {
        issues.push({
          severity: 'error',
          type: 'mirror_missing',
          team,
          opponent: g.opponent,
          date: g.date,
          message: `${team} vs ${g.opponent} (${g.date}): no mirrored row on ${g.opponent}`,
        });
      } else if (hit.matchType === 'date_skew') {
        issues.push({
          severity: 'warn',
          type: 'mirror_date_skew',
          team,
          opponent: g.opponent,
          date: g.date,
          message: `${team} vs ${g.opponent}: dates ${g.date} / ${hit.mirror.date} (±1 day — timezone or import skew; CF/CA match)`,
        });
      } else if (hit.matchType === 'stats_far') {
        issues.push({
          severity: 'warn',
          type: 'mirror_date_far',
          team,
          opponent: g.opponent,
          date: g.date,
          message: `${team} vs ${g.opponent}: CF/CA match but dates ${g.date} vs ${hit.mirror.date} — verify same fixture`,
        });
      } else if (!cfCaMatches(g, hit.mirror)) {
        issues.push({
          severity: 'error',
          type: 'mirror_mismatch',
          team,
          opponent: g.opponent,
          date: g.date,
          message: `${team} vs ${g.opponent} (${g.date}): CF/CA flip mismatch (${team} ${g.cf}-${g.ca}, ${g.opponent} ${hit.mirror.cf}-${hit.mirror.ca})`,
        });
      }

      if (g.oppElo == null) {
        issues.push({
          severity: 'warn',
          type: 'missing_opp_elo',
          team,
          opponent: g.opponent,
          date: g.date,
          message: `${team} vs ${g.opponent} (${g.date}): oppElo missing`,
        });
      }

      if (g.opponent && !eloNames.has(g.opponent) && !reportedEloOpponents.has(g.opponent)) {
        reportedEloOpponents.add(g.opponent);
        issues.push({
          severity: 'warn',
          type: 'opponent_not_in_elo',
          team,
          opponent: g.opponent,
          message: `${g.opponent} not in Elo ratings table`,
        });
      }
    });
  });

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warn').length;

  return {
    issues,
    counts: { errors, warnings, total: issues.length },
    clean: errors === 0,
  };
}
