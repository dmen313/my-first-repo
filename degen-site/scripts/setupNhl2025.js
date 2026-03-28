#!/usr/bin/env node

/**
 * NHL 2025 Draft Setup Script
 * Creates all 32 NHL teams, payout structure, league settings, and initializes the draft
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

// All 32 NHL teams organized by conference and division
const NHL_TEAMS = {
  'Eastern Conference': {
    'Atlantic': [
      'Boston Bruins',
      'Buffalo Sabres',
      'Detroit Red Wings',
      'Florida Panthers',
      'Montreal Canadiens',
      'Ottawa Senators',
      'Tampa Bay Lightning',
      'Toronto Maple Leafs'
    ],
    'Metropolitan': [
      'Carolina Hurricanes',
      'Columbus Blue Jackets',
      'New Jersey Devils',
      'New York Islanders',
      'New York Rangers',
      'Philadelphia Flyers',
      'Pittsburgh Penguins',
      'Washington Capitals'
    ]
  },
  'Western Conference': {
    'Central': [
      'Utah Mammoth',
      'Chicago Blackhawks',
      'Colorado Avalanche',
      'Dallas Stars',
      'Minnesota Wild',
      'Nashville Predators',
      'St. Louis Blues',
      'Winnipeg Jets'
    ],
    'Pacific': [
      'Anaheim Ducks',
      'Calgary Flames',
      'Edmonton Oilers',
      'Los Angeles Kings',
      'San Jose Sharks',
      'Seattle Kraken',
      'Vancouver Canucks',
      'Vegas Golden Knights'
    ]
  }
};

// Payout structure from the attachment
const PAYOUT_STRUCTURE = [
  { level: 'Round 1', teams: 16, percentage: 16.00 },
  { level: 'Round 2', teams: 8, percentage: 20.00 },
  { level: 'Conference', teams: 4, percentage: 24.00 },
  { level: 'Stanley Cup', teams: 2, percentage: 16.00 },
  { level: 'Winner', teams: 1, percentage: 16.00 },
  { level: '1st Seed in Each Division', teams: 4, percentage: 8.00 }
];

// League settings from attachment
const LEAGUE_SETTINGS = {
  buyInPerTeam: 1250,
  numTeams: 4,
  totalPool: 5000
};

// Draft owners
const OWNERS = ['DM', 'MC', 'KH', 'TG'];

// Fetch Stanley Cup odds from The Odds API
async function fetchNhlOdds() {
  if (!ODDS_API_KEY || ODDS_API_KEY === 'YOUR_API_KEY') {
    console.warn('⚠️  ODDS_API_KEY not found, using default odds');
    return null;
  }

  try {
    console.log('🏒 Fetching Stanley Cup odds from The Odds API...');
    
    // Try the NHL championship endpoint
    const endpoints = [
      'icehockey_nhl_championship_winner',
      'icehockey_nhl_championship',
      'icehockey_nhl'
    ];

    for (const endpoint of endpoints) {
      try {
        const url = `https://api.the-odds-api.com/v4/sports/${endpoint}/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data && Array.isArray(data) && data.length > 0) {
            const oddsMap = {};
            
            data.forEach(game => {
              if (game.bookmakers && game.bookmakers.length > 0) {
                const bookmaker = game.bookmakers[0];
                console.log(`   Using odds from: ${bookmaker.title}`);
                
                if (bookmaker.markets && bookmaker.markets.length > 0) {
                  const market = bookmaker.markets[0];
                  market.outcomes.forEach(outcome => {
                    const teamName = outcome.name.toLowerCase();
                    const odds = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
                    oddsMap[teamName] = odds;
                    
                    // Also store variations
                    const nameParts = teamName.split(/\s+/);
                    if (nameParts.length > 1) {
                      oddsMap[nameParts[nameParts.length - 1]] = odds;
                    }
                  });
                }
              }
            });
            
            if (Object.keys(oddsMap).length > 0) {
              console.log(`✅ Fetched odds for ${Object.keys(oddsMap).length} unique keys`);
              return oddsMap;
            }
          }
        }
      } catch (err) {
        console.log(`   Endpoint ${endpoint} failed: ${err.message}`);
      }
    }
    
    console.warn('⚠️  Could not fetch NHL odds from any endpoint');
    return null;
  } catch (error) {
    console.warn(`⚠️  Failed to fetch odds: ${error.message}`);
    return null;
  }
}

// Get odds for a team
function getOddsForTeam(teamName, oddsMap) {
  if (!oddsMap) return '+5000';
  
  const normalizedName = teamName.toLowerCase();
  
  // Try exact match
  if (oddsMap[normalizedName]) {
    return oddsMap[normalizedName];
  }
  
  // Try partial match
  for (const key of Object.keys(oddsMap)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return oddsMap[key];
    }
  }
  
  // Try last word (e.g., "Bruins", "Oilers")
  const lastWord = normalizedName.split(' ').pop();
  if (oddsMap[lastWord]) {
    return oddsMap[lastWord];
  }
  
  return '+5000';
}

// Check if NHL 2025 teams already exist
async function checkExistingTeams() {
  const command = new ScanCommand({
    TableName: TABLES.teams,
    FilterExpression: '#season = :season AND #sportsLeague = :sportsLeague',
    ExpressionAttributeNames: {
      '#season': 'season',
      '#sportsLeague': 'sportsLeague'
    },
    ExpressionAttributeValues: {
      ':season': '2025',
      ':sportsLeague': 'NHL'
    }
  });
  
  const result = await docClient.send(command);
  return result.Items || [];
}

// Delete existing NHL 2025 teams
async function deleteExistingTeams(teams) {
  console.log(`🗑️  Deleting ${teams.length} existing NHL 2025 teams...`);
  
  for (const team of teams) {
    const command = new DeleteCommand({
      TableName: TABLES.teams,
      Key: { id: team.id }
    });
    await docClient.send(command);
    console.log(`   ✓ Deleted: ${team.name}`);
  }
}

// Create NHL teams
async function createNhlTeams(oddsMap) {
  console.log('\n🏒 Creating NHL 2025 teams...\n');
  
  let createdCount = 0;
  const now = new Date().toISOString();
  
  for (const [conference, divisions] of Object.entries(NHL_TEAMS)) {
    for (const [division, teams] of Object.entries(divisions)) {
      for (const teamName of teams) {
        const odds = getOddsForTeam(teamName, oddsMap);
        
        const team = {
          id: generateId(),
          name: teamName,
          league: conference,  // "Eastern Conference" or "Western Conference"
          division: division,  // "Atlantic", "Metropolitan", "Central", "Pacific"
          sportsLeague: 'NHL',
          season: '2025',
          record: '0-0-0',
          wins: 0,
          losses: 0,
          otLosses: 0,
          points: 0,
          gamesBack: '0',
          odds: odds,
          owner: null,
          createdAt: now,
          updatedAt: now
        };
        
        const command = new PutCommand({
          TableName: TABLES.teams,
          Item: team
        });
        
        await docClient.send(command);
        console.log(`✅ Created: ${teamName} (${conference} - ${division}) - ${odds}`);
        createdCount++;
      }
    }
  }
  
  console.log(`\n✅ Created ${createdCount} NHL teams`);
  return createdCount;
}

// Delete existing NHL 2025 payouts
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
      ':league': 'nhl',
      ':season': '2025'
    }
  });
  
  const result = await docClient.send(command);
  const payouts = result.Items || [];
  
  if (payouts.length > 0) {
    console.log(`🗑️  Deleting ${payouts.length} existing NHL 2025 payouts...`);
    
    for (const payout of payouts) {
      const deleteCommand = new DeleteCommand({
        TableName: TABLES.payouts,
        Key: { id: payout.id }
      });
      await docClient.send(deleteCommand);
      console.log(`   ✓ Deleted: ${payout.level}`);
    }
  }
}

// Create NHL payout structure
async function createPayoutStructure() {
  console.log('\n💰 Creating NHL 2025 payout structure...\n');
  
  const now = new Date().toISOString();
  
  for (const payout of PAYOUT_STRUCTURE) {
    const item = {
      id: generateId(),
      league: 'nhl',
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
    
    const payoutPerTeam = (LEAGUE_SETTINGS.totalPool * payout.percentage / 100) / payout.teams;
    console.log(`✅ ${payout.level}: ${payout.teams} teams, ${payout.percentage}% ($${payoutPerTeam.toFixed(2)}/team)`);
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
      ':league': 'nhl',
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
  console.log('\n⚙️  Creating NHL 2025 league settings...');
  
  const now = new Date().toISOString();
  
  const settings = {
    id: generateId(),
    league: 'nhl',
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
      ':league': 'nhl',
      ':season': '2025'
    }
  });
  
  const result = await docClient.send(command);
  const picks = result.Items || [];
  
  if (picks.length > 0) {
    console.log(`🗑️  Deleting ${picks.length} existing NHL 2025 draft picks...`);
    
    for (const pick of picks) {
      const deleteCommand = new DeleteCommand({
        TableName: TABLES.draftPicks,
        Key: { id: pick.id }
      });
      await docClient.send(deleteCommand);
    }
  }
}

// Initialize draft picks
async function initializeDraft() {
  console.log('\n📋 Initializing NHL 2025 draft...');
  
  const now = new Date().toISOString();
  const totalTeams = 32;
  const ownersCount = OWNERS.length;
  const totalRounds = Math.ceil(totalTeams / ownersCount); // 8 rounds for 32 teams / 4 owners
  
  let pickNumber = 1;
  const picks = [];
  
  for (let round = 1; round <= totalRounds; round++) {
    // Snake draft: reverse order on even rounds
    const roundOwners = round % 2 === 0 ? [...OWNERS].reverse() : [...OWNERS];
    
    for (const owner of roundOwners) {
      const pick = {
        id: generateId(),
        league: 'nhl',
        season: '2025',
        round: round,
        pickNumber: pickNumber,
        owner: owner,
        teamId: null,
        teamName: null,
        createdAt: now,
        updatedAt: now
      };
      
      const command = new PutCommand({
        TableName: TABLES.draftPicks,
        Item: pick
      });
      
      await docClient.send(command);
      picks.push(pick);
      pickNumber++;
    }
  }
  
  console.log(`✅ Created ${picks.length} draft picks (${totalRounds} rounds × ${ownersCount} owners)`);
  console.log(`   Draft order: ${OWNERS.join(' → ')}`);
  
  return picks;
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
      ':league': 'nhl',
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
        status: 'Draft In Progress',
        updatedAt: now
      }
    });
    await docClient.send(updateCommand);
  } else {
    // Create new
    const newStatus = {
      id: generateId(),
      league: 'nhl',
      season: '2025',
      status: 'Draft In Progress',
      createdAt: now,
      updatedAt: now
    };
    
    const putCommand = new PutCommand({
      TableName: TABLES.draftStatuses,
      Item: newStatus
    });
    await docClient.send(putCommand);
  }
  
  console.log('✅ Draft status set to "Draft In Progress"');
}

// Main function
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏒 NHL 2025 Draft Setup');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    // Step 1: Check for existing teams
    console.log('📋 Checking for existing NHL 2025 data...');
    const existingTeams = await checkExistingTeams();
    
    if (existingTeams.length > 0) {
      console.log(`   Found ${existingTeams.length} existing NHL 2025 teams`);
      await deleteExistingTeams(existingTeams);
    } else {
      console.log('   No existing NHL 2025 teams found');
    }
    
    // Step 2: Fetch odds
    const oddsMap = await fetchNhlOdds();
    
    // Step 3: Create teams
    await createNhlTeams(oddsMap);
    
    // Step 4: Delete existing payouts and create new ones
    await deleteExistingPayouts();
    await createPayoutStructure();
    
    // Step 5: Delete existing league settings and create new ones
    await deleteExistingLeagueSettings();
    await createLeagueSettings();
    
    // Step 6: Delete existing draft picks and initialize new draft
    await deleteExistingDraftPicks();
    await initializeDraft();
    
    // Step 7: Set draft status
    await setDraftStatus();
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ NHL 2025 Draft Setup Complete!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📊 Teams: 32 (16 Eastern, 16 Western)`);
    console.log(`💰 Pool: $${LEAGUE_SETTINGS.totalPool.toLocaleString()} (${LEAGUE_SETTINGS.numTeams} × $${LEAGUE_SETTINGS.buyInPerTeam.toLocaleString()})`);
    console.log(`📋 Draft: 8 rounds × 4 owners = 32 picks`);
    console.log(`🎯 Payout Levels: ${PAYOUT_STRUCTURE.length}`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Display payout summary
    console.log('💰 Payout Summary:');
    console.log('─────────────────────────────────────────────────────');
    console.log('Level                      Teams    %       Per Team');
    console.log('─────────────────────────────────────────────────────');
    
    let totalPct = 0;
    for (const p of PAYOUT_STRUCTURE) {
      const perTeam = (LEAGUE_SETTINGS.totalPool * p.percentage / 100) / p.teams;
      console.log(`${p.level.padEnd(25)} ${String(p.teams).padStart(5)}  ${p.percentage.toFixed(2).padStart(6)}%  $${perTeam.toFixed(2).padStart(7)}`);
      totalPct += p.percentage;
    }
    
    console.log('─────────────────────────────────────────────────────');
    console.log(`${'Total'.padEnd(25)}        ${totalPct.toFixed(2).padStart(6)}%`);
    console.log('─────────────────────────────────────────────────────\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();

