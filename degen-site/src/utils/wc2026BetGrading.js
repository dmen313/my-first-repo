/** Grade WC corner plays against actual match corner counts. */

export function overHalfLineWins(total, line) {
  const threshold = Math.floor(line + 0.5);
  return total >= threshold;
}

function underHalfLineWins(total, line) {
  return !overHalfLineWins(total, line);
}

/** Asian handicap: team covers `line` when (teamCorners - oppCorners) + line > 0. */
export function handicapCovers(teamCorners, oppCorners, line) {
  return teamCorners - oppCorners + line > 0;
}

/**
 * @param {object} play — slate play from buildSlate
 * @param {{ homeTeam, awayTeam, cornersHome, cornersAway }} result
 * @returns {'W'|'L'|'P'|null}
 */
export function gradePlay(play, result) {
  if (!play || !result) return null;
  const { homeTeam, awayTeam, cornersHome, cornersAway } = result;
  const line = Number(play.line);
  const side = String(play.side || '').toLowerCase();
  const marketType = play.marketType;

  if (marketType === 'game_total') {
    const total = cornersHome + cornersAway;
    if (side === 'over') return overHalfLineWins(total, line) ? 'W' : 'L';
    if (side === 'under') return underHalfLineWins(total, line) ? 'W' : 'L';
    return null;
  }

  if (marketType === 'team_total') {
    const team = play.team;
    let teamCorners = null;
    if (team === homeTeam) teamCorners = cornersHome;
    else if (team === awayTeam) teamCorners = cornersAway;
    if (teamCorners == null) return null;
    if (side === 'over') return overHalfLineWins(teamCorners, line) ? 'W' : 'L';
    if (side === 'under') return underHalfLineWins(teamCorners, line) ? 'W' : 'L';
    return null;
  }

  if (marketType === 'handicap') {
    const team = play.team;
    let teamCorners = null;
    let oppCorners = null;
    if (team === homeTeam) {
      teamCorners = cornersHome;
      oppCorners = cornersAway;
    } else if (team === awayTeam) {
      teamCorners = cornersAway;
      oppCorners = cornersHome;
    }
    if (teamCorners == null) return null;
    const covers = handicapCovers(teamCorners, oppCorners, line);
    return covers ? 'W' : 'L';
  }

  return null;
}

export function playBetKey(play) {
  return `${play.match}|${normalizeSelection(play.selection)}`;
}

export function betRecordKey(bet) {
  return `${bet.match}|${bet.selection}|${normalizeBetDateKey(bet.date)}`;
}

function normalizeBetDateKey(date) {
  if (!date) return '';
  const s = String(date).trim();
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const month = slash[1].padStart(2, '0');
    const day = slash[2].padStart(2, '0');
    let year = slash[3] ? Number(slash[3]) : 2026;
    if (year < 100) year += 2000;
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

export function formatKickoffDate(kickoff) {
  if (!kickoff) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(kickoff));
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return month && day ? `${month}/${day}` : '';
}

export function normalizeSelection(selection) {
  return String(selection || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function betDedupeKey(bet) {
  return `${String(bet.match || '').trim()}|${normalizeSelection(bet.selection)}`;
}

export function findMatchResult(teams, homeTeam, awayTeam, kickoff) {
  const kickoffDate = kickoff ? new Date(kickoff).toISOString().slice(0, 10) : null;

  const tryTeam = (teamName, oppName) => {
    const games = teams[teamName]?.games || [];
    return games.find((g) => {
      if (g.included === false || g.comp !== 'WC') return false;
      if (g.opponent !== oppName) return false;
      if (g.cf == null || g.ca == null) return false;
      if (!kickoffDate || !g.date) return true;
      const gameDate = g.date.slice(0, 10);
      if (gameDate === kickoffDate) return true;
      // Kickoff UTC date can differ from result date by one day
      const kickoffMs = new Date(kickoffDate).getTime();
      const gameMs = new Date(gameDate).getTime();
      return Math.abs(kickoffMs - gameMs) <= 86400000;
    });
  };

  const homeGame = tryTeam(homeTeam, awayTeam);
  if (homeGame) {
    return {
      homeTeam,
      awayTeam,
      cornersHome: Number(homeGame.cf),
      cornersAway: Number(homeGame.ca),
      date: homeGame.date,
    };
  }

  const awayGame = tryTeam(awayTeam, homeTeam);
  if (awayGame) {
    return {
      homeTeam,
      awayTeam,
      cornersHome: Number(awayGame.ca),
      cornersAway: Number(awayGame.cf),
      date: awayGame.date,
    };
  }

  return null;
}

export function playToBetInput(play, result) {
  const grade = gradePlay(play, result);
  return {
    date: formatKickoffDate(play.kickoff),
    match: play.match,
    selection: play.selection,
    modelPct: play.modelPct,
    oddsTaken: play.odds,
    close: null,
    stake: play.tier || 1,
    result: grade || 'Pending',
    book: play.book || null,
    marketType: play.marketType,
    fixtureId: play.fixtureId,
    kickoff: play.kickoff,
    autoLogged: true,
  };
}
