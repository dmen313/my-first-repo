#!/usr/bin/env node

/**
 * Local script to update NFL 2025 team records and championship odds
 * Fetches data from ESPN NFL API and The Odds API, then updates DynamoDB
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// Use native fetch (Node.js 18+) or import node-fetch if not available
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  // Fallback to node-fetch for older Node.js versions
  fetch = require('node-fetch');
  if (fetch.default) {
    fetch = fetch.default;
  }
}

const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';
const TEAMS_TABLE = 'sports-hub-teams';
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY || process.env.ODDS_API_KEY;
const NFL_API_KEY = process.env.REACT_APP_NFL_API_KEY || process.env.NFL_API_KEY;

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

// ESPN API base URL for NFL standings
const ESPN_API_BASE = 'https://site.api.espn.com/apis/v2/sports/football/nfl';

async function updateNfl2025Data() {
  console.log('🏈 Updating NFL 2025 team records and championship odds...\n');

  try {
    // Step 1: Fetch NFL standings from ESPN API
    console.log('📊 Step 1: Fetching NFL standings from ESPN API...');
    
    // Use 2025 season explicitly for NFL 2025 data
    const nflSeason = 2025;
    console.log(`   Using NFL season: ${nflSeason}`);
    
    // ESPN API provides season standings
    const standingsUrl = `${ESPN_API_BASE}/standings?season=${nflSeason}`;
    
    const standingsResponse = await fetch(standingsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!standingsResponse.ok) {
      throw new Error(`ESPN API error: ${standingsResponse.status} ${standingsResponse.statusText}`);
    }

    const standingsData = await standingsResponse.json();
    
    // Parse ESPN standings data
    const apiTeams = [];
    
    if (standingsData && standingsData.children) {
      // ESPN returns standings grouped by conference
      // Standings are directly on conference.standings.entries (not nested in divisions)
      for (const conference of standingsData.children) {
        const conferenceName = conference.name || conference.abbreviation || 'Unknown';
        
        // Check for standings directly on the conference
        if (conference.standings && conference.standings.entries) {
          for (const entry of conference.standings.entries) {
            const team = entry.team;
            const stats = entry.stats || [];
            
            // Find wins, losses, and ties from stats
            let wins = 0;
            let losses = 0;
            let ties = 0;
            
            for (const stat of stats) {
              const statName = (stat.name || '').toLowerCase();
              if (statName === 'wins') {
                wins = parseInt(stat.value) || 0;
              } else if (statName === 'losses') {
                losses = parseInt(stat.value) || 0;
              } else if (statName === 'ties') {
                ties = parseInt(stat.value) || 0;
              }
            }
            
            const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
            
            apiTeams.push({
              name: team.displayName || team.name,
              shortName: team.shortDisplayName || team.abbreviation,
              record: record,
              wins: wins,
              losses: losses,
              ties: ties,
              conference: conferenceName
            });
          }
        }
        
        // Also check for divisions (in case ESPN changes structure)
        if (conference.children) {
          for (const division of conference.children) {
            if (division.standings && division.standings.entries) {
              for (const entry of division.standings.entries) {
                const team = entry.team;
                const stats = entry.stats || [];
                
                let wins = 0, losses = 0, ties = 0;
                
                for (const stat of stats) {
                  const statName = (stat.name || '').toLowerCase();
                  if (statName === 'wins') wins = parseInt(stat.value) || 0;
                  else if (statName === 'losses') losses = parseInt(stat.value) || 0;
                  else if (statName === 'ties') ties = parseInt(stat.value) || 0;
                }
                
                const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
                
                apiTeams.push({
                  name: team.displayName || team.name,
                  shortName: team.shortDisplayName || team.abbreviation,
                  record: record,
                  wins: wins,
                  losses: losses,
                  ties: ties,
                  conference: conferenceName
                });
              }
            }
          }
        }
      }
    }

    console.log(`✅ Fetched ${apiTeams.length} teams from ESPN API`);
    if (apiTeams.length > 0) {
      console.log(`   Sample teams: ${apiTeams.slice(0, 5).map(t => `${t.name} (${t.record})`).join(', ')}...\n`);
    } else {
      console.log('   ⚠️  No standings data available yet (NFL season may not have started)\n');
    }

    // Step 2: Fetch odds from The Odds API
    console.log('🎲 Step 2: Fetching Super Bowl odds from The Odds API...');
    let oddsMap = {};
    let oddsFetched = false;

    if (!ODDS_API_KEY || ODDS_API_KEY === 'YOUR_API_KEY') {
      console.warn('⚠️  ODDS_API_KEY not found in environment variables. Skipping odds update.');
    } else {
      const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
      // Use the same endpoint as updateNflOdds.js
      const nflEndpoint = 'americanfootball_nfl_super_bowl_winner';
      const oddsUrl = `${ODDS_API_BASE}/sports/${nflEndpoint}/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
      
      console.log(`   Fetching from: ${nflEndpoint}`);
      
      try {
        const oddsResponse = await fetch(oddsUrl);
        
        if (oddsResponse.ok) {
          const oddsData = await oddsResponse.json();
          
          if (oddsData && Array.isArray(oddsData) && oddsData.length > 0) {
            // Get first bookmaker's data
            if (oddsData[0].bookmakers && oddsData[0].bookmakers.length > 0) {
              const bookmaker = oddsData[0].bookmakers[0];
              console.log(`   Using odds from: ${bookmaker.title}`);
              
              if (bookmaker.markets && bookmaker.markets.length > 0) {
                const market = bookmaker.markets[0];
                
                market.outcomes.forEach(outcome => {
                  const exactName = outcome.name; // Keep exact name for matching
                  const normalizedName = outcome.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
                  const odds = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
                  
                  // Store exact name (for direct matching)
                  oddsMap[exactName] = odds;
                  
                  // Store normalized name
                  oddsMap[normalizedName] = odds;
                  
                  // Store multiple variations for better matching
                  const nameParts = normalizedName.split(/\s+/);
                  if (nameParts.length > 1) {
                    // Last word (e.g., "49ers", "Chiefs")
                    oddsMap[nameParts[nameParts.length - 1]] = odds;
                    // Last two words (e.g., "kansas city chiefs" -> "city chiefs")
                    if (nameParts.length >= 2) {
                      oddsMap[nameParts.slice(-2).join(' ')] = odds;
                    }
                  }
                });
                
                oddsFetched = true;
                console.log(`✅ Successfully fetched NFL Super Bowl odds`);
                console.log(`   Found odds for ${market.outcomes.length} teams`);
                
                // Show top 5 favorites
                const sortedTeams = market.outcomes
                  .map(o => ({ name: o.name, odds: o.price }))
                  .sort((a, b) => {
                    // Lower positive or higher negative = favorite
                    const aVal = a.odds < 0 ? Math.abs(a.odds) + 10000 : a.odds;
                    const bVal = b.odds < 0 ? Math.abs(b.odds) + 10000 : b.odds;
                    return aVal - bVal;
                  });
                console.log(`   🏆 Top 5 Super Bowl favorites:`);
                sortedTeams.slice(0, 5).forEach((t, i) => {
                  const displayOdds = t.odds > 0 ? `+${t.odds}` : t.odds;
                  console.log(`      ${i + 1}. ${t.name}: ${displayOdds}`);
                });
                console.log();
              }
            }
          } else if (oddsData && oddsData.error_code) {
            console.log(`⚠️  Odds API returned error: ${oddsData.message || 'Unknown error'}`);
          }
        } else {
          console.log(`⚠️  Odds API returned status ${oddsResponse.status}`);
        }
      } catch (error) {
        console.log(`⚠️  Error fetching odds: ${error.message}`);
      }

      if (!oddsFetched) {
        console.warn('⚠️  Could not fetch NFL Super Bowl odds. Continuing without odds update.\n');
      }
    }

    // Step 3: Get NFL 2025 teams from DynamoDB
    console.log('📋 Step 3: Fetching NFL 2025 teams from DynamoDB...');
    const dbTeams = [];
    
    // Query AFC teams
    const afcQuery = new QueryCommand({
      TableName: TEAMS_TABLE,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: {
        '#league': 'league',
        '#season': 'season'
      },
      ExpressionAttributeValues: {
        ':league': 'AFC',
        ':season': '2025'
      }
    });
    
    const afcResult = await docClient.send(afcQuery);
    const afcTeams = afcResult.Items || [];
    dbTeams.push(...afcTeams);
    
    // Query NFC teams
    const nfcQuery = new QueryCommand({
      TableName: TEAMS_TABLE,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: {
        '#league': 'league',
        '#season': 'season'
      },
      ExpressionAttributeValues: {
        ':league': 'NFC',
        ':season': '2025'
      }
    });
    
    const nfcResult = await docClient.send(nfcQuery);
    const nfcTeams = nfcResult.Items || [];
    dbTeams.push(...nfcTeams);

    console.log(`✅ Found ${dbTeams.length} NFL 2025 teams in DynamoDB (${afcTeams.length} AFC, ${nfcTeams.length} NFC)`);
    if (dbTeams.length > 0) {
      console.log(`   Sample teams: ${dbTeams.slice(0, 5).map(t => `${t.name} (${t.id})`).join(', ')}...\n`);
    }

    if (dbTeams.length === 0) {
      console.warn('⚠️  No teams found for NFL 2025. Make sure teams have been created first.\n');
      return;
    }

    // Step 4: Update teams with records and odds
    console.log('🔄 Step 4: Updating teams with records and odds...\n');
    let recordsUpdated = 0;
    let oddsUpdated = 0;

    for (const dbTeam of dbTeams) {
      try {
        // Find matching API team
        let apiTeam = null;
        
        if (apiTeams.length > 0) {
          apiTeam = apiTeams.find(api => 
            api.name === dbTeam.name || 
            (api.name && dbTeam.name && api.name.toLowerCase() === dbTeam.name.toLowerCase())
          );
          
          // Try matching by team name only (last word)
          if (!apiTeam && dbTeam.name) {
            const dbTeamNameOnly = dbTeam.name.split(' ').slice(-1).join(' ');
            apiTeam = apiTeams.find(api => 
              api.name.toLowerCase().includes(dbTeamNameOnly.toLowerCase()) ||
              (api.shortName && api.shortName.toLowerCase() === dbTeamNameOnly.toLowerCase())
            );
          }
        }
        
        // Get odds for this team - use strict matching to avoid false positives
        let odds = null;
        
        // Try exact name match first
        if (oddsMap[dbTeam.name]) {
          odds = oddsMap[dbTeam.name];
        }
        
        // Try normalized name
        if (!odds) {
          const normalizedName = dbTeam.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
          odds = oddsMap[normalizedName] || null;
          
          // Try matching by team nickname (last word) - must be exact match
          // e.g., "Raiders" for Las Vegas Raiders, "Chiefs" for Kansas City Chiefs
          if (!odds) {
            const dbLastWord = dbTeam.name.split(' ').pop().toLowerCase();
            if (dbLastWord.length >= 4 && oddsMap[dbLastWord]) {
              odds = oddsMap[dbLastWord];
            }
          }
          
          // Try matching if API team name contains our full team name or vice versa
          // But only for keys that are full team names (contain spaces)
          if (!odds) {
            const oddsKeys = Object.keys(oddsMap);
            const matchingKey = oddsKeys.find(apiName => {
              // Only check full team names (not short keys like "ers")
              if (!apiName.includes(' ') || apiName.length < 10) return false;
              
              return apiName.toLowerCase().includes(dbTeam.name.toLowerCase()) ||
                     dbTeam.name.toLowerCase().includes(apiName.toLowerCase());
            });
            if (matchingKey) {
              odds = oddsMap[matchingKey];
            }
          }
        }
        
        // Prepare update data
        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        
        // Update record if API data is available
        if (apiTeam) {
          updateExpressions.push('#record = :record');
          expressionAttributeNames['#record'] = 'record';
          expressionAttributeValues[':record'] = apiTeam.record;
          
          updateExpressions.push('#wins = :wins');
          expressionAttributeNames['#wins'] = 'wins';
          expressionAttributeValues[':wins'] = apiTeam.wins;
          
          updateExpressions.push('#losses = :losses');
          expressionAttributeNames['#losses'] = 'losses';
          expressionAttributeValues[':losses'] = apiTeam.losses;
        }
        
        // Always update odds - use +99999 if not found from API
        const finalOdds = odds || '+99999';
        updateExpressions.push('#odds = :odds');
        expressionAttributeNames['#odds'] = 'odds';
        expressionAttributeValues[':odds'] = finalOdds;
        if (odds) {
          oddsUpdated++;
        }
        
        // Only update if we have something to update
        if (updateExpressions.length === 0) {
          console.log(`⏭️  Skipping ${dbTeam.name}: No updates available`);
          continue;
        }
        
        updateExpressions.push('#updatedAt = :updatedAt');
        expressionAttributeNames['#updatedAt'] = 'updatedAt';
        expressionAttributeValues[':updatedAt'] = new Date().toISOString();
        
        const updateCommand = new UpdateCommand({
          TableName: TEAMS_TABLE,
          Key: { id: dbTeam.id },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW'
        });
        
        const updateResult = await docClient.send(updateCommand);
        recordsUpdated++;
        
        const recordDisplay = apiTeam ? apiTeam.record : dbTeam.record || 'No record';
        const oddsDisplay = finalOdds + (odds ? '' : ' (default)');
        console.log(`✅ Updated: ${dbTeam.name} - Record: ${recordDisplay}, Odds: ${oddsDisplay}`);
      } catch (error) {
        console.error(`❌ Error updating ${dbTeam.name}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Update Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Teams updated: ${recordsUpdated}`);
    console.log(`🎲 Teams with odds updated: ${oddsUpdated}`);
    console.log(`📈 Total teams in database: ${dbTeams.length}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error updating NFL 2025 data:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updateNfl2025Data();

