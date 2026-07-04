/**
 * Mirror / Elo / duplicate checks (handoff validate.py equivalent).
 */

function normalizeDate(d) {
  return String(d || '').slice(0, 10);
}

function gameKey(date, opponent) {
  return `${normalizeDate(date)}|${opponent}`;
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

      const oppData = teams[g.opponent];
      if (!oppData) {
        issues.push({
          severity: 'error',
          type: 'missing_opponent_team',
          team,
          opponent: g.opponent,
          date: g.date,
          message: `${team} vs ${g.opponent} (${g.date}): opponent not in model`,
        });
        return;
      }

      const mirror = (oppData.games || []).find(
        (m) => m.included !== false && m.opponent === team && gameKey(m.date, team) === gameKey(g.date, g.opponent)
      );

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
          message: `${team} vs ${g.opponent} (${g.date}): CF/CA flip mismatch (A ${g.cf}-${g.ca}, B ${mirror.cf}-${mirror.ca})`,
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

      if (g.opponent && !eloNames.has(g.opponent) && !dashByTeam[g.opponent]) {
        issues.push({
          severity: 'warn',
          type: 'opponent_not_in_elo',
          team,
          opponent: g.opponent,
          message: `${g.opponent} not found in Elo table or dashboard`,
        });
      }
    });
  });

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warn').length;

  return {
    issues,
    counts: { errors, warnings, total: issues.length },
    clean: issues.length === 0,
  };
}
