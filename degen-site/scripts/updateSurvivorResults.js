#!/usr/bin/env node

/**
 * Update NCAA Survivor Pool results after games complete.
 * Fetches latest ESPN data, updates schedule statuses, evaluates picks, and marks eliminations.
 *
 * Usage:
 *   node scripts/updateSurvivorResults.js              # Update today's results
 *   node scripts/updateSurvivorResults.js 2026-03-19   # Update a specific date
 */

require('dotenv').config();
const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

const LEAGUE = 'ncaa-survivor';
const SEASON = '2026';

const TABLES = {
  schedule: 'sports-hub-survivor-schedule',
  picks: 'sports-hub-survivor-picks',
  entries: 'sports-hub-survivor-entries'
};

const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard';

// Normalize team name for fuzzy matching: collapse St/State/Saint variants, strip punctuation
function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/\bsaint\b/g, 'st')
    .replace(/\bstate\b/g, 'st')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Score how well two team names match (higher = better, 0 = no match)
// Returns: 3 = exact, 2 = abbreviation match (same word count), 1 = substring, 0 = none
function matchScore(pickName, scheduleName) {
  const a = normalizeName(pickName);
  const b = normalizeName(scheduleName);
  if (a === b) return 3;
  const aWords = a.split(' ');
  const bWords = b.split(' ');
  if (aWords.length === bWords.length &&
      aWords.every((w, i) => bWords[i].startsWith(w) || w.startsWith(bWords[i]))) {
    return 2;
  }
  if (a.includes(b) || b.includes(a)) return 1;
  return 0;
}

/**
 * Find the best matching game for a pick team name.
 * Prefers exact matches over abbreviation matches over substring matches.
 * This avoids "Tennessee" matching "Tennessee St" when an exact "Tennessee" game exists.
 */
function findBestGameMatch(teamName, games) {
  let bestGame = null;
  let bestScore = 0;
  let bestSide = null; // 'team1' or 'team2'

  for (const game of (games || [])) {
    const score1 = matchScore(teamName, game.team1Name);
    const score2 = matchScore(teamName, game.team2Name);
    const score = Math.max(score1, score2);
    if (score > bestScore) {
      bestScore = score;
      bestGame = game;
      bestSide = score1 >= score2 ? 'team1' : 'team2';
    }
  }

  return bestScore > 0 ? { game: bestGame, side: bestSide, score: bestScore } : null;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON')); }
      });
    }).on('error', reject);
  });
}

async function fetchLatestResults(dateStr) {
  const dateFormatted = dateStr.replace(/-/g, '');
  const url = `${ESPN_SCOREBOARD_URL}?dates=${dateFormatted}&groups=100&limit=100`;
  console.log(`\n📡 Fetching latest results for ${dateStr}...`);

  const data = await httpGet(url);
  const events = data.events || [];

  return events.map(event => {
    const competition = event.competitions?.[0];
    if (!competition) return null;

    const competitors = competition.competitors || [];
    const team1 = competitors.find(c => c.homeAway === 'home') || competitors[0];
    const team2 = competitors.find(c => c.homeAway === 'away') || competitors[1];

    const gameStatus = competition.status?.type?.name || 'STATUS_SCHEDULED';
    let winnerId = null;
    if (gameStatus === 'STATUS_FINAL') {
      const winner = competitors.find(c => c.winner === true);
      winnerId = winner?.team?.id || null;
    }

    return {
      espnGameId: event.id,
      startTime: event.date || competition.date,
      status: gameStatus === 'STATUS_FINAL' ? 'completed' : gameStatus === 'STATUS_IN_PROGRESS' ? 'in_progress' : 'scheduled',
      team1Id: team1?.team?.id || null,
      team1Name: team1?.team?.shortDisplayName || team1?.team?.displayName || 'TBD',
      team1Seed: team1?.curatedRank?.current || null,
      team2Id: team2?.team?.id || null,
      team2Name: team2?.team?.shortDisplayName || team2?.team?.displayName || 'TBD',
      team2Seed: team2?.curatedRank?.current || null,
      winnerId
    };
  }).filter(Boolean);
}

async function updateScheduleGames(dateStr, latestGames) {
  const scheduleId = `${LEAGUE}-${SEASON}-${dateStr}`;
  const result = await docClient.send(new GetCommand({
    TableName: TABLES.schedule,
    Key: { id: scheduleId }
  }));

  if (!result.Item) {
    console.log(`   ⚠️  No schedule record for ${dateStr}. Run fetchNcaaSurvivorSchedule first.`);
    return null;
  }

  const schedule = result.Item;
  schedule.games = latestGames;
  schedule.updatedAt = new Date().toISOString();

  await docClient.send(new PutCommand({ TableName: TABLES.schedule, Item: schedule }));

  const completed = latestGames.filter(g => g.status === 'completed').length;
  const total = latestGames.length;
  console.log(`   ✅ Updated schedule: ${completed}/${total} games completed`);

  return schedule;
}

async function evaluateAndUpdatePicks(dateStr, schedule) {
  const picksResult = await docClient.send(new QueryCommand({
    TableName: TABLES.picks,
    IndexName: 'league-day-index',
    KeyConditionExpression: '#league = :league AND #gameDay = :gameDay',
    ExpressionAttributeNames: { '#league': 'league', '#gameDay': 'gameDay' },
    ExpressionAttributeValues: { ':league': LEAGUE, ':gameDay': dateStr }
  }));

  const dayPicks = picksResult.Items || [];
  console.log(`\n📋 Evaluating ${dayPicks.length} picks for ${dateStr}...`);

  const eliminations = [];
  const survivors = [];

  for (const pick of dayPicks) {
    const results = {};
    let allWon = true;
    let allResolved = true;

    for (const teamName of (pick.teamNames || [])) {
      const match = findBestGameMatch(teamName, schedule.games);

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
        console.log(`      ⚠️  No schedule match for pick: "${teamName}"`);
        results[teamName] = 'pending';
        allResolved = false;
      }
    }

    const passed = allResolved ? allWon : null;

    await docClient.send(new UpdateCommand({
      TableName: TABLES.picks,
      Key: { id: pick.id },
      UpdateExpression: 'SET #results = :results, #passed = :passed, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#results': 'results',
        '#passed': 'passed',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':results': results,
        ':passed': passed,
        ':updatedAt': new Date().toISOString()
      }
    }));

    const label = pick.playerName;
    const resultStrs = Object.entries(results).map(([t, r]) => {
      const icon = r === 'win' ? '✅' : r === 'loss' ? '❌' : '⏳';
      return `${icon} ${t}`;
    });

    if (allResolved && !allWon) {
      eliminations.push(pick);
      console.log(`   🔴 ${label}: ELIMINATED — ${resultStrs.join(', ')}`);
    } else if (allResolved && allWon) {
      survivors.push(pick);
      console.log(`   🟢 ${label}: SURVIVED — ${resultStrs.join(', ')}`);
    } else {
      console.log(`   ⏳ ${label}: PENDING — ${resultStrs.join(', ')}`);
    }
  }

  return { eliminations, survivors };
}

async function processEliminations(eliminations, dateStr) {
  if (eliminations.length === 0) return;

  console.log(`\n💀 Processing ${eliminations.length} elimination(s)...`);

  // Check for later passing picks to avoid re-eliminating entries that bought back
  const laterPassingPicks = new Set();
  for (const pick of eliminations) {
    const allPicks = await docClient.send(new QueryCommand({
      TableName: TABLES.picks,
      IndexName: 'league-day-index',
      KeyConditionExpression: '#league = :league AND #gameDay > :day',
      ExpressionAttributeNames: { '#league': 'league', '#gameDay': 'gameDay' },
      ExpressionAttributeValues: { ':league': LEAGUE, ':day': dateStr }
    }));
    for (const p of (allPicks.Items || [])) {
      if (p.entryId === pick.entryId && p.passed === true) {
        laterPassingPicks.add(pick.entryId);
      }
    }
  }

  for (const pick of eliminations) {
    if (laterPassingPicks.has(pick.entryId)) {
      console.log(`   ⏭️  ${pick.playerName} (${pick.entryId}) → skipped (bought back and passed later)`);
      continue;
    }

    // Check if this entry already bought back from this elimination
    const entryResult = await docClient.send(new GetCommand({
      TableName: TABLES.entries,
      Key: { id: pick.entryId }
    }));
    const entry = entryResult.Item;
    if (entry && entry.buyBackCount > 0 && entry.lastBuyBackDay >= dateStr && entry.status === 'alive') {
      console.log(`   ⏭️  ${pick.playerName} (${pick.entryId}) → skipped (already bought back)`);
      continue;
    }

    await docClient.send(new UpdateCommand({
      TableName: TABLES.entries,
      Key: { id: pick.entryId },
      UpdateExpression: 'SET #status = :status, #eliminatedOnDay = :day, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#eliminatedOnDay': 'eliminatedOnDay',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':status': 'eliminated',
        ':day': dateStr,
        ':updatedAt': new Date().toISOString()
      }
    }));
    console.log(`   ❌ ${pick.playerName} (${pick.entryId}) → eliminated`);
  }
}

async function findUnresolvedDays() {
  const result = await docClient.send(new QueryCommand({
    TableName: TABLES.picks,
    IndexName: 'league-day-index',
    KeyConditionExpression: '#league = :league',
    FilterExpression: 'attribute_not_exists(#passed) OR #passed = :null',
    ExpressionAttributeNames: { '#league': 'league', '#passed': 'passed' },
    ExpressionAttributeValues: { ':league': LEAGUE, ':null': null }
  }));

  const days = new Set();
  for (const pick of (result.Items || [])) {
    if (pick.gameDay) days.add(pick.gameDay);
  }
  return [...days].sort();
}

async function processDay(dateStr) {
  const latestGames = await fetchLatestResults(dateStr);
  if (latestGames.length === 0) {
    console.log(`\n   ℹ️  No games found for ${dateStr}.`);
    return { eliminations: [], survivors: [] };
  }

  const schedule = await updateScheduleGames(dateStr, latestGames);
  if (!schedule) return { eliminations: [], survivors: [] };

  const { eliminations, survivors } = await evaluateAndUpdatePicks(dateStr, schedule);
  await processEliminations(eliminations, dateStr);
  return { eliminations, survivors };
}

async function main() {
  const dateStr = process.argv[2] || new Date().toISOString().split('T')[0];

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏀 NCAA Survivor - Results Updater');
  console.log(`📅 Date: ${dateStr}`);
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    // First, catch up on any previous days with unresolved picks
    const unresolvedDays = await findUnresolvedDays();
    const pastUnresolved = unresolvedDays.filter(d => d < dateStr);

    if (pastUnresolved.length > 0) {
      console.log(`\n🔄 Found ${pastUnresolved.length} past day(s) with unresolved picks: ${pastUnresolved.join(', ')}`);
      for (const pastDate of pastUnresolved) {
        console.log(`\n━━━ Catching up: ${pastDate} ━━━`);
        await processDay(pastDate);
      }
    }

    // Then process the target day
    console.log(`\n━━━ Processing: ${dateStr} ━━━`);
    await processDay(dateStr);

    const allEntries = await docClient.send(new QueryCommand({
      TableName: TABLES.entries,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
      ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON }
    }));
    const entries = allEntries.Items || [];
    const alive = entries.filter(e => e.status === 'alive').length;
    const eliminated = entries.filter(e => e.status === 'eliminated').length;

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 Pool Status:');
    console.log(`   🟢 Alive: ${alive}`);
    console.log(`   🔴 Eliminated: ${eliminated}`);
    console.log(`   📊 Total: ${entries.length}`);
    if (alive === 1) {
      const winner = entries.find(e => e.status === 'alive');
      console.log(`\n🏆 WINNER: ${winner.playerName}!`);
    } else if (alive === 0) {
      console.log(`\n⚠️  All entries eliminated! Last survivors split the pot.`);
    }
    console.log('═══════════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main();
