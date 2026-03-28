#!/usr/bin/env node

/**
 * NCAA Tournament 2026 Setup Script
 * Creates 64 teams (including 4 play-in slots), bracket games, draft picks, and access
 * Play-in slots show combined odds from both competing teams
 */

require('dotenv').config();
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
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
  draftStatuses: 'sports-hub-draft-statuses',
  draftAccess: 'sports-hub-draft-access',
  ncaaTourneyGames: 'sports-hub-ncaa-tourney-games'
};

const LEAGUE = 'ncaa-tourney';
const SEASON = '2026';

function generateId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// NCAA Tournament 2026 projected teams with championship odds
// Play-in games (First Four): 4 slots with 2 teams each
// Seeds 11 and 16 typically have play-in games
const NCAA_TOURNEY_TEAMS = {
  'East': [
    { seed: 1, name: 'Duke Blue Devils', odds: '+550' },
    { seed: 2, name: 'Alabama Crimson Tide', odds: '+750' },
    { seed: 3, name: 'Iowa State Cyclones', odds: '+1800' },
    { seed: 4, name: 'Auburn Tigers', odds: '+1000' },
    { seed: 5, name: 'Michigan State Spartans', odds: '+2500' },
    { seed: 6, name: 'BYU Cougars', odds: '+4000' },
    { seed: 7, name: 'St. Johns Red Storm', odds: '+3500' },
    { seed: 8, name: 'Mississippi State Bulldogs', odds: '+5000' },
    { seed: 9, name: 'Baylor Bears', odds: '+4500' },
    { seed: 10, name: 'Arkansas Razorbacks', odds: '+7000' },
    { seed: 11, name: 'VCU Rams / Texas Longhorns', odds: '+12000', isPlayIn: true, playInTeams: ['VCU Rams', 'Texas Longhorns'] },
    { seed: 12, name: 'Liberty Flames', odds: '+18000' },
    { seed: 13, name: 'Akron Zips', odds: '+25000' },
    { seed: 14, name: 'Troy Trojans', odds: '+40000' },
    { seed: 15, name: 'Robert Morris Colonials', odds: '+60000' },
    { seed: 16, name: 'Norfolk St / Alcorn St', odds: '+100000', isPlayIn: true, playInTeams: ['Norfolk State Spartans', 'Alcorn State Braves'] }
  ],
  'West': [
    { seed: 1, name: 'Houston Cougars', odds: '+450' },
    { seed: 2, name: 'Tennessee Volunteers', odds: '+800' },
    { seed: 3, name: 'Texas Tech Red Raiders', odds: '+2200' },
    { seed: 4, name: 'Purdue Boilermakers', odds: '+1400' },
    { seed: 5, name: 'Clemson Tigers', odds: '+3000' },
    { seed: 6, name: 'UCLA Bruins', odds: '+3500' },
    { seed: 7, name: 'Missouri Tigers', odds: '+4500' },
    { seed: 8, name: 'Maryland Terrapins', odds: '+5500' },
    { seed: 9, name: 'Creighton Bluejays', odds: '+5000' },
    { seed: 10, name: 'Utah State Aggies', odds: '+9000' },
    { seed: 11, name: 'New Mexico / Drake', odds: '+11000', isPlayIn: true, playInTeams: ['New Mexico Lobos', 'Drake Bulldogs'] },
    { seed: 12, name: 'McNeese State Cowboys', odds: '+22000' },
    { seed: 13, name: 'High Point Panthers', odds: '+30000' },
    { seed: 14, name: 'Grambling State Tigers', odds: '+50000' },
    { seed: 15, name: 'Montana State Bobcats', odds: '+65000' },
    { seed: 16, name: 'Long Island / Wagner', odds: '+100000', isPlayIn: true, playInTeams: ['Long Island Sharks', 'Wagner Seahawks'] }
  ],
  'South': [
    { seed: 1, name: 'Kansas Jayhawks', odds: '+600' },
    { seed: 2, name: 'Florida Gators', odds: '+900' },
    { seed: 3, name: 'Wisconsin Badgers', odds: '+2000' },
    { seed: 4, name: 'Arizona Wildcats', odds: '+1200' },
    { seed: 5, name: 'Oregon Ducks', odds: '+2800' },
    { seed: 6, name: 'Illinois Fighting Illini', odds: '+2500' },
    { seed: 7, name: 'Texas A&M Aggies', odds: '+4000' },
    { seed: 8, name: 'Gonzaga Bulldogs', odds: '+2800' },
    { seed: 9, name: 'Oklahoma Sooners', odds: '+6000' },
    { seed: 10, name: 'Xavier Musketeers', odds: '+6500' },
    { seed: 11, name: 'San Diego St / NC State', odds: '+8500', isPlayIn: true, playInTeams: ['San Diego State Aztecs', 'NC State Wolfpack'] },
    { seed: 12, name: 'Grand Canyon Antelopes', odds: '+16000' },
    { seed: 13, name: 'Vermont Catamounts', odds: '+25000' },
    { seed: 14, name: 'Morehead State Eagles', odds: '+40000' },
    { seed: 15, name: 'Colgate Raiders', odds: '+60000' },
    { seed: 16, name: 'Stetson / FAMU', odds: '+100000', isPlayIn: true, playInTeams: ['Stetson Hatters', 'Florida A&M Rattlers'] }
  ],
  'Midwest': [
    { seed: 1, name: 'UConn Huskies', odds: '+350' },
    { seed: 2, name: 'Marquette Golden Eagles', odds: '+1000' },
    { seed: 3, name: 'Kentucky Wildcats', odds: '+1600' },
    { seed: 4, name: 'North Carolina Tar Heels', odds: '+1400' },
    { seed: 5, name: 'Michigan Wolverines', odds: '+3200' },
    { seed: 6, name: 'Memphis Tigers', odds: '+3800' },
    { seed: 7, name: 'Dayton Flyers', odds: '+5000' },
    { seed: 8, name: 'Nebraska Cornhuskers', odds: '+6000' },
    { seed: 9, name: 'TCU Horned Frogs', odds: '+7000' },
    { seed: 10, name: 'Colorado Buffaloes', odds: '+8000' },
    { seed: 11, name: 'Providence / Wake Forest', odds: '+10000', isPlayIn: true, playInTeams: ['Providence Friars', 'Wake Forest Demon Deacons'] },
    { seed: 12, name: 'Charleston Cougars', odds: '+15000' },
    { seed: 13, name: 'Yale Bulldogs', odds: '+28000' },
    { seed: 14, name: 'Oakland Golden Grizzlies', odds: '+35000' },
    { seed: 15, name: 'South Dakota State Jackrabbits', odds: '+55000' },
    { seed: 16, name: 'Howard / Southern', odds: '+100000', isPlayIn: true, playInTeams: ['Howard Bison', 'Southern Jaguars'] }
  ]
};

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

const OWNERS_8 = ['DM', 'TG', 'KH', 'MC', 'JR', 'BW', 'AS', 'RL'];

const FIRST_ROUND_MATCHUPS = [
  [1, 16], [8, 9], [5, 12], [4, 13], [6, 11], [3, 14], [7, 10], [2, 15]
];

// Fetch latest odds from The Odds API
async function fetchLatestOdds() {
  if (!ODDS_API_KEY || ODDS_API_KEY === 'YOUR_API_KEY') {
    console.log('⚠️  No Odds API key, using default odds');
    return null;
  }

  console.log('🎲 Attempting to fetch live championship odds...\n');
  
  const https = require('https');
  
  return new Promise((resolve) => {
    const url = `https://api.the-odds-api.com/v4/sports/basketball_ncaab_championship_winner/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
    
    const req = https.get(url, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const d = JSON.parse(data);
          if (d && d.length > 0 && d[0].bookmakers) {
            const bm = d[0].bookmakers.find(b => b.key === 'draftkings') || d[0].bookmakers[0];
            const market = bm.markets.find(m => m.key === 'outrights') || bm.markets[0];
            const oddsMap = {};
            market.outcomes.forEach(o => {
              oddsMap[o.name.toLowerCase()] = o.price > 0 ? `+${o.price}` : `${o.price}`;
            });
            console.log(`✅ Fetched live odds for ${Object.keys(oddsMap).length} teams\n`);
            resolve(oddsMap);
          } else {
            console.log('⚠️  No odds data available, using defaults\n');
            resolve(null);
          }
        } catch (e) {
          console.log('⚠️  Could not parse odds response, using defaults\n');
          resolve(null);
        }
      });
    });
    
    req.on('error', () => {
      console.log('⚠️  Could not connect to Odds API, using defaults\n');
      resolve(null);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log('⚠️  Odds API request timed out, using defaults\n');
      resolve(null);
    });
  });
}

// Match team name to live odds
function matchOdds(teamName, oddsMap) {
  if (!oddsMap) return null;
  
  const normalized = teamName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  // Try exact match
  if (oddsMap[normalized]) return oddsMap[normalized];
  
  // Try partial matches
  for (const [key, odds] of Object.entries(oddsMap)) {
    if (normalized.includes(key) || key.includes(normalized)) return odds;
    // Match by school name
    const normWords = normalized.split(' ');
    const keyWords = key.split(' ');
    if (normWords[0] === keyWords[0]) return odds;
  }
  
  return null;
}

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
        KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
        AttributeDefinitions: [
          { AttributeName: 'id', AttributeType: 'S' },
          { AttributeName: 'league', AttributeType: 'S' },
          { AttributeName: 'season', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [{
          IndexName: 'league-season-index',
          KeySchema: [
            { AttributeName: 'league', KeyType: 'HASH' },
            { AttributeName: 'season', KeyType: 'RANGE' }
          ],
          Projection: { ProjectionType: 'ALL' }
        }],
        BillingMode: 'PAY_PER_REQUEST'
      });
      
      await client.send(createCommand);
      console.log('✅ NCAA Tourney Games table created');
      await new Promise(resolve => setTimeout(resolve, 15000));
      return true;
    }
    throw error;
  }
}

async function deleteExistingData() {
  console.log('🗑️  Deleting existing NCAA Tourney 2026 data...');
  
  // Delete teams
  const teamsCommand = new ScanCommand({
    TableName: TABLES.teams,
    FilterExpression: '#season = :season AND #sportsLeague = :sportsLeague',
    ExpressionAttributeNames: { '#season': 'season', '#sportsLeague': 'sportsLeague' },
    ExpressionAttributeValues: { ':season': SEASON, ':sportsLeague': 'NCAA-TOURNEY' }
  });
  
  const teamsResult = await docClient.send(teamsCommand);
  for (const team of teamsResult.Items || []) {
    await docClient.send(new DeleteCommand({ TableName: TABLES.teams, Key: { id: team.id } }));
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
      await docClient.send(new DeleteCommand({ TableName: TABLES.ncaaTourneyGames, Key: { id: game.id } }));
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
    await docClient.send(new DeleteCommand({ TableName: TABLES.draftPicks, Key: { id: pick.id } }));
  }
  console.log(`   ✓ Deleted ${picksResult.Items?.length || 0} draft picks`);
  
  // Delete draft status
  const statusCommand = new QueryCommand({
    TableName: TABLES.draftStatuses,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': LEAGUE, ':season': SEASON }
  });
  
  const statusResult = await docClient.send(statusCommand);
  for (const status of statusResult.Items || []) {
    await docClient.send(new DeleteCommand({ TableName: TABLES.draftStatuses, Key: { id: status.id } }));
  }
  console.log(`   ✓ Deleted ${statusResult.Items?.length || 0} draft statuses`);
}

async function createTeams(oddsMap) {
  console.log('\n🏀 Creating 64 NCAA Tournament teams (including 8 play-in slots)...\n');
  
  const now = new Date().toISOString();
  const teams = [];
  let playInCount = 0;
  
  for (const [region, regionTeams] of Object.entries(NCAA_TOURNEY_TEAMS)) {
    for (const teamData of regionTeams) {
      // Try to get live odds
      let odds = teamData.odds;
      if (oddsMap) {
        const liveOdds = matchOdds(teamData.name.split(' / ')[0], oddsMap);
        if (liveOdds) odds = liveOdds;
      }
      
      const team = {
        id: generateId(),
        name: teamData.name,
        region: region,
        seed: teamData.seed,
        odds: odds,
        isPlayIn: teamData.isPlayIn || false,
        playInTeams: teamData.playInTeams || null,
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
      
      await docClient.send(new PutCommand({ TableName: TABLES.teams, Item: team }));
      teams.push(team);
      
      const playInMarker = teamData.isPlayIn ? ' 🎯 PLAY-IN' : '';
      console.log(`✅ ${region} #${teamData.seed}: ${teamData.name} (${odds})${playInMarker}`);
      
      if (teamData.isPlayIn) playInCount++;
    }
  }
  
  console.log(`\n✅ Created ${teams.length} teams (${playInCount} play-in slots with 2 teams each)`);
  return teams;
}

async function createBracketGames(teams) {
  console.log('\n🏆 Creating bracket games...\n');
  
  const now = new Date().toISOString();
  const games = [];
  
  const findTeam = (region, seed) => teams.find(t => t.region === region && t.seed === seed);
  
  // Round 1: 32 games
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
        status: 'scheduled',
        createdAt: now,
        updatedAt: now
      };
      
      await docClient.send(new PutCommand({ TableName: TABLES.ncaaTourneyGames, Item: game }));
      games.push(game);
      gameNum++;
    }
  }
  console.log(`   ✓ Round 1: 32 games`);
  
  // Round 2: 16 games
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
        team1Id: null, team1Seed: null,
        team2Id: null, team2Seed: null,
        winnerId: null,
        status: 'scheduled',
        createdAt: now,
        updatedAt: now
      };
      await docClient.send(new PutCommand({ TableName: TABLES.ncaaTourneyGames, Item: game }));
      games.push(game);
      gameNum++;
    }
  }
  console.log(`   ✓ Round 2: 16 games`);
  
  // Sweet 16: 8 games
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
        team1Id: null, team1Seed: null,
        team2Id: null, team2Seed: null,
        winnerId: null,
        status: 'scheduled',
        createdAt: now,
        updatedAt: now
      };
      await docClient.send(new PutCommand({ TableName: TABLES.ncaaTourneyGames, Item: game }));
      games.push(game);
      gameNum++;
    }
  }
  console.log(`   ✓ Sweet 16: 8 games`);
  
  // Elite 8: 4 games
  gameNum = 1;
  for (const region of ['East', 'West', 'South', 'Midwest']) {
    const game = {
      id: `${LEAGUE}-${SEASON}-4-${gameNum}`,
      league: LEAGUE,
      season: SEASON,
      round: 4,
      gameNum: gameNum,
      region: region,
      team1Id: null, team1Seed: null,
      team2Id: null, team2Seed: null,
      winnerId: null,
      status: 'scheduled',
      createdAt: now,
      updatedAt: now
    };
    await docClient.send(new PutCommand({ TableName: TABLES.ncaaTourneyGames, Item: game }));
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
      team1Id: null, team1Seed: null,
      team2Id: null, team2Seed: null,
      winnerId: null,
      status: 'scheduled',
      createdAt: now,
      updatedAt: now
    };
    await docClient.send(new PutCommand({ TableName: TABLES.ncaaTourneyGames, Item: game }));
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
    team1Id: null, team1Seed: null,
    team2Id: null, team2Seed: null,
    winnerId: null,
    status: 'scheduled',
    createdAt: now,
    updatedAt: now
  };
  await docClient.send(new PutCommand({ TableName: TABLES.ncaaTourneyGames, Item: champGame }));
  games.push(champGame);
  console.log(`   ✓ Championship: 1 game`);
  
  console.log(`\n✅ Created ${games.length} bracket games`);
  return games;
}

async function initializeDraft(numOwners) {
  const owners = OWNERS_8.slice(0, numOwners);
  const totalTeams = 64;
  const teamsPerOwner = totalTeams / numOwners;
  const totalRounds = teamsPerOwner;
  
  console.log(`\n📋 Initializing draft for ${numOwners} owners (${totalRounds} rounds)...`);
  
  const now = new Date().toISOString();
  const picks = [];
  let pickNumber = 1;
  
  for (let round = 1; round <= totalRounds; round++) {
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
      
      await docClient.send(new PutCommand({ TableName: TABLES.draftPicks, Item: pick }));
      picks.push(pick);
      pickNumber++;
    }
  }
  
  console.log(`✅ Created ${picks.length} draft picks`);
  console.log(`   Draft order: ${owners.join(' → ')}`);
  
  return picks;
}

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
  
  await docClient.send(new PutCommand({ TableName: TABLES.leagueSettings, Item: settings }));
  console.log(`✅ League settings: 8 owners × $100 = $800 pool`);
}

async function setDraftStatus() {
  console.log('\n📊 Setting draft status...');
  
  const now = new Date().toISOString();
  
  const statusItem = {
    id: generateId(),
    league: LEAGUE,
    season: SEASON,
    status: 'Draft In Progress',
    createdAt: now,
    updatedAt: now
  };
  
  await docClient.send(new PutCommand({ TableName: TABLES.draftStatuses, Item: statusItem }));
  console.log('✅ Draft status set to "Draft In Progress"');
}

async function setDraftAccess() {
  console.log('\n🔐 Setting draft access for test users...');
  
  const now = new Date().toISOString();
  
  const accessItem = {
    id: `${LEAGUE}-${SEASON}-${Date.now()}`,
    league: LEAGUE,
    season: SEASON,
    userEmails: TEST_USERS,
    createdAt: now,
    updatedAt: now
  };
  
  await docClient.send(new PutCommand({ TableName: TABLES.draftAccess, Item: accessItem }));
  console.log(`✅ Access granted to ${TEST_USERS.length} users`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏀 NCAA Tournament 2026 Setup');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    await ensureGamesTableExists();
    await deleteExistingData();
    
    // Try to fetch live odds
    const oddsMap = await fetchLatestOdds();
    
    const teams = await createTeams(oddsMap);
    await createBracketGames(teams);
    await initializeDraft(8);
    await createLeagueSettings();
    await setDraftStatus();
    await setDraftAccess();
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ NCAA Tournament 2026 Setup Complete!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 Summary:');
    console.log('   - Teams: 64 (16 per region × 4 regions)');
    console.log('   - Play-in slots: 8 (2 teams competing for 1 spot each)');
    console.log('   - Games: 63 bracket matchups');
    console.log('   - Draft: 8 owners × 8 picks = 64 total picks');
    console.log('   - Pool: $800 (8 × $100)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n🎯 Play-in Game Note:');
    console.log('   Play-in slots show combined odds for both competing teams.');
    console.log('   The winner of the play-in game advances to the main bracket.');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main();
