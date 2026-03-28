#!/usr/bin/env node

/**
 * NCAA Tournament Results Update Script
 * Fetches game results from ESPN API, updates bracket, marks eliminated teams,
 * and calculates point scores
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand, UpdateCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

const TABLES = {
  teams: 'sports-hub-teams',
  ncaaTourneyGames: 'sports-hub-ncaa-tourney-games'
};

let LEAGUE = 'ncaa-tourney';
const SEASON = process.argv[2] || '2026';
let SPORTS_LEAGUE = 'NCAA-TOURNEY';

// Point values per round
const POINTS_PER_ROUND = {
  1: 3,   // Round of 64
  2: 6,   // Round of 32
  3: 9,   // Sweet 16
  4: 12,  // Elite 8
  5: 15,  // Final Four
  6: 18   // Championship
};

// Normalize team name for matching
function normalizeTeamName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Match ESPN team name to our team
function matchTeamName(espnName, teams) {
  const normalizedEspn = normalizeTeamName(espnName);
  
  // Try exact match
  let match = teams.find(t => normalizeTeamName(t.name) === normalizedEspn);
  if (match) return match;
  
  // Try partial match
  match = teams.find(t => {
    const normalizedDb = normalizeTeamName(t.name);
    return normalizedEspn.includes(normalizedDb) || normalizedDb.includes(normalizedEspn);
  });
  if (match) return match;
  
  // Try mascot match (last word)
  const espnWords = normalizedEspn.split(' ');
  const espnMascot = espnWords[espnWords.length - 1];
  
  match = teams.find(t => {
    const dbWords = normalizeTeamName(t.name).split(' ');
    return dbWords[dbWords.length - 1] === espnMascot;
  });
  
  return match;
}

// Fetch NCAA tournament results from ESPN
async function fetchEspnResults() {
  console.log('🏀 Fetching NCAA Tournament results from ESPN...\n');
  
  const results = [];
  
  // ESPN NCAA Tournament scoreboard endpoint
  const TOURNAMENT_DATES = {
    '2025': [
      '20250318', '20250319', '20250320', '20250321',
      '20250322', '20250323', '20250327', '20250328',
      '20250329', '20250330', '20250405', '20250407'
    ],
    '2026': [
      '20260317', '20260318', '20260319', '20260320',
      '20260321', '20260322', '20260326', '20260327',
      '20260328', '20260329', '20260404', '20260406'
    ]
  };
  const dates = TOURNAMENT_DATES[SEASON] || TOURNAMENT_DATES['2026'];
  
  for (const date of dates) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}&groups=100`;
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.events && data.events.length > 0) {
          data.events.forEach(event => {
            // Check if it's an NCAA tournament game
            const isTournament = event.season?.type === 3 || 
                                 event.competitions?.[0]?.notes?.[0]?.headline?.includes('NCAA') ||
                                 event.competitions?.[0]?.groups?.id === '100';
            
            if (isTournament || true) { // Include all games during tournament dates
              const competition = event.competitions?.[0];
              if (competition && competition.status?.type?.completed) {
                const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
                const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');
                
                if (homeTeam && awayTeam) {
                  const homeScore = parseInt(homeTeam.score) || 0;
                  const awayScore = parseInt(awayTeam.score) || 0;
                  
                  results.push({
                    date: date,
                    homeTeam: homeTeam.team?.displayName || homeTeam.team?.name,
                    homeSeed: homeTeam.curatedRank?.current || null,
                    homeScore: homeScore,
                    awayTeam: awayTeam.team?.displayName || awayTeam.team?.name,
                    awaySeed: awayTeam.curatedRank?.current || null,
                    awayScore: awayScore,
                    winner: homeScore > awayScore ? 'home' : 'away',
                    round: event.competitions?.[0]?.type?.id
                  });
                }
              }
            }
          });
        }
      }
    } catch (err) {
      console.log(`   Error fetching ${date}: ${err.message}`);
    }
  }
  
  console.log(`✅ Found ${results.length} completed games\n`);
  return results;
}

// Get all NCAA Tournament teams
async function getNcaaTourneyTeams() {
  const command = new ScanCommand({
    TableName: TABLES.teams,
    FilterExpression: '#season = :season AND #sportsLeague = :sportsLeague',
    ExpressionAttributeNames: {
      '#season': 'season',
      '#sportsLeague': 'sportsLeague'
    },
    ExpressionAttributeValues: {
      ':season': SEASON,
      ':sportsLeague': SPORTS_LEAGUE
    }
  });
  
  const result = await docClient.send(command);
  return result.Items || [];
}

// Get all bracket games
async function getBracketGames() {
  const command = new QueryCommand({
    TableName: TABLES.ncaaTourneyGames,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: {
      '#league': 'league',
      '#season': 'season'
    },
    ExpressionAttributeValues: {
      ':league': LEAGUE,
      ':season': SEASON
    }
  });
  
  const result = await docClient.send(command);
  return (result.Items || []).sort((a, b) => {
    if (a.round !== b.round) return a.round - b.round;
    return a.gameNum - b.gameNum;
  });
}

// Update a bracket game
async function updateGame(gameId, updates) {
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  Object.keys(updates).forEach((key, index) => {
    if (updates[key] !== undefined) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updates[key];
    }
  });
  
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  updateExpressions.push('#updatedAt = :updatedAt');
  
  const command = new UpdateCommand({
    TableName: TABLES.ncaaTourneyGames,
    Key: { id: gameId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  });
  
  await docClient.send(command);
}

// Update team in DynamoDB
async function updateTeam(teamId, updates) {
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  Object.keys(updates).forEach((key, index) => {
    if (updates[key] !== undefined) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updates[key];
    }
  });
  
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  updateExpressions.push('#updatedAt = :updatedAt');
  
  const command = new UpdateCommand({
    TableName: TABLES.teams,
    Key: { id: teamId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues
  });
  
  await docClient.send(command);
}

// Calculate points for a team based on their wins
async function calculateTeamPoints(team, games) {
  let totalPoints = 0;
  const breakdown = {};
  
  // Find all games where this team won
  for (const game of games) {
    if (game.winnerId === team.id && game.status === 'completed') {
      const round = game.round;
      const basePoints = POINTS_PER_ROUND[round] || 0;
      
      // Get opponent seed from the game
      const opponentSeed = game.team1Id === team.id ? game.team2Seed : game.team1Seed;
      const teamSeed = team.seed || 16;
      
      // Calculate upset bonus (only if winner is lower seed - higher number)
      let upsetBonus = 0;
      if (teamSeed > opponentSeed) {
        upsetBonus = teamSeed - opponentSeed;
      }
      
      const roundPoints = basePoints + upsetBonus;
      
      const roundNames = {
        1: 'Round of 64',
        2: 'Round of 32',
        3: 'Sweet 16',
        4: 'Elite 8',
        5: 'Final Four',
        6: 'Championship'
      };
      
      breakdown[roundNames[round] || `Round ${round}`] = {
        base: basePoints,
        bonus: upsetBonus,
        total: roundPoints,
        opponent: opponentSeed ? `#${opponentSeed} seed` : 'Unknown'
      };
      
      totalPoints += roundPoints;
    }
  }
  
  return { total: totalPoints, breakdown };
}

// Process results and update bracket
async function processResults(espnResults, teams, games) {
  console.log('📊 Processing results and updating bracket...\n');
  
  let gamesUpdated = 0;
  let teamsEliminated = 0;
  
  for (const result of espnResults) {
    // Match teams from ESPN to our database
    const winnerName = result.winner === 'home' ? result.homeTeam : result.awayTeam;
    const loserName = result.winner === 'home' ? result.awayTeam : result.homeTeam;
    const winnerScore = result.winner === 'home' ? result.homeScore : result.awayScore;
    const loserScore = result.winner === 'home' ? result.awayScore : result.homeScore;
    
    const winnerTeam = matchTeamName(winnerName, teams);
    const loserTeam = matchTeamName(loserName, teams);
    
    if (!winnerTeam || !loserTeam) {
      if (!winnerTeam) console.log(`   ⚠️  No DB match for ESPN winner: "${winnerName}"`);
      if (!loserTeam) console.log(`   ⚠️  No DB match for ESPN loser: "${loserName}"`);
      continue;
    }

    // Find the matching bracket game
    const game = games.find(g => 
      (g.team1Id === winnerTeam.id && g.team2Id === loserTeam.id) ||
      (g.team1Id === loserTeam.id && g.team2Id === winnerTeam.id)
    );
    
    if (!game) {
      console.log(`   ⚠️  No bracket game for: ${winnerTeam.name} vs ${loserTeam.name}`);
      continue;
    }
    
    if (game.status === 'completed') {
      continue; // Already updated, skip silently
    }
    
    // Update game with result
    const score1 = game.team1Id === winnerTeam.id ? winnerScore : loserScore;
    const score2 = game.team2Id === winnerTeam.id ? winnerScore : loserScore;
    
    await updateGame(game.id, {
      winnerId: winnerTeam.id,
      score1: score1,
      score2: score2,
      status: 'completed'
    });
    
    console.log(`✅ R${game.round}: ${winnerTeam.name} def. ${loserTeam.name} (${winnerScore}-${loserScore})`);
    gamesUpdated++;
    
    // Mark loser as eliminated
    if (!loserTeam.eliminated) {
      await updateTeam(loserTeam.id, { eliminated: true });
      console.log(`   ❌ ${loserTeam.name} eliminated`);
      teamsEliminated++;
    }
    
    // Update the game object in memory for point calculations
    game.winnerId = winnerTeam.id;
    game.status = 'completed';
    game.score1 = score1;
    game.score2 = score2;

    // Advance winner to next round
    await advanceWinnerToNextRound(game, winnerTeam, games);
  }
  
  return { gamesUpdated, teamsEliminated };
}

// Advance a winner into the appropriate slot of the next round game
async function advanceWinnerToNextRound(game, winnerTeam, games) {
  const nextRound = game.round + 1;
  if (nextRound > 6) return;

  let nextGame = null;
  let isTeam1 = false;

  if (game.round === 4) {
    const finalFourGameNum = (game.region === 'East' || game.region === 'West') ? 1 : 2;
    nextGame = games.find(g => g.round === 5 && g.region === 'FinalFour' && g.gameNum === finalFourGameNum);
    isTeam1 = (game.region === 'East' || game.region === 'South');
  } else if (game.round === 5) {
    nextGame = games.find(g => g.round === 6 && g.region === 'Championship');
    isTeam1 = game.gameNum === 1;
  } else {
    const nextGameNum = Math.ceil(game.gameNum / 2);
    nextGame = games.find(g => g.round === nextRound && g.region === game.region && g.gameNum === nextGameNum);
    isTeam1 = game.gameNum % 2 === 1;
  }

  if (nextGame) {
    const slot = isTeam1 ? 'team1Id' : 'team2Id';
    const currentVal = nextGame[slot];
    if (!currentVal || currentVal !== winnerTeam.id) {
      await updateGame(nextGame.id, { [slot]: winnerTeam.id });
      nextGame[slot] = winnerTeam.id;
      console.log(`   → Advanced ${winnerTeam.name} to R${nextRound} G${nextGame.gameNum} ${nextGame.region} (${slot})`);
    }
  }
}

// Update all team point totals using BatchWriteCommand for efficiency
async function updateAllTeamPoints(teams, games) {
  console.log('\n📈 Recalculating all team points...\n');
  
  const now = new Date().toISOString();
  const teamsToUpdate = [];
  
  for (const team of teams) {
    const { total, breakdown } = await calculateTeamPoints(team, games);
    const breakdownStr = JSON.stringify(breakdown);
    
    if (total !== team.totalPoints || breakdownStr !== team.pointBreakdown) {
      teamsToUpdate.push({
        ...team,
        totalPoints: total,
        pointBreakdown: breakdownStr,
        updatedAt: now
      });
      if (total > 0) {
        console.log(`   ${team.name}: ${total} pts`);
      }
    }
  }
  
  if (teamsToUpdate.length === 0) {
    console.log('   All points up to date');
    return 0;
  }

  const BATCH_SIZE = 25;

  for (let i = 0; i < teamsToUpdate.length; i += BATCH_SIZE) {
    const batch = teamsToUpdate.slice(i, i + BATCH_SIZE);
    let result = await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLES.teams]: batch.map(item => ({ PutRequest: { Item: item } }))
      }
    }));

    for (let retry = 1; retry <= 3; retry++) {
      const unprocessed = result.UnprocessedItems?.[TABLES.teams];
      if (!unprocessed || unprocessed.length === 0) break;
      await new Promise(r => setTimeout(r, 100 * retry));
      result = await docClient.send(new BatchWriteCommand({
        RequestItems: { [TABLES.teams]: unprocessed }
      }));
    }
  }
  
  console.log(`\n✅ Updated points for ${teamsToUpdate.length} teams`);
  return teamsToUpdate.length;
}

async function runForLeague(leagueName, sportsLeagueName, espnResults) {
  LEAGUE = leagueName;
  SPORTS_LEAGUE = sportsLeagueName;

  console.log(`\n━━━ ${leagueName} (${sportsLeagueName}) ━━━\n`);

  const [teams, games] = await Promise.all([
    getNcaaTourneyTeams(),
    getBracketGames()
  ]);
  
  console.log(`📋 Found ${teams.length} teams and ${games.length} bracket games\n`);
    
    if (teams.length === 0) {
      console.log('⚠️  No teams found. Run setupNcaaTourney2025.js first.');
      process.exit(1);
    }
    
    if (espnResults.length === 0) {
      console.log('ℹ️  No completed games found (tournament may not have started).');
      console.log('   Points will be calculated based on existing game results.\n');
    } else {
      // Process results and update bracket
      const { gamesUpdated, teamsEliminated } = await processResults(espnResults, teams, games);
      console.log(`\n📊 Updated ${gamesUpdated} games, eliminated ${teamsEliminated} teams`);
    }
    
    // Repair: advance any completed game winners that weren't propagated to next round
    console.log('\n🔧 Checking for unadavanced winners...');
    let repaired = 0;
    for (const game of games) {
      if (game.status === 'completed' && game.winnerId && game.round < 6) {
        const winnerTeam = teams.find(t => t.id === game.winnerId);
        if (winnerTeam) {
          const nextRound = game.round + 1;
          let nextGame = null;
          let isTeam1 = false;

          if (game.round === 4) {
            const ffNum = (game.region === 'East' || game.region === 'West') ? 1 : 2;
            nextGame = games.find(g => g.round === 5 && g.region === 'FinalFour' && g.gameNum === ffNum);
            isTeam1 = (game.region === 'East' || game.region === 'South');
          } else if (game.round === 5) {
            nextGame = games.find(g => g.round === 6 && g.region === 'Championship');
            isTeam1 = game.gameNum === 1;
          } else {
            const nextGameNum = Math.ceil(game.gameNum / 2);
            nextGame = games.find(g => g.round === nextRound && g.region === game.region && g.gameNum === nextGameNum);
            isTeam1 = game.gameNum % 2 === 1;
          }

          if (nextGame) {
            const slot = isTeam1 ? 'team1Id' : 'team2Id';
            if (!nextGame[slot] || nextGame[slot] !== game.winnerId) {
              await updateGame(nextGame.id, { [slot]: game.winnerId });
              nextGame[slot] = game.winnerId;
              console.log(`   🔧 R${game.round} G${game.gameNum} ${game.region}: ${winnerTeam.name} → R${nextRound} G${nextGame.gameNum} (${slot})`);
              repaired++;
            }
          }
        }
      }
    }
    if (repaired > 0) {
      console.log(`   ✅ Repaired ${repaired} next-round slots`);
    } else {
      console.log('   ✅ All winners properly advanced');
    }

  // Recalculate all team points
  await updateAllTeamPoints(teams, games);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`🏀 NCAA Tournament Results Update (Season ${SEASON})`);
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    const espnResults = await fetchEspnResults();

    await runForLeague('ncaa-tourney', 'NCAA-TOURNEY', espnResults);
    await runForLeague('ncaa-tourney-4', 'NCAA-TOURNEY-4', espnResults);

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ All brackets updated!');
    console.log('═══════════════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main();
