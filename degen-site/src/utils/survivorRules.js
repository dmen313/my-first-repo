/**
 * NCAA Survivor Pool Rules Engine
 * Pure functions for pick validation, buy-back logic, and elimination tracking.
 * No DB access - operates on data passed in.
 */

// Required picks per day based on dayIndex and buy-back status
const PICK_REQUIREMENTS = {
  normal:  { 0: 2, 1: 2 },  // Thu R1: 2, Fri R1: 2, Sat+: 1
  buyBack: { 1: 4, 2: 5, 3: 6 }  // Fri: 4, Sat: 5, Sun: 6
};

const DEFAULT_NORMAL_PICKS = 1;  // After first weekend: always 1
const MAX_BUYBACK_DAY_INDEX = 3; // Can only buy back through Sunday R2 (dayIndex 3)

/**
 * Get the number of picks required for an entry on a given day.
 * @param {Object} entry - Survivor entry record
 * @param {number} dayIndex - 0-based tournament day
 * @param {boolean} isBuyingBack - Whether this is a buy-back day for this entry
 * @returns {number} Number of picks required
 */
export function getRequiredPicks(entry, dayIndex, isBuyingBack = false) {
  if (isBuyingBack && PICK_REQUIREMENTS.buyBack[dayIndex] !== undefined) {
    return PICK_REQUIREMENTS.buyBack[dayIndex];
  }
  return PICK_REQUIREMENTS.normal[dayIndex] ?? DEFAULT_NORMAL_PICKS;
}

/**
 * Check whether an entry can buy back on a given day.
 * @param {Object} entry - Survivor entry record
 * @param {number} dayIndex - 0-based tournament day
 * @returns {boolean}
 */
export function canBuyBack(entry, dayIndex) {
  if (entry.status !== 'eliminated') return false;
  if (dayIndex > MAX_BUYBACK_DAY_INDEX) return false;
  if (dayIndex <= 0) return false; // Can't buy back on the first day
  return true;
}

/**
 * Check if an entry needs buy-back pick requirements for a given day.
 * The penalty only applies to the FIRST day played after the buy-back.
 * Once the entry survives that penalty day, they return to normal picks.
 * Uses actual pick history rather than stored dates for robustness.
 * @param {Object} entry - Survivor entry record
 * @param {number} dayIndex - 0-based tournament day
 * @param {Object[]} entryPicks - All picks for this entry
 * @returns {boolean}
 */
export function needsBuyBackPicks(entry, dayIndex, entryPicks = []) {
  if (!entry.buyBackCount || entry.buyBackCount === 0) return false;
  if (PICK_REQUIREMENTS.buyBack[dayIndex] === undefined) return false;

  // Find the most recent failing pick (the one that triggered the latest buy-back)
  const failedPicks = entryPicks
    .filter(p => p.passed === false)
    .sort((a, b) => b.gameDay.localeCompare(a.gameDay));
  const lastFailedPick = failedPicks[0];
  if (!lastFailedPick) return false;

  // If there's a passing pick AFTER the last failure, the penalty has been served
  const hasPassedAfterFail = entryPicks.some(
    p => p.gameDay > lastFailedPick.gameDay && p.passed === true
  );
  if (hasPassedAfterFail) return false;

  // Check if this day already has a resolved pick
  const hasPickForDay = entryPicks.some(p => p.dayIndex === dayIndex && p.passed !== null);
  if (hasPickForDay) return false;

  return true;
}

/**
 * Get teams available for an entry to pick on a given schedule day.
 * Filters out teams already used by this entry.
 * @param {Object} entry - Survivor entry with usedTeams array
 * @param {Object} scheduleDay - Schedule day record with games array
 * @returns {string[]} Array of available team names
 */
export function getAvailableTeams(entry, scheduleDay) {
  if (!scheduleDay?.games) return [];
  const usedSet = new Set((entry.usedTeams || []).map(t => normalizeName(t)));

  const allTeams = [];
  for (const game of scheduleDay.games) {
    if (game.team1Name) allTeams.push(game.team1Name);
    if (game.team2Name) allTeams.push(game.team2Name);
  }

  return allTeams.filter(name => !usedSet.has(normalizeName(name)));
}

/**
 * Check if an entry will auto-lose on a given day (not enough available teams).
 * @param {Object} entry - Survivor entry
 * @param {Object} scheduleDay - Schedule day record
 * @param {boolean} isBuyingBack - Whether this is a buy-back
 * @returns {{ autoLoss: boolean, available: number, required: number }}
 */
export function checkAutoLoss(entry, scheduleDay, isBuyingBack = false) {
  const available = getAvailableTeams(entry, scheduleDay).length;
  const required = getRequiredPicks(entry, scheduleDay.dayIndex, isBuyingBack);
  return {
    autoLoss: available < required,
    available,
    required
  };
}

/**
 * Validate a set of picks for an entry on a given day.
 * @param {Object} entry - Survivor entry
 * @param {string[]} teamNames - Team names being picked
 * @param {Object} scheduleDay - Schedule day record
 * @param {boolean} isBuyingBack - Whether this is a buy-back
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePicks(entry, teamNames, scheduleDay, isBuyingBack = false) {
  const errors = [];

  if (entry.status === 'eliminated' && !isBuyingBack) {
    errors.push('This entry has been eliminated.');
    return { valid: false, errors };
  }

  const required = getRequiredPicks(entry, scheduleDay.dayIndex, isBuyingBack);
  if (teamNames.length !== required) {
    errors.push(`Must pick exactly ${required} team${required !== 1 ? 's' : ''} (got ${teamNames.length}).`);
  }

  // Check for duplicates within this pick set
  const pickSet = new Set(teamNames.map(t => t.toLowerCase()));
  if (pickSet.size !== teamNames.length) {
    errors.push('Cannot pick the same team twice in one day.');
  }

  // Check all picked teams are playing today
  const availableTeams = new Set();
  if (scheduleDay?.games) {
    for (const game of scheduleDay.games) {
      if (game.team1Name) availableTeams.add(game.team1Name.toLowerCase());
      if (game.team2Name) availableTeams.add(game.team2Name.toLowerCase());
    }
  }
  for (const name of teamNames) {
    if (!availableTeams.has(name.toLowerCase())) {
      errors.push(`${name} is not playing today.`);
    }
  }

  // Check no team reuse (normalize to catch abbreviation variants like "St" vs "State")
  const usedSet = new Set((entry.usedTeams || []).map(t => normalizeName(t)));
  for (const name of teamNames) {
    if (usedSet.has(normalizeName(name))) {
      errors.push(`${name} has already been used by this entry.`);
    }
  }

  const warnings = [];
  if (scheduleDay.lockedAt && new Date() >= new Date(scheduleDay.lockedAt)) {
    warnings.push('Deadline has passed — picks are being submitted late.');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bstate\b/g, 'st')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameMatchScore(a, b) {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 3;
  const aw = na.split(' '), bw = nb.split(' ');
  if (aw.length === bw.length && aw.every((w, i) => bw[i].startsWith(w) || w.startsWith(bw[i]))) return 2;
  if (na.includes(nb) || nb.includes(na)) return 1;
  return 0;
}

function findBestGame(teamName, games) {
  let best = null, bestScore = 0, bestSide = null;
  for (const game of (games || [])) {
    const s1 = nameMatchScore(teamName, game.team1Name);
    const s2 = nameMatchScore(teamName, game.team2Name);
    const s = Math.max(s1, s2);
    if (s > bestScore) { bestScore = s; best = game; bestSide = s1 >= s2 ? 'team1' : 'team2'; }
  }
  return bestScore > 0 ? { game: best, side: bestSide } : null;
}

/**
 * Evaluate pick results after games complete.
 * @param {Object} pick - Survivor pick record with teamNames
 * @param {Object} scheduleDay - Schedule day with game results (winnerId populated)
 * @returns {{ results: Object, passed: boolean, allResolved: boolean }}
 */
export function evaluatePickResults(pick, scheduleDay) {
  const results = {};
  let allWon = true;
  let allResolved = true;

  for (const teamName of (pick.teamNames || [])) {
    const match = findBestGame(teamName, scheduleDay.games);

    if (match) {
      const { game, side } = match;
      if (game.status === 'completed' && game.winnerId) {
        const isWinner = side === 'team1'
          ? game.winnerId === game.team1Id
          : game.winnerId === game.team2Id;
        results[teamName] = isWinner ? 'win' : 'loss';
        if (!isWinner) allWon = false;
      } else {
        results[teamName] = 'pending';
        allResolved = false;
      }
    } else {
      results[teamName] = 'pending';
      allResolved = false;
    }
  }

  return {
    results,
    passed: allResolved ? allWon : null,
    allResolved
  };
}

/**
 * Get a display label for a tournament day.
 * @param {number} dayIndex
 * @returns {string}
 */
export function getTournamentDayLabel(dayIndex) {
  const labels = {
    0: 'Thursday R1',
    1: 'Friday R1',
    2: 'Saturday R2',
    3: 'Sunday R2',
    4: 'Thursday S16',
    5: 'Friday S16',
    6: 'Saturday E8',
    7: 'Sunday E8',
    8: 'Saturday F4',
    9: 'Monday Championship'
  };
  return labels[dayIndex] || `Day ${dayIndex + 1}`;
}
