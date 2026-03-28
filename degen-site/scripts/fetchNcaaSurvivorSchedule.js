#!/usr/bin/env node

/**
 * Fetch NCAA Tournament daily schedules from ESPN API
 * Populates the survivor-schedule DynamoDB table with game matchups and lock times.
 *
 * Usage:
 *   node scripts/fetchNcaaSurvivorSchedule.js              # Fetch today's schedule
 *   node scripts/fetchNcaaSurvivorSchedule.js 2026-03-20   # Fetch a specific date
 *   node scripts/fetchNcaaSurvivorSchedule.js all           # Fetch entire tournament schedule
 */

require('dotenv').config();
const https = require('https');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

const LEAGUE = 'ncaa-survivor';
const SEASON = '2026';
const TABLE = 'sports-hub-survivor-schedule';

// ESPN NCAA Men's Basketball Tournament scoreboard endpoint
const ESPN_SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard';

// Tournament day mapping (date -> dayIndex + tournamentDay label)
// These dates are for the 2026 NCAA Tournament
const TOURNAMENT_DATES = {
  '2026-03-19': { dayIndex: 0, tournamentDay: 'Thursday R1' },
  '2026-03-20': { dayIndex: 1, tournamentDay: 'Friday R1' },
  '2026-03-21': { dayIndex: 2, tournamentDay: 'Saturday R2' },
  '2026-03-22': { dayIndex: 3, tournamentDay: 'Sunday R2' },
  '2026-03-26': { dayIndex: 4, tournamentDay: 'Thursday S16' },
  '2026-03-27': { dayIndex: 5, tournamentDay: 'Friday S16' },
  '2026-03-28': { dayIndex: 6, tournamentDay: 'Saturday E8' },
  '2026-03-29': { dayIndex: 7, tournamentDay: 'Sunday E8' },
  '2026-04-04': { dayIndex: 8, tournamentDay: 'Saturday F4' },
  '2026-04-06': { dayIndex: 9, tournamentDay: 'Monday Championship' }
};

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON: ' + data.substring(0, 200))); }
      });
    }).on('error', reject);
  });
}

async function fetchDaySchedule(dateStr) {
  const dateFormatted = dateStr.replace(/-/g, '');
  const url = `${ESPN_SCOREBOARD_URL}?dates=${dateFormatted}&groups=100&limit=100`;

  console.log(`\n📡 Fetching ESPN schedule for ${dateStr}...`);
  console.log(`   URL: ${url}`);

  const data = await httpGet(url);
  const events = data.events || [];

  // Filter to tournament games (group 100 is NCAA tournament)
  const games = events.map(event => {
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

  console.log(`   Found ${games.length} games`);
  games.forEach(g => {
    const status = g.status === 'completed' ? '✅' : g.status === 'in_progress' ? '🔴' : '⏳';
    console.log(`   ${status} (${g.team1Seed || '?'}) ${g.team1Name} vs (${g.team2Seed || '?'}) ${g.team2Name}`);
  });

  return games;
}

async function saveScheduleDay(dateStr, games) {
  const tournamentInfo = TOURNAMENT_DATES[dateStr];
  if (!tournamentInfo) {
    console.log(`   ⚠️  ${dateStr} is not a mapped tournament date. Skipping save.`);
    return;
  }

  // lockedAt = first game start time of the day
  let lockedAt = null;
  if (games.length > 0) {
    const gameTimes = games.map(g => g.startTime).filter(Boolean).sort();
    lockedAt = gameTimes[0] || null;
  }

  const item = {
    id: `${LEAGUE}-${SEASON}-${dateStr}`,
    league: LEAGUE,
    season: SEASON,
    gameDay: dateStr,
    tournamentDay: tournamentInfo.tournamentDay,
    dayIndex: tournamentInfo.dayIndex,
    games: games,
    lockedAt: lockedAt,
    updatedAt: new Date().toISOString()
  };

  await docClient.send(new PutCommand({ TableName: TABLE, Item: item }));
  console.log(`   💾 Saved ${games.length} games for ${dateStr} (dayIndex: ${tournamentInfo.dayIndex})`);
  if (lockedAt) {
    const lockTime = new Date(lockedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    console.log(`   🔒 Picks lock at: ${lockTime}`);
  }
}

async function main() {
  const arg = process.argv[2];

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏀 NCAA Survivor - ESPN Schedule Fetcher');
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    if (arg === 'all') {
      console.log('\nFetching schedule for all tournament dates...');
      for (const dateStr of Object.keys(TOURNAMENT_DATES)) {
        try {
          const games = await fetchDaySchedule(dateStr);
          if (games.length > 0) {
            await saveScheduleDay(dateStr, games);
          } else {
            console.log(`   ℹ️  No games found for ${dateStr} (may not be scheduled yet)`);
          }
        } catch (err) {
          console.error(`   ❌ Error for ${dateStr}: ${err.message}`);
        }
      }
    } else {
      const dateStr = arg || new Date().toISOString().split('T')[0];
      const games = await fetchDaySchedule(dateStr);
      if (games.length > 0) {
        await saveScheduleDay(dateStr, games);
      } else {
        console.log(`   ℹ️  No games found for ${dateStr}`);
      }
    }

    console.log('\n✅ Done!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
