#!/usr/bin/env node

/**
 * NCAA Tournament Odds Update Script
 * Fetches championship odds from The Odds API and updates teams
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY || process.env.ODDS_API_KEY;

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

const TABLES = {
  teams: 'sports-hub-teams'
};

const SEASON = '2025';

// Normalize team name for matching
function normalizeTeamName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Try to match team name with various strategies
function matchTeamName(apiName, dbTeams) {
  const normalizedApi = normalizeTeamName(apiName);
  
  // Try exact match first
  let match = dbTeams.find(t => normalizeTeamName(t.name) === normalizedApi);
  if (match) return match;
  
  // Try partial match (API name contains DB name or vice versa)
  match = dbTeams.find(t => {
    const normalizedDb = normalizeTeamName(t.name);
    return normalizedApi.includes(normalizedDb) || normalizedDb.includes(normalizedApi);
  });
  if (match) return match;
  
  // Try last word match (mascot)
  const apiWords = normalizedApi.split(' ');
  const apiLastWord = apiWords[apiWords.length - 1];
  
  match = dbTeams.find(t => {
    const dbWords = normalizeTeamName(t.name).split(' ');
    const dbLastWord = dbWords[dbWords.length - 1];
    return apiLastWord === dbLastWord;
  });
  if (match) return match;
  
  // Try school name match (first word or two)
  const apiSchool = apiWords.slice(0, 2).join(' ');
  match = dbTeams.find(t => {
    const dbWords = normalizeTeamName(t.name).split(' ');
    const dbSchool = dbWords.slice(0, 2).join(' ');
    return apiSchool === dbSchool || apiWords[0] === dbWords[0];
  });
  
  return match;
}

// Fetch NCAA tournament odds from The Odds API
async function fetchNcaaOdds() {
  if (!ODDS_API_KEY || ODDS_API_KEY === 'YOUR_API_KEY') {
    console.warn('⚠️  ODDS_API_KEY not found, cannot fetch odds');
    return null;
  }

  console.log('🏀 Fetching NCAA Tournament odds from The Odds API...\n');
  
  // Try multiple endpoints that might have NCAAB championship odds
  const endpoints = [
    'basketball_ncaab_championship_winner',
    'basketball_ncaab',
    'basketball_mens_ncaab_championship',
    'basketball_ncaa_mens_championship'
  ];

  for (const endpoint of endpoints) {
    try {
      const url = `https://api.the-odds-api.com/v4/sports/${endpoint}/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
      console.log(`   Trying endpoint: ${endpoint}`);
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data && Array.isArray(data) && data.length > 0) {
          const oddsMap = {};
          
          data.forEach(event => {
            if (event.bookmakers && event.bookmakers.length > 0) {
              // Prefer DraftKings, then FanDuel, then any
              let bookmaker = event.bookmakers.find(b => b.key === 'draftkings') ||
                              event.bookmakers.find(b => b.key === 'fanduel') ||
                              event.bookmakers[0];
              
              console.log(`   Using odds from: ${bookmaker.title}`);
              
              if (bookmaker.markets && bookmaker.markets.length > 0) {
                // Find outrights/futures market
                const market = bookmaker.markets.find(m => 
                  m.key === 'outrights' || m.key === 'winner' || m.key === 'h2h'
                ) || bookmaker.markets[0];
                
                market.outcomes.forEach(outcome => {
                  const teamName = outcome.name;
                  const odds = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
                  oddsMap[teamName] = odds;
                });
              }
            }
          });
          
          if (Object.keys(oddsMap).length > 0) {
            console.log(`\n✅ Fetched odds for ${Object.keys(oddsMap).length} teams\n`);
            return oddsMap;
          }
        }
      } else {
        console.log(`   Endpoint ${endpoint}: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      console.log(`   Endpoint ${endpoint} failed: ${err.message}`);
    }
  }
  
  console.warn('\n⚠️  Could not fetch NCAA odds from any endpoint');
  return null;
}

// Get all NCAA Tournament teams from DynamoDB
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
      ':sportsLeague': 'NCAA-TOURNEY'
    }
  });
  
  const result = await docClient.send(command);
  return result.Items || [];
}

// Update team odds in DynamoDB
async function updateTeamOdds(teamId, odds) {
  const command = new UpdateCommand({
    TableName: TABLES.teams,
    Key: { id: teamId },
    UpdateExpression: 'SET #odds = :odds, #updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#odds': 'odds',
      '#updatedAt': 'updatedAt'
    },
    ExpressionAttributeValues: {
      ':odds': odds,
      ':updatedAt': new Date().toISOString()
    }
  });
  
  await docClient.send(command);
}

// Main function
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏀 NCAA Tournament Odds Update');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    // Get current teams
    const teams = await getNcaaTourneyTeams();
    console.log(`📋 Found ${teams.length} NCAA Tournament teams\n`);
    
    if (teams.length === 0) {
      console.log('⚠️  No teams found. Run setupNcaaTourney2025.js first.');
      process.exit(1);
    }
    
    // Fetch odds
    const oddsMap = await fetchNcaaOdds();
    
    if (!oddsMap) {
      console.log('⚠️  Could not fetch odds. Teams will keep their existing odds.');
      process.exit(0);
    }
    
    // Update teams
    console.log('📊 Updating team odds...\n');
    
    let updated = 0;
    let notFound = [];
    
    for (const [apiTeamName, odds] of Object.entries(oddsMap)) {
      const team = matchTeamName(apiTeamName, teams);
      
      if (team) {
        await updateTeamOdds(team.id, odds);
        console.log(`✅ ${team.name}: ${odds}`);
        updated++;
      } else {
        notFound.push(apiTeamName);
      }
    }
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`✅ Updated odds for ${updated} teams`);
    
    if (notFound.length > 0) {
      console.log(`\n⚠️  Could not match ${notFound.length} teams from API:`);
      notFound.forEach(name => console.log(`   - ${name}`));
    }
    
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
