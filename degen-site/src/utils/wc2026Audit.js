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

/** Same fixture on both team tabs (opponent names + normalized date). */
function findMirrorGame(teams, team, game) {
  const oppData = teams[game.opponent];
  if (!oppData) return null;
  const targetDate = normalizeGameDate(game.date);
  return (oppData.games || []).find(
    (m) => m.included !== false
      && m.opponent === team
      && normalizeGameDate(m.date) === targetDate
  ) || null;
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

      const pairKey = [team, g.opponent].sort().join('|') + '|' + normalizeGameDate(g.date);
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
      } else {
        const mirror = findMirrorGame(teams, team, g);
        if (!mirror) {
          issues.push({
            severity: 'error',
            type: 'mirror_missing',
            team,
            opponent: g.opponent,
            date: g.date,
            message: `${team} vs ${g.opponent} (${g.date}): no mirrored row on ${g.opponent}`,
          });
        } else if (Number(mirror.cf) !== Number(g.ca) || Number(mirror.ca) !== Number(g.cf)) {
          issues.push({
            severity: 'error',
            type: 'mirror_mismatch',
            team,
            opponent: g.opponent,
            date: g.date,
            message: `${team} vs ${g.opponent} (${g.date}): CF/CA flip mismatch (${team} ${g.cf}-${g.ca}, ${g.opponent} ${mirror.cf}-${mirror.ca})`,
          });
        }
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

      if (g.opponent && !eloNames.has(g.opponent)) {
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
