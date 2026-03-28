#!/usr/bin/env node

/**
 * Script to reset all NCAA Tournament 2025 results
 * This will:
 * 1. Clear all game winners
 * 2. Reset team slots for rounds 2-6 (keep round 1 matchups)
 * 3. Reset eliminated status on all teams
 * 4. Reset points on all teams
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const GAMES_TABLE = 'sports-hub-ncaa-tourney-games';
const TEAMS_TABLE = 'sports-hub-teams';

const GAMES_LEAGUE = 'ncaa-tourney';
const TEAMS_LEAGUE = 'NCAA';
const SEASON = '2025';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function resetNcaaTourneyResults() {
  console.log('🏀 Resetting NCAA Tournament 2025 Results...\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Fetch all games
    console.log('📋 Step 1: Fetching all NCAA Tournament games...');
    
    const gamesCommand = new QueryCommand({
      TableName: GAMES_TABLE,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: {
        '#league': 'league',
        '#season': 'season'
      },
      ExpressionAttributeValues: {
        ':league': GAMES_LEAGUE,
        ':season': SEASON
      }
    });
    
    const gamesResult = await docClient.send(gamesCommand);
    const games = gamesResult.Items || [];
    console.log(`   Found ${games.length} games\n`);

    // Step 2: Reset all games
    console.log('🔄 Step 2: Resetting all game results...');
    
    let gamesReset = 0;
    for (const game of games) {
      const updateParams = {
        TableName: GAMES_TABLE,
        Key: { id: game.id },
        UpdateExpression: 'SET #status = :status, #winnerId = :winnerId',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#winnerId': 'winnerId'
        },
        ExpressionAttributeValues: {
          ':status': 'scheduled',
          ':winnerId': null
        }
      };
      
      // For rounds 2-6, also clear team slots
      if (game.round > 1) {
        updateParams.UpdateExpression = 'SET #status = :status, #winnerId = :winnerId, #team1Id = :team1Id, #team2Id = :team2Id, #team1Seed = :team1Seed, #team2Seed = :team2Seed';
        updateParams.ExpressionAttributeNames['#team1Id'] = 'team1Id';
        updateParams.ExpressionAttributeNames['#team2Id'] = 'team2Id';
        updateParams.ExpressionAttributeNames['#team1Seed'] = 'team1Seed';
        updateParams.ExpressionAttributeNames['#team2Seed'] = 'team2Seed';
        updateParams.ExpressionAttributeValues[':team1Id'] = null;
        updateParams.ExpressionAttributeValues[':team2Id'] = null;
        updateParams.ExpressionAttributeValues[':team1Seed'] = null;
        updateParams.ExpressionAttributeValues[':team2Seed'] = null;
      }
      
      await docClient.send(new UpdateCommand(updateParams));
      gamesReset++;
      
      const roundName = {
        1: 'Round of 64',
        2: 'Round of 32',
        3: 'Sweet 16',
        4: 'Elite 8',
        5: 'Final Four',
        6: 'Championship'
      }[game.round] || `Round ${game.round}`;
      
      if (game.round > 1) {
        console.log(`   ✅ Reset: ${roundName} Game ${game.gameNum} (${game.region}) - cleared teams and winner`);
      } else {
        console.log(`   ✅ Reset: ${roundName} Game ${game.gameNum} (${game.region}) - cleared winner`);
      }
    }
    
    console.log(`\n   Total games reset: ${gamesReset}\n`);

    // Step 3: Fetch all NCAA teams
    console.log('📋 Step 3: Fetching all NCAA Tournament teams...');
    
    // NCAA Tournament teams have sportsLeague = 'NCAA-TOURNEY' (not league = 'NCAA')
    const teamsCommand = new ScanCommand({
      TableName: TEAMS_TABLE,
      FilterExpression: '#sportsLeague = :sportsLeague AND #season = :season',
      ExpressionAttributeNames: {
        '#sportsLeague': 'sportsLeague',
        '#season': 'season'
      },
      ExpressionAttributeValues: {
        ':sportsLeague': 'NCAA-TOURNEY',
        ':season': SEASON
      }
    });
    
    const teamsResult = await docClient.send(teamsCommand);
    const teams = teamsResult.Items || [];
    console.log(`   Found ${teams.length} teams\n`);

    // Step 4: Reset team eliminated status and points
    console.log('🔄 Step 4: Resetting team eliminated status and points...');
    
    let teamsReset = 0;
    let eliminatedTeamsCount = 0;
    let teamsWithPointsCount = 0;
    
    for (const team of teams) {
      // Use REMOVE to completely delete the eliminated attribute, and SET for points
      const updateParams = {
        TableName: TEAMS_TABLE,
        Key: { id: team.id },
        UpdateExpression: 'REMOVE #eliminated SET #totalPoints = :totalPoints, #pointBreakdown = :pointBreakdown',
        ExpressionAttributeNames: {
          '#eliminated': 'eliminated',
          '#totalPoints': 'totalPoints',
          '#pointBreakdown': 'pointBreakdown'
        },
        ExpressionAttributeValues: {
          ':totalPoints': 0,
          ':pointBreakdown': null
        }
      };
      
      await docClient.send(new UpdateCommand(updateParams));
      teamsReset++;
      
      const wasEliminated = team.eliminated === true;
      const hadPoints = (team.totalPoints || 0) > 0;
      
      if (wasEliminated) eliminatedTeamsCount++;
      if (hadPoints) teamsWithPointsCount++;
      
      // Log all teams for visibility
      const status = wasEliminated ? '❌ ELIMINATED → ✅ ACTIVE' : '✅ active';
      const points = hadPoints ? `${team.totalPoints} pts → 0 pts` : '0 pts';
      console.log(`   ✅ Reset: #${team.seed || '?'} ${team.name} - ${status}, ${points}`);
    }
    
    console.log(`\n   Total teams reset: ${teamsReset}`);
    console.log(`   Teams that were eliminated: ${eliminatedTeamsCount}`);
    console.log(`   Teams that had points: ${teamsWithPointsCount}\n`);

    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ Reset Complete!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📊 Games reset: ${gamesReset}`);
    console.log(`   - Round 1 games: winners cleared, teams preserved`);
    console.log(`   - Rounds 2-6 games: winners AND team slots cleared`);
    console.log(`🏀 Teams reset: ${teamsReset}`);
    console.log(`   - All eliminated statuses set to false`);
    console.log(`   - All points reset to 0`);
    console.log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error resetting NCAA Tournament results:', error);
    process.exit(1);
  }
}

// Run the script
resetNcaaTourneyResults();
