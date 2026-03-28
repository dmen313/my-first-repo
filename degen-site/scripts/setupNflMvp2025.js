#!/usr/bin/env node

/**
 * NFL MVP 2025 Draft Setup Script
 * Creates all 32 NFL players as "teams", payout structure, and pre-filled draft picks
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY || process.env.ODDS_API_KEY;

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

const TABLES = {
  teams: 'sports-hub-teams',
  payouts: 'sports-hub-payouts',
  leagueSettings: 'sports-hub-league-settings',
  draftPicks: 'sports-hub-draft-picks',
  draftStatuses: 'sports-hub-draft-statuses'
};

// Generate unique ID
function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// All 32 NFL MVP candidates with their teams and estimated odds
// Organized by draft pick order (DM, KH, TG, MC snake draft)
const NFL_MVP_PLAYERS = [
  // Round 1: DM, KH, TG, MC
  { name: 'Lamar Jackson', nflTeam: 'Baltimore Ravens', position: 'QB', odds: '+350' },
  { name: 'Josh Allen', nflTeam: 'Buffalo Bills', position: 'QB', odds: '+400' },
  { name: 'Joe Burrow', nflTeam: 'Cincinnati Bengals', position: 'QB', odds: '+600' },
  { name: 'Jayden Daniels', nflTeam: 'Washington Commanders', position: 'QB', odds: '+800' },
  
  // Round 2: MC, TG, KH, DM (snake)
  { name: 'Patrick Mahomes', nflTeam: 'Kansas City Chiefs', position: 'QB', odds: '+500' },
  { name: 'Jalen Hurts', nflTeam: 'Philadelphia Eagles', position: 'QB', odds: '+1000' },
  { name: 'Jordan Love', nflTeam: 'Green Bay Packers', position: 'QB', odds: '+1200' },
  { name: 'Baker Mayfield', nflTeam: 'Tampa Bay Buccaneers', position: 'QB', odds: '+2000' },
  
  // Round 3: DM, KH, TG, MC
  { name: 'CJ Stroud', nflTeam: 'Houston Texans', position: 'QB', odds: '+1500' },
  { name: 'Justin Herbert', nflTeam: 'Los Angeles Chargers', position: 'QB', odds: '+2500' },
  { name: 'Jared Goff', nflTeam: 'Detroit Lions', position: 'QB', odds: '+1800' },
  { name: 'Brock Purdy', nflTeam: 'San Francisco 49ers', position: 'QB', odds: '+2000' },
  
  // Round 4: MC, TG, KH, DM (snake)
  { name: 'Bo Nix', nflTeam: 'Denver Broncos', position: 'QB', odds: '+4000' },
  { name: 'Kyler Murray', nflTeam: 'Arizona Cardinals', position: 'QB', odds: '+5000' },
  { name: 'Trevor Lawrence', nflTeam: 'Jacksonville Jaguars', position: 'QB', odds: '+3500' },
  { name: 'Matthew Stafford', nflTeam: 'Los Angeles Rams', position: 'QB', odds: '+4000' },
  
  // Round 5: DM, KH, TG, MC
  { name: 'Dak Prescott', nflTeam: 'Dallas Cowboys', position: 'QB', odds: '+3000' },
  { name: 'Caleb Williams', nflTeam: 'Chicago Bears', position: 'QB', odds: '+3500' },
  { name: 'Saquon Barkley', nflTeam: 'Philadelphia Eagles', position: 'RB', odds: '+5000' },
  { name: 'Michael Penix Jr.', nflTeam: 'Atlanta Falcons', position: 'QB', odds: '+6000' },
  
  // Round 6: MC, TG, KH, DM (snake)
  { name: 'Christian McCaffrey', nflTeam: 'San Francisco 49ers', position: 'RB', odds: '+6000' },
  { name: 'JJ McCarthy', nflTeam: 'Minnesota Vikings', position: 'QB', odds: '+8000' },
  { name: 'Drake Maye', nflTeam: 'New England Patriots', position: 'QB', odds: '+7000' },
  { name: "Ja'Marr Chase", nflTeam: 'Cincinnati Bengals', position: 'WR', odds: '+8000' },
  
  // Round 7: DM, KH, TG, MC
  { name: 'Aaron Rodgers', nflTeam: 'New York Jets', position: 'QB', odds: '+10000' },
  { name: 'Tua Tagovailoa', nflTeam: 'Miami Dolphins', position: 'QB', odds: '+5000' },
  { name: 'Sam Darnold', nflTeam: 'Minnesota Vikings', position: 'QB', odds: '+15000' },
  { name: 'Geno Smith', nflTeam: 'Seattle Seahawks', position: 'QB', odds: '+12000' },
  
  // Round 8: MC, TG, KH, DM (snake)
  { name: 'Bryce Young', nflTeam: 'Carolina Panthers', position: 'QB', odds: '+20000' },
  { name: 'Justin Jefferson', nflTeam: 'Minnesota Vikings', position: 'WR', odds: '+10000' },
  { name: 'Cam Ward', nflTeam: 'TBD (2025 Draft)', position: 'QB', odds: '+15000' },
  { name: 'Jahmyr Gibbs', nflTeam: 'Detroit Lions', position: 'RB', odds: '+15000' }
];

// Draft picks already made - mapping pick number to player and owner
// Based on the image: columns are DM, KH, TG, MC
const DRAFT_RESULTS = [
  // Round 1: DM, KH, TG, MC
  { round: 1, pick: 1, owner: 'DM', player: 'Lamar Jackson' },
  { round: 1, pick: 2, owner: 'KH', player: 'Josh Allen' },
  { round: 1, pick: 3, owner: 'TG', player: 'Joe Burrow' },
  { round: 1, pick: 4, owner: 'MC', player: 'Jayden Daniels' },
  
  // Round 2: MC, TG, KH, DM (snake)
  { round: 2, pick: 5, owner: 'MC', player: 'Patrick Mahomes' },
  { round: 2, pick: 6, owner: 'TG', player: 'Jalen Hurts' },
  { round: 2, pick: 7, owner: 'KH', player: 'Jordan Love' },
  { round: 2, pick: 8, owner: 'DM', player: 'Baker Mayfield' },
  
  // Round 3: DM, KH, TG, MC
  { round: 3, pick: 9, owner: 'DM', player: 'CJ Stroud' },
  { round: 3, pick: 10, owner: 'KH', player: 'Justin Herbert' },
  { round: 3, pick: 11, owner: 'TG', player: 'Jared Goff' },
  { round: 3, pick: 12, owner: 'MC', player: 'Brock Purdy' },
  
  // Round 4: MC, TG, KH, DM (snake)
  { round: 4, pick: 13, owner: 'MC', player: 'Bo Nix' },
  { round: 4, pick: 14, owner: 'TG', player: 'Kyler Murray' },
  { round: 4, pick: 15, owner: 'KH', player: 'Trevor Lawrence' },
  { round: 4, pick: 16, owner: 'DM', player: 'Matthew Stafford' },
  
  // Round 5: DM, KH, TG, MC
  { round: 5, pick: 17, owner: 'DM', player: 'Dak Prescott' },
  { round: 5, pick: 18, owner: 'KH', player: 'Caleb Williams' },
  { round: 5, pick: 19, owner: 'TG', player: 'Saquon Barkley' },
  { round: 5, pick: 20, owner: 'MC', player: 'Michael Penix Jr.' },
  
  // Round 6: MC, TG, KH, DM (snake)
  { round: 6, pick: 21, owner: 'MC', player: 'Christian McCaffrey' },
  { round: 6, pick: 22, owner: 'TG', player: 'JJ McCarthy' },
  { round: 6, pick: 23, owner: 'KH', player: 'Drake Maye' },
  { round: 6, pick: 24, owner: 'DM', player: "Ja'Marr Chase" },
  
  // Round 7: DM, KH, TG, MC
  { round: 7, pick: 25, owner: 'DM', player: 'Aaron Rodgers' },
  { round: 7, pick: 26, owner: 'KH', player: 'Tua Tagovailoa' },
  { round: 7, pick: 27, owner: 'TG', player: 'Sam Darnold' },
  { round: 7, pick: 28, owner: 'MC', player: 'Geno Smith' },
  
  // Round 8: MC, TG, KH, DM (snake)
  { round: 8, pick: 29, owner: 'MC', player: 'Bryce Young' },
  { round: 8, pick: 30, owner: 'TG', player: 'Justin Jefferson' },
  { round: 8, pick: 31, owner: 'KH', player: 'Cam Ward' },
  { round: 8, pick: 32, owner: 'DM', player: 'Jahmyr Gibbs' }
];

// Payout structure
const PAYOUT_STRUCTURE = [
  { level: '1st Place (MVP Winner)', teams: 1, percentage: 60.00 },  // $1200
  { level: '2nd Place', teams: 1, percentage: 30.00 },               // $600
  { level: '3rd Place', teams: 1, percentage: 10.00 }                // $200
];

// League settings
const LEAGUE_SETTINGS = {
  buyInPerTeam: 500,
  numTeams: 4,
  totalPool: 2000
};

// Check if NFL MVP 2025 data already exists
async function checkExistingData() {
  const command = new ScanCommand({
    TableName: TABLES.teams,
    FilterExpression: '#season = :season AND #sportsLeague = :sportsLeague',
    ExpressionAttributeNames: {
      '#season': 'season',
      '#sportsLeague': 'sportsLeague'
    },
    ExpressionAttributeValues: {
      ':season': '2025',
      ':sportsLeague': 'NFL-MVP'
    }
  });
  
  const result = await docClient.send(command);
  return result.Items || [];
}

// Delete existing data
async function deleteExistingData(items) {
  console.log(`🗑️  Deleting ${items.length} existing NFL MVP 2025 entries...`);
  
  for (const item of items) {
    const command = new DeleteCommand({
      TableName: TABLES.teams,
      Key: { id: item.id }
    });
    await docClient.send(command);
  }
}

// Create NFL MVP players as "teams"
async function createPlayers() {
  console.log('\n🏈 Creating NFL MVP 2025 players...\n');
  
  const now = new Date().toISOString();
  const playerMap = {}; // Store player IDs for draft pick creation
  
  for (const player of NFL_MVP_PLAYERS) {
    const id = generateId();
    playerMap[player.name] = id;
    
    const team = {
      id: id,
      name: player.name,
      league: player.position,           // Use position as "conference" for grouping
      division: player.nflTeam,          // Use NFL team as division
      sportsLeague: 'NFL-MVP',
      season: '2025',
      record: '0-0',
      wins: 0,
      losses: 0,
      odds: player.odds,
      owner: null,                        // Will be set by draft picks
      createdAt: now,
      updatedAt: now
    };
    
    const command = new PutCommand({
      TableName: TABLES.teams,
      Item: team
    });
    
    await docClient.send(command);
    console.log(`✅ Created: ${player.name} (${player.nflTeam}, ${player.position}) - ${player.odds}`);
  }
  
  console.log(`\n✅ Created ${NFL_MVP_PLAYERS.length} NFL MVP candidates`);
  return playerMap;
}

// Delete existing payouts
async function deleteExistingPayouts() {
  const command = new QueryCommand({
    TableName: TABLES.payouts,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: {
      '#league': 'league',
      '#season': 'season'
    },
    ExpressionAttributeValues: {
      ':league': 'nfl-mvp',
      ':season': '2025'
    }
  });
  
  const result = await docClient.send(command);
  const payouts = result.Items || [];
  
  if (payouts.length > 0) {
    console.log(`🗑️  Deleting ${payouts.length} existing NFL MVP 2025 payouts...`);
    
    for (const payout of payouts) {
      const deleteCommand = new DeleteCommand({
        TableName: TABLES.payouts,
        Key: { id: payout.id }
      });
      await docClient.send(deleteCommand);
    }
  }
}

// Create payout structure
async function createPayoutStructure() {
  console.log('\n💰 Creating NFL MVP 2025 payout structure...\n');
  
  const now = new Date().toISOString();
  
  for (const payout of PAYOUT_STRUCTURE) {
    const item = {
      id: generateId(),
      league: 'nfl-mvp',
      season: '2025',
      level: payout.level,
      teams: payout.teams,
      percentage: payout.percentage,
      createdAt: now,
      updatedAt: now
    };
    
    const command = new PutCommand({
      TableName: TABLES.payouts,
      Item: item
    });
    
    await docClient.send(command);
    
    const payoutAmount = (LEAGUE_SETTINGS.totalPool * payout.percentage / 100);
    console.log(`✅ ${payout.level}: $${payoutAmount.toFixed(0)} (${payout.percentage}%)`);
  }
  
  console.log('\n✅ Payout structure created');
}

// Delete existing league settings
async function deleteExistingLeagueSettings() {
  const command = new QueryCommand({
    TableName: TABLES.leagueSettings,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: {
      '#league': 'league',
      '#season': 'season'
    },
    ExpressionAttributeValues: {
      ':league': 'nfl-mvp',
      ':season': '2025'
    }
  });
  
  const result = await docClient.send(command);
  const settings = result.Items || [];
  
  for (const setting of settings) {
    const deleteCommand = new DeleteCommand({
      TableName: TABLES.leagueSettings,
      Key: { id: setting.id }
    });
    await docClient.send(deleteCommand);
  }
}

// Create league settings
async function createLeagueSettings() {
  console.log('\n⚙️  Creating NFL MVP 2025 league settings...');
  
  const now = new Date().toISOString();
  
  const settings = {
    id: generateId(),
    league: 'nfl-mvp',
    season: '2025',
    buyInPerTeam: LEAGUE_SETTINGS.buyInPerTeam,
    numTeams: LEAGUE_SETTINGS.numTeams,
    totalPool: LEAGUE_SETTINGS.totalPool,
    createdAt: now,
    updatedAt: now
  };
  
  const command = new PutCommand({
    TableName: TABLES.leagueSettings,
    Item: settings
  });
  
  await docClient.send(command);
  
  console.log(`✅ League settings: ${LEAGUE_SETTINGS.numTeams} owners × $${LEAGUE_SETTINGS.buyInPerTeam} = $${LEAGUE_SETTINGS.totalPool} pool`);
}

// Delete existing draft picks
async function deleteExistingDraftPicks() {
  const command = new QueryCommand({
    TableName: TABLES.draftPicks,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: {
      '#league': 'league',
      '#season': 'season'
    },
    ExpressionAttributeValues: {
      ':league': 'nfl-mvp',
      ':season': '2025'
    }
  });
  
  const result = await docClient.send(command);
  const picks = result.Items || [];
  
  if (picks.length > 0) {
    console.log(`🗑️  Deleting ${picks.length} existing NFL MVP 2025 draft picks...`);
    
    for (const pick of picks) {
      const deleteCommand = new DeleteCommand({
        TableName: TABLES.draftPicks,
        Key: { id: pick.id }
      });
      await docClient.send(deleteCommand);
    }
  }
}

// Create draft picks (already completed)
async function createDraftPicks(playerMap) {
  console.log('\n📋 Creating NFL MVP 2025 draft picks (completed draft)...\n');
  
  const now = new Date().toISOString();
  
  for (const draft of DRAFT_RESULTS) {
    const playerId = playerMap[draft.player];
    
    const pick = {
      id: generateId(),
      league: 'nfl-mvp',
      season: '2025',
      round: draft.round,
      pickNumber: draft.pick,
      owner: draft.owner,
      teamId: playerId,
      teamName: draft.player,
      createdAt: now,
      updatedAt: now
    };
    
    const command = new PutCommand({
      TableName: TABLES.draftPicks,
      Item: pick
    });
    
    await docClient.send(command);
  }
  
  console.log(`✅ Created ${DRAFT_RESULTS.length} draft picks (draft complete)`);
  
  // Also update each player's owner
  console.log('\n📝 Updating player owners...');
  for (const draft of DRAFT_RESULTS) {
    const playerId = playerMap[draft.player];
    if (playerId) {
      // Get the player and update owner
      const scanCommand = new ScanCommand({
        TableName: TABLES.teams,
        FilterExpression: '#id = :id',
        ExpressionAttributeNames: { '#id': 'id' },
        ExpressionAttributeValues: { ':id': playerId }
      });
      
      const result = await docClient.send(scanCommand);
      if (result.Items && result.Items.length > 0) {
        const player = result.Items[0];
        player.owner = draft.owner;
        player.updatedAt = now;
        
        const putCommand = new PutCommand({
          TableName: TABLES.teams,
          Item: player
        });
        await docClient.send(putCommand);
      }
    }
  }
  console.log('✅ Player owners updated');
}

// Set draft status
async function setDraftStatus() {
  console.log('\n📊 Setting draft status...');
  
  // Check for existing status
  const command = new QueryCommand({
    TableName: TABLES.draftStatuses,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: {
      '#league': 'league',
      '#season': 'season'
    },
    ExpressionAttributeValues: {
      ':league': 'nfl-mvp',
      ':season': '2025'
    }
  });
  
  const result = await docClient.send(command);
  const existingStatus = result.Items?.[0];
  
  const now = new Date().toISOString();
  
  if (existingStatus) {
    // Update existing
    const updateCommand = new PutCommand({
      TableName: TABLES.draftStatuses,
      Item: {
        ...existingStatus,
        status: 'Draft Completed',
        updatedAt: now
      }
    });
    await docClient.send(updateCommand);
  } else {
    // Create new
    const newStatus = {
      id: generateId(),
      league: 'nfl-mvp',
      season: '2025',
      status: 'Draft Completed',
      createdAt: now,
      updatedAt: now
    };
    
    const putCommand = new PutCommand({
      TableName: TABLES.draftStatuses,
      Item: newStatus
    });
    await docClient.send(putCommand);
  }
  
  console.log('✅ Draft status set to "Draft Completed"');
}

// Main function
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏈 NFL MVP 2025 Draft Setup');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    // Step 1: Check for existing data
    console.log('📋 Checking for existing NFL MVP 2025 data...');
    const existingData = await checkExistingData();
    
    if (existingData.length > 0) {
      console.log(`   Found ${existingData.length} existing entries`);
      await deleteExistingData(existingData);
    } else {
      console.log('   No existing data found');
    }
    
    // Step 2: Create players
    const playerMap = await createPlayers();
    
    // Step 3: Delete existing payouts and create new ones
    await deleteExistingPayouts();
    await createPayoutStructure();
    
    // Step 4: Delete existing league settings and create new ones
    await deleteExistingLeagueSettings();
    await createLeagueSettings();
    
    // Step 5: Delete existing draft picks and create completed draft
    await deleteExistingDraftPicks();
    await createDraftPicks(playerMap);
    
    // Step 6: Set draft status
    await setDraftStatus();
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ NFL MVP 2025 Draft Setup Complete!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`🏈 Players: 32 NFL MVP candidates`);
    console.log(`💰 Pool: $${LEAGUE_SETTINGS.totalPool.toLocaleString()} (${LEAGUE_SETTINGS.numTeams} × $${LEAGUE_SETTINGS.buyInPerTeam})`);
    console.log(`📋 Draft: COMPLETED (8 rounds × 4 owners)`);
    console.log(`🎯 Payout: 1st $1,200 | 2nd $600 | 3rd $200`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Display draft results by owner
    console.log('📊 Draft Results by Owner:');
    console.log('─────────────────────────────────────────────────────');
    
    const owners = ['DM', 'KH', 'TG', 'MC'];
    for (const owner of owners) {
      const picks = DRAFT_RESULTS.filter(d => d.owner === owner);
      console.log(`\n${owner}:`);
      picks.forEach(p => {
        const player = NFL_MVP_PLAYERS.find(pl => pl.name === p.player);
        console.log(`   ${p.pick}. ${p.player} (${player?.nflTeam || 'TBD'})`);
      });
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();

