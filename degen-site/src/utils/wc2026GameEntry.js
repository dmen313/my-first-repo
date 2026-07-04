import { computeMatchup, findTeam } from './wc2026MatchupEngine';

/** Normalize user date input to YYYY-MM-DD when possible. */
export function normalizeGameDate(input) {
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

  return trimmed;
}

export function gameDuplicateKey(date, opponent) {
  return `${normalizeGameDate(date)}|${opponent}`;
}

export function hasGame(games, date, opponent) {
  const key = gameDuplicateKey(date, opponent);
  return (games || []).some(
    (g) => g.included !== false && gameDuplicateKey(g.date, g.opponent) === key
  );
}

export function nextGameNum(games) {
  const nums = (games || []).map((g) => Number(g.num) || 0);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

export function buildProjectionSnapshot(dashboard, parameters, teamAName, teamBName, manualA = 1, manualB = 1) {
  const a = findTeam(dashboard, teamAName);
  const b = findTeam(dashboard, teamBName);
  if (!a || !b) return null;

  const m = computeMatchup(a, b, parameters, manualA, manualB);
  return {
    teamA: teamAName,
    teamB: teamBName,
    projA: Number(m.lambdaA.toFixed(3)),
    projB: Number(m.lambdaB.toFixed(3)),
    projTotal: Number(m.lambdaTotal.toFixed(2)),
    eloGap: Math.abs(Number(a.elo || 0) - Number(b.elo || 0)),
    lockedAt: new Date().toISOString(),
  };
}

export function buildAccuracyEntryFromProjection(date, projection, actuals = null) {
  const entry = {
    date: normalizeGameDate(date),
    teamA: projection.teamA,
    teamB: projection.teamB,
    projA: projection.projA,
    projB: projection.projB,
    projTotal: projection.projTotal,
    eloGap: projection.eloGap,
    projectionLocked: true,
    lockedAt: projection.lockedAt,
  };

  if (actuals) {
    const actA = Number(actuals.actA);
    const actB = Number(actuals.actB);
    entry.actA = actA;
    entry.actB = actB;
    entry.actTotal = actA + actB;
    entry.error = Number((entry.projTotal - entry.actTotal).toFixed(2));
    entry.absError = Math.abs(entry.error);
    entry.gradedAt = new Date().toISOString();
  }

  return entry;
}

export function buildGameRecord({
  num,
  date,
  opponent,
  cf,
  ca,
  comp = 'WC',
  venue = 'N',
  oppElo = null,
  included = true,
  source = 'manual',
}) {
  return {
    num,
    date: normalizeGameDate(date),
    opponent,
    comp,
    venue,
    cf: Number(cf),
    ca: Number(ca),
    included: included !== false,
    oppElo: oppElo != null ? Number(oppElo) : null,
    source,
    enteredAt: new Date().toISOString(),
  };
}

export function mirrorVenue(venue) {
  if (venue === 'H') return 'A';
  if (venue === 'A') return 'H';
  return 'N';
}
