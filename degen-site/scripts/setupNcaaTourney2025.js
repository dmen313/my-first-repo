#!/usr/bin/env node

/**
 * NCAA Tournament 2025 Setup Script
 * Creates 64 teams, bracket games, draft picks, and access for test users
 */

require('dotenv').config();
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, ScanCommand, DeleteCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

const TABLES = {
  teams: 'sports-hub-teams',
  payouts: 'sports-hub-payouts',
  leagueSettings: 'sports-hub-league-settings',
  draftPicks: 'sports-hub-draft-picks',
  draftStatuses: 'sports-hub-draft-statuses',
  draftAccess: 'sports-hub-draft-access',
  ncaaTourneyGames: 'sports-hub-ncaa-tourney-games'
};

const LEAGUE = 'ncaa-tourney';
const SEASON = '2025';

// Generate unique ID
function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// NCAA Tournament 2025 teams (based on projected 2025 field)
// Seeds 1-16 for each region
const NCAA_TOURNEY_TEAMS = {
  'East': [
    { seed: 1, name: 'Duke Blue Devils', odds: '+600' },
    { seed: 2, name: 'Alabama Crimson Tide', odds: '+800' },
    { seed: 3, name: 'Iowa State Cyclones', odds: '+2000' },
    { seed: 4, name: 'Auburn Tigers', odds: '+1200' },
    { seed: 5, name: 'Michigan State Spartans', odds: '+3000' },
    { seed: 6, name: 'BYU Cougars', odds: '+5000' },
    { seed: 7, name: 'St. Johns Red Storm', odds: '+4000' },
    { seed: 8, name: 'Mississippi State Bulldogs', odds: '+6000' },
    { seed: 9, name: 'Baylor Bears', odds: '+5000' },
    { seed: 10, name: 'Arkansas Razorbacks', odds: '+8000' },
    { seed: 11, name: 'VCU Rams', odds: '+15000' },
    { seed: 12, name: 'Liberty Flames', odds: '+20000' },
    { seed: 13, name: 'Akron Zips', odds: '+30000' },
    { seed: 14, name: 'Troy Trojans', odds: '+50000' },
    { seed: 15, name: 'Robert Morris Colonials', odds: '+80000' },
    { seed: 16, name: 'Norfolk State Spartans', odds: '+100000' }
  ],
  'West': [
    { seed: 1, name: 'Houston Cougars', odds: '+500' },
    { seed: 2, name: 'Tennessee Volunteers', odds: '+900' },
    { seed: 3, name: 'Texas Tech Red Raiders', odds: '+2500' },
    { seed: 4, name: 'Purdue Boilermakers', odds: '+1500' },
    { seed: 5, name: 'Clemson Tigers', odds: '+3500' },
    { seed: 6, name: 'UCLA Bruins', odds: '+4000' },
    { seed: 7, name: 'Missouri Tigers', odds: '+5000' },
    { seed: 8, name: 'Maryland Terrapins', odds: '+6000' },
    { seed: 9, name: 'Creighton Bluejays', odds: '+5500' },
    { seed: 10, name: 'Utah State Aggies', odds: '+10000' },
    { seed: 11, name: 'New Mexico Lobos', odds: '+12000' },
    { seed: 12, name: 'McNeese State Cowboys', odds: '+25000' },
    { seed: 13, name: 'High Point Panthers', odds: '+35000' },
    { seed: 14, name: 'Grambling State Tigers', odds: '+60000' },
    { seed: 15, name: 'Montana State Bobcats', odds: '+75000' },
    { seed: 16, name: 'Long Island Sharks', odds: '+100000' }
  ],
  'South': [
    { seed: 1, name: 'Kansas Jayhawks', odds: '+700' },
    { seed: 2, name: 'Florida Gators', odds: '+1000' },
    { seed: 3, name: 'Wisconsin Badgers', odds: '+2200' },
    { seed: 4, name: 'Arizona Wildcats', odds: '+1400' },
    { seed: 5, name: 'Oregon Ducks', odds: '+3200' },
    { seed: 6, name: 'Illinois Fighting Illini', odds: '+2800' },
    { seed: 7, name: 'Texas A&M Aggies', odds: '+4500' },
    { seed: 8, name: 'Gonzaga Bulldogs', odds: '+3000' },
    { seed: 9, name: 'Oklahoma Sooners', odds: '+6500' },
    { seed: 10, name: 'Xavier Musketeers', odds: '+7000' },
    { seed: 11, name: 'San Diego State Aztecs', odds: '+9000' },
    { seed: 12, name: 'Grand Canyon Antelopes', odds: '+18000' },
    { seed: 13, name: 'Vermont Catamounts', odds: '+28000' },
    { seed: 14, name: 'Morehead State Eagles', odds: '+45000' },
    { seed: 15, name: 'Colgate Raiders', odds: '+70000' },
    { seed: 16, name: 'Stetson Hatters', odds: '+100000' }
  ],
  'Midwest': [
    { seed: 1, name: 'UConn Huskies', odds: '+400' },
    { seed: 2, name: 'Marquette Golden Eagles', odds: '+1100' },
    { seed: 3, name: 'Kentucky Wildcats', odds: '+1800' },
    { seed: 4, name: 'North Carolina Tar Heels', odds: '+1600' },
    { seed: 5, name: 'Michigan Wolverines', odds: '+3800' },
    { seed: 6, name: 'Memphis Tigers', odds: '+4200' },
    { seed: 7, name: 'Dayton Flyers', odds: '+5500' },
    { seed: 8, name: 'Nebraska Cornhuskers', odds: '+6500' },
    { seed: 9, name: 'TCU Horned Frogs', odds: '+7500' },
    { seed: 10, name: 'Colorado Buffaloes', odds: '+8500' },
    { seed: 11, name: 'NC State Wolfpack', odds: '+11000' },
    { seed: 12, name: 'Drake Bulldogs', odds: '+16000' },
    { seed: 13, name: 'Yale Bulldogs', odds: '+32000' },
    { seed: 14, name: 'Oakland Golden Grizzlies', odds: '+40000' },
    { seed: 15, name: 'South Dakota State Jackrabbits', odds: '+65000' },
    { seed: 16, name: 'Wagner Seahawks', odds: '+100000' }
  ]
};

// Test users (7 sample + dev.menon)
const TEST_USERS = [
  'dev.menon@yahoo.com',
  'test.user1@example.com',
  'test.user2@example.com',
  'test.user3@example.com',
  'test.user4@example.com',
  'test.user5@example.com',
  'test.user6@example.com',
  'test.user7@example.com'
];

// Draft owners (for 8-owner version)
const OWNERS_8 = ['DM', 'TG', 'KH', 'MC', 'JR', 'BW', 'AS', 'RL'];
const OWNERS_4 = ['DM', 'TG', 'KH', 'MC'];

// First round matchups (seeds that play each other)
const FIRST_ROUND_MATCHUPS = [
  [1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]
];

// Check if NCAA tourney games table exists, create if not
async function ensureGamesTableExists() {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLES.ncaaTourneyGames }));
    console.log('✅ NCAA Tourney Games table exists');
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      console.log('📋 Creating NCAA Tourney Games table...');
      
      const createCommand = new CreateTableCommand({
        TableName: TABLES.ncaaTourneyGames,
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' }
        ],
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' },
          { AttributeName: 'league', AttributeType: 'S' },
          { AttributeName: 'season', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'league-season-index',
            KeySchema: [
              { AttributeName: 'league', KeyType: 'HASH' },
              { AttributeName: 'season', KeyType: 'RANGE' }
            ],
            Projection: { ProjectionType: 'ALL' }
          }
        ],
        BillingMode: 'PAY_PER_REQUEST'
      });
      
      await client.send(createCommand);
      console.log('✅ NCAA Tourney Games table created');
      
      // Wait for table to be active
      console.log('⏳ Waiting for table to become active...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      return true;
    }
    throw error;
  }
}

// Delete existing data for this league/season
async function deleteExistingData() {
  console.log('🗑️  Deleting existing NCAA Tourney 2025 data...');
  
  // Delete teams
  const teamsCommand = new ScanCommand({
    TableName: TABLES.teams,
    FilterExpression: '#season = :season AND #sportsLeague = :sportsLeague',
    ExpressionAttributeNames: {
      '#season': 'season',
      '#sportsLeague': 'sportsLeague'
    },
    ExpressionAttributeValues: {
      ':season': SEASON,
      ':sportsLeague': 'NCAA-TOURNEY'
    }
  });
  
  const teamsResult = await docClient.send(teamsCommand);
  for (const team of teamsResult.Items || []) {
    await docClient.send(new DeleteCommand({
      TableName: TABLES.teams,
      Key: { id: team.id }
    }));
  }
  console.log(`   ✓ Deleted ${teamsResult.Items?.length || 0} teams`);
  
  // Delete games
  try {
    const gamesCommand = new QueryCommand({
      TableName: TABLES.ncaaTourneyGames,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
      ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON }
    });
    
    const gamesResult = await docClient.send(gamesCommand);
    for (const game of gamesResult.Items || []) {
      await docClient.send(new DeleteCommand({
        TableName: TABLES.ncaaTourneyGames,
        Key: { id: game.id }
      }));
    }
    console.log(`   ✓ Deleted ${gamesResult.Items?.length || 0} games`);
  } catch (e) {
    console.log('   ⚠️ Games table may not exist yet');
  }
  
  // Delete draft picks
  const picksCommand = new QueryCommand({
    TableName: TABLES.draftPicks,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON }
  });
  
  const picksResult = await docClient.send(picksCommand);
  for (const pick of picksResult.Items || []) {
    await docClient.send(new DeleteCommand({
      TableName: TABLES.draftPicks,
      Key: { id: pick.id }
    }));
  }
  console.log(`   ✓ Deleted ${picksResult.Items?.length || 0} draft picks`);
  
  // Delete payouts
  const payoutsCommand = new QueryCommand({
    TableName: TABLES.payouts,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON }
  });
  
  const payoutsResult = await docClient.send(payoutsCommand);
  for (const payout of payoutsResult.Items || []) {
    await docClient.send(new DeleteCommand({
      TableName: TABLES.payouts,
      Key: { id: payout.id }
    }));
  }
  console.log(`   ✓ Deleted ${payoutsResult.Items?.length || 0} payouts`);
  
  // Delete league settings
  const settingsCommand = new QueryCommand({
    TableName: TABLES.leagueSettings,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON }
  });
  
  const settingsResult = await docClient.send(settingsCommand);
  for (const setting of settingsResult.Items || []) {
    await docClient.send(new DeleteCommand({
      TableName: TABLES.leagueSettings,
      Key: { id: setting.id }
    }));
  }
  console.log(`   ✓ Deleted ${settingsResult.Items?.length || 0} league settings`);
}

// Create 64 teams
async function createTeams() {
  console.log('\n🏀 Creating 64 NCAA Tournament teams...\n');
  
  const now = new Date().toISOString();
  const teams = [];
  
  for (const [region, regionTeams] of Object.entries(NCAA_TOURNEY_TEAMS)) {
    for (const teamData of regionTeams) {
      const team = {
        id: generateId(),
        name: teamData.name,
        region: region,
        seed: teamData.seed,
        odds: teamData.odds,
        sportsLeague: 'NCAA-TOURNEY',
        league: region,
        division: `Seed ${teamData.seed}`,
        season: SEASON,
        record: '0-0',
        wins: 0,
        losses: 0,
        eliminated: false,
        totalPoints: 0,
        pointBreakdown: '{}',
        owner: null,
        createdAt: now,
        updatedAt: now
      };
      
      await docClient.send(new PutCommand({
        TableName: TABLES.teams,
        Item: team
      }));
      
      teams.push(team);
      console.log(`✅ ${region} #${teamData.seed}: ${teamData.name} (${teamData.odds})`);
    }
  }
  
  console.log(`\n✅ Created ${teams.length} teams`);
  return teams;
}

// Create bracket games (63 total)
async function createBracketGames(teams) {
  console.log('\n🏆 Creating bracket games...\n');
  
  const now = new Date().toISOString();
  const games = [];
  
  // Helper to find team by region and seed
  const findTeam = (region, seed) => {
    return teams.find(t => t.region === region && t.seed === seed);
  };
  
  // Round 1: 32 games (8 per region)
  let gameNum = 1;
  for (const region of ['East', 'West', 'South', 'Midwest']) {
    for (const [seed1, seed2] of FIRST_ROUND_MATCHUPS) {
      const team1 = findTeam(region, seed1);
      const team2 = findTeam(region, seed2);
      
      const game = {
        id: `${LEAGUE}-${SEASON}-1-${gameNum}`,
        league: LEAGUE,
        season: SEASON,
        round: 1,
        gameNum: gameNum,
        region: region,
        team1Id: team1?.id || null,
        team1Seed: seed1,
        team2Id: team2?.id || null,
        team2Seed: seed2,
        winnerId: null,
        score1: null,
        score2: null,
        status: 'scheduled',
        createdAt: now,
        updatedAt: now
      };
      
      await docClient.send(new PutCommand({
        TableName: TABLES.ncaaTourneyGames,
        Item: game
      }));
      
      games.push(game);
      gameNum++;
    }
  }
  console.log(`   ✓ Round 1: 32 games`);
  
  // Round 2: 16 games (4 per region)
  gameNum = 1;
  for (const region of ['East', 'West', 'South', 'Midwest']) {
    for (let i = 0; i < 4; i++) {
      const game = {
        id: `${LEAGUE}-${SEASON}-2-${gameNum}`,
        league: LEAGUE,
        season: SEASON,
        round: 2,
        gameNum: gameNum,
        region: region,
        team1Id: null,
        team1Seed: null,
        team2Id: null,
        team2Seed: null,
        winnerId: null,
        score1: null,
        score2: null,
        status: 'scheduled',
        createdAt: now,
        updatedAt: now
      };
      
      await docClient.send(new PutCommand({
        TableName: TABLES.ncaaTourneyGames,
        Item: game
      }));
      
      games.push(game);
      gameNum++;
    }
  }
  console.log(`   ✓ Round 2: 16 games`);
  
  // Sweet 16: 8 games (2 per region)
  gameNum = 1;
  for (const region of ['East', 'West', 'South', 'Midwest']) {
    for (let i = 0; i < 2; i++) {
      const game = {
        id: `${LEAGUE}-${SEASON}-3-${gameNum}`,
        league: LEAGUE,
        season: SEASON,
        round: 3,
        gameNum: gameNum,
        region: region,
        team1Id: null,
        team1Seed: null,
        team2Id: null,
        team2Seed: null,
        winnerId: null,
        score1: null,
        score2: null,
        status: 'scheduled',
        createdAt: now,
        updatedAt: now
      };
      
      await docClient.send(new PutCommand({
        TableName: TABLES.ncaaTourneyGames,
        Item: game
      }));
      
      games.push(game);
      gameNum++;
    }
  }
  console.log(`   ✓ Sweet 16: 8 games`);
  
  // Elite 8: 4 games (1 per region)
  gameNum = 1;
  for (const region of ['East', 'West', 'South', 'Midwest']) {
    const game = {
      id: `${LEAGUE}-${SEASON}-4-${gameNum}`,
      league: LEAGUE,
      season: SEASON,
      round: 4,
      gameNum: gameNum,
      region: region,
      team1Id: null,
      team1Seed: null,
      team2Id: null,
      team2Seed: null,
      winnerId: null,
      score1: null,
      score2: null,
      status: 'scheduled',
      createdAt: now,
      updatedAt: now
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLES.ncaaTourneyGames,
      Item: game
    }));
    
    games.push(game);
    gameNum++;
  }
  console.log(`   ✓ Elite 8: 4 games`);
  
  // Final Four: 2 games
  for (let i = 1; i <= 2; i++) {
    const game = {
      id: `${LEAGUE}-${SEASON}-5-${i}`,
      league: LEAGUE,
      season: SEASON,
      round: 5,
      gameNum: i,
      region: 'FinalFour',
      team1Id: null,
      team1Seed: null,
      team2Id: null,
      team2Seed: null,
      winnerId: null,
      score1: null,
      score2: null,
      status: 'scheduled',
      createdAt: now,
      updatedAt: now
    };
    
    await docClient.send(new PutCommand({
      TableName: TABLES.ncaaTourneyGames,
      Item: game
    }));
    
    games.push(game);
  }
  console.log(`   ✓ Final Four: 2 games`);
  
  // Championship: 1 game
  const champGame = {
    id: `${LEAGUE}-${SEASON}-6-1`,
    league: LEAGUE,
    season: SEASON,
    round: 6,
    gameNum: 1,
    region: 'Championship',
    team1Id: null,
    team1Seed: null,
    team2Id: null,
    team2Seed: null,
    winnerId: null,
    score1: null,
    score2: null,
    status: 'scheduled',
    createdAt: now,
    updatedAt: now
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLES.ncaaTourneyGames,
    Item: champGame
  }));
  
  games.push(champGame);
  console.log(`   ✓ Championship: 1 game`);
  
  console.log(`\n✅ Created ${games.length} bracket games`);
  return games;
}

// Initialize draft picks (snake draft)
async function initializeDraft(numOwners) {
  const owners = numOwners === 8 ? OWNERS_8 : OWNERS_4;
  const totalTeams = 64;
  const teamsPerOwner = totalTeams / numOwners;
  const totalRounds = teamsPerOwner;
  
  console.log(`\n📋 Initializing draft for ${numOwners} owners (${totalRounds} rounds)...`);
  
  const now = new Date().toISOString();
  const picks = [];
  let pickNumber = 1;
  
  for (let round = 1; round <= totalRounds; round++) {
    // Snake draft: reverse order on even rounds
    const roundOwners = round % 2 === 0 ? [...owners].reverse() : [...owners];
    
    for (const owner of roundOwners) {
      const pick = {
        id: generateId(),
        league: LEAGUE,
        season: SEASON,
        round: round,
        pickNumber: pickNumber,
        owner: owner,
        teamId: null,
        teamName: null,
        createdAt: now,
        updatedAt: now
      };
      
      await docClient.send(new PutCommand({
        TableName: TABLES.draftPicks,
        Item: pick
      }));
      
      picks.push(pick);
      pickNumber++;
    }
  }
  
  console.log(`✅ Created ${picks.length} draft picks`);
  console.log(`   Draft order: ${owners.join(' → ')}`);
  
  return picks;
}

// Create league settings
async function createLeagueSettings() {
  console.log('\n⚙️  Creating league settings...');
  
  const now = new Date().toISOString();
  
  const settings = {
    id: generateId(),
    league: LEAGUE,
    season: SEASON,
    buyInPerTeam: 100,
    numTeams: 8,
    totalPool: 800,
    createdAt: now,
    updatedAt: now
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLES.leagueSettings,
    Item: settings
  }));
  
  console.log(`✅ League settings: 8 owners × $100 = $800 pool`);
}

// Set draft status
async function setDraftStatus() {
  console.log('\n📊 Setting draft status...');
  
  const now = new Date().toISOString();
  
  // Check for existing status
  const command = new QueryCommand({
    TableName: TABLES.draftStatuses,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON }
  });
  
  const result = await docClient.send(command);
  const existingStatus = result.Items?.[0];
  
  const statusItem = {
    id: existingStatus?.id || generateId(),
    league: LEAGUE,
    season: SEASON,
    status: 'Draft In Progress',
    createdAt: existingStatus?.createdAt || now,
    updatedAt: now
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLES.draftStatuses,
    Item: statusItem
  }));
  
  console.log('✅ Draft status set to "Draft In Progress"');
}

// Set draft access for test users
async function setDraftAccess() {
  console.log('\n🔐 Setting draft access for test users...');
  
  const now = new Date().toISOString();
  
  // Check for existing access
  const command = new QueryCommand({
    TableName: TABLES.draftAccess,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON }
  });
  
  const result = await docClient.send(command);
  const existingAccess = result.Items?.[0];
  
  const accessItem = {
    id: existingAccess?.id || `${LEAGUE}-${SEASON}-${Date.now()}`,
    league: LEAGUE,
    season: SEASON,
    userEmails: TEST_USERS,
    createdAt: existingAccess?.createdAt || now,
    updatedAt: now
  };
  
  await docClient.send(new PutCommand({
    TableName: TABLES.draftAccess,
    Item: accessItem
  }));
  
  console.log(`✅ Access granted to ${TEST_USERS.length} users:`);
  TEST_USERS.forEach(email => console.log(`   - ${email}`));
}

// Main function
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏀 NCAA Tournament 2025 Setup');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    // Ensure games table exists
    await ensureGamesTableExists();
    
    // Delete existing data
    await deleteExistingData();
    
    // Create teams
    const teams = await createTeams();
    
    // Create bracket games
    await createBracketGames(teams);
    
    // Initialize draft (8 owners)
    await initializeDraft(8);
    
    // Create league settings
    await createLeagueSettings();
    
    // Set draft status
    await setDraftStatus();
    
    // Set draft access
    await setDraftAccess();
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ NCAA Tournament 2025 Setup Complete!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 Summary:');
    console.log('   - Teams: 64 (16 per region × 4 regions)');
    console.log('   - Games: 63 bracket matchups');
    console.log('   - Draft: 8 owners × 8 picks = 64 total picks');
    console.log('   - Pool: $800 (8 × $100)');
    console.log('   - Access: 8 test users');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    console.log('🏀 Point System:');
    console.log('   Round of 64: 3 pts');
    console.log('   Round of 32: 6 pts');
    console.log('   Sweet 16:    9 pts');
    console.log('   Elite 8:     12 pts');
    console.log('   Final Four:  15 pts');
    console.log('   Championship: 18 pts');
    console.log('   + Upset Bonus: seed difference when lower seed wins');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
