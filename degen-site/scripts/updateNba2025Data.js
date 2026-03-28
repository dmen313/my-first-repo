#!/usr/bin/env node

/**
 * Local script to update NBA 2025 team records and championship odds
 * Fetches data from NBA.com Stats API and The Odds API, then updates DynamoDB
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

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function updateNba2025Data() {
  console.log('🏀 Updating NBA 2025 team records and championship odds...\n');

  try {
    // Step 1: Fetch NBA standings from NBA.com Stats API
    console.log('📊 Step 1: Fetching NBA standings...');
    const seasonYear = 2025;
    const seasonEnd = 2026;
    const nbaSeason = `${seasonYear}-${String(seasonEnd).slice(-2)}`; // "2025-26"
    
    const NBA_API_BASE = 'https://stats.nba.com/stats';
    const standingsUrl = `${NBA_API_BASE}/leaguestandingsv3?LeagueID=00&Season=${nbaSeason}&SeasonType=Regular%20Season`;
    
    const standingsResponse = await fetch(standingsUrl, {
      method: 'GET',
      headers: {
        'Referer': 'https://www.nba.com/',
        'Origin': 'https://www.nba.com',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    if (!standingsResponse.ok) {
      throw new Error(`NBA API error: ${standingsResponse.status} ${standingsResponse.statusText}`);
    }

    const standingsData = await standingsResponse.json();
    
    if (!standingsData || !standingsData.resultSets || standingsData.resultSets.length === 0) {
      throw new Error('Invalid NBA API response: missing resultSets');
    }

    const standingsResult = standingsData.resultSets[0];
    const headers = standingsResult.headers || [];
    const rowSet = standingsResult.rowSet || [];

    const teamNameIndex = headers.indexOf('TeamName');
    const teamCityIndex = headers.indexOf('TeamCity');
    const winsIndex = headers.indexOf('WINS');
    const lossesIndex = headers.indexOf('LOSSES');
    const gamesBackIndex = headers.indexOf('GB');

    const apiTeams = [];
    rowSet.forEach((row) => {
      const teamCity = teamCityIndex >= 0 ? (row[teamCityIndex] || '') : '';
      const teamName = teamNameIndex >= 0 ? (row[teamNameIndex] || '') : '';
      const fullTeamName = teamCity && teamName ? `${teamCity} ${teamName}` : teamName;
      const wins = winsIndex >= 0 ? (row[winsIndex] || 0) : 0;
      const losses = lossesIndex >= 0 ? (row[lossesIndex] || 0) : 0;
      const gamesBack = gamesBackIndex >= 0 && row[gamesBackIndex] !== undefined && row[gamesBackIndex] !== null ? row[gamesBackIndex] : '—';
      
      apiTeams.push({
        name: fullTeamName,
        record: `${wins}-${losses}`,
        wins,
        losses,
        gamesBack
      });
    });

    console.log(`✅ Fetched ${apiTeams.length} teams from NBA API for ${nbaSeason} season`);
    console.log(`   Sample teams: ${apiTeams.slice(0, 5).map(t => `${t.name} (${t.record})`).join(', ')}...\n`);

    // Step 2: Fetch odds from The Odds API
    console.log('🎲 Step 2: Fetching championship odds from The Odds API...');
    let oddsMap = {};
    let oddsFetched = false;

    if (!ODDS_API_KEY || ODDS_API_KEY === 'YOUR_API_KEY') {
      console.warn('⚠️  ODDS_API_KEY not found in environment variables. Skipping odds update.');
    } else {
      const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
      const possibleEndpoints = [
        'basketball_nba_championship_winner',
        'basketball_nba_championship',
        'basketball_nba_futures',
        'basketball_nba'
      ];

      for (const endpoint of possibleEndpoints) {
        try {
          // First try with markets=outrights parameter
          let oddsUrl = `${ODDS_API_BASE}/sports/${endpoint}/odds?regions=us&markets=outrights&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
          let oddsResponse = await fetch(oddsUrl);
          
          // If that fails, try without markets parameter
          if (!oddsResponse.ok || oddsResponse.status === 404) {
            oddsUrl = `${ODDS_API_BASE}/sports/${endpoint}/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
            oddsResponse = await fetch(oddsUrl);
          }
          
          if (oddsResponse.ok) {
            const oddsData = await oddsResponse.json();
            
            if (oddsData && !oddsData.error_code && Array.isArray(oddsData)) {
              oddsData.forEach(game => {
                if (game.bookmakers && game.bookmakers.length > 0) {
                  const bookmaker = game.bookmakers[0];
                  if (bookmaker.markets && bookmaker.markets.length > 0) {
                    const championshipMarket = bookmaker.markets.find(m => 
                      m.key === 'championship' || 
                      m.key === 'outrights' || 
                      m.key === 'futures' ||
                      m.key === 'winner'
                    ) || bookmaker.markets[0];
                    
                    if (championshipMarket.outcomes) {
                      championshipMarket.outcomes.forEach(outcome => {
                        const teamName = outcome.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
                        const odds = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
                        
                        oddsMap[teamName] = odds;
                        
                        // Store multiple variations for better matching
                        const nameParts = teamName.split(/\s+/);
                        if (nameParts.length > 1) {
                          oddsMap[nameParts[nameParts.length - 1]] = odds;
                          if (nameParts.length >= 2) {
                            oddsMap[nameParts.slice(-2).join(' ')] = odds;
                          }
                        }
                      });
                    }
                  }
                }
              });
              
              if (Object.keys(oddsMap).length > 0) {
                oddsFetched = true;
                console.log(`✅ Successfully fetched NBA odds from endpoint: ${endpoint}`);
                console.log(`   Found odds for ${Object.keys(oddsMap).length} unique team names/keys`);
                console.log(`   Sample: ${Object.keys(oddsMap).slice(0, 5).join(', ')}...\n`);
                break;
              }
            } else if (oddsData && oddsData.error_code) {
              console.log(`⚠️  Endpoint ${endpoint} returned error: ${oddsData.message || 'Unknown error'}`);
              continue;
            }
          } else if (oddsResponse.status === 404) {
            console.log(`⚠️  Endpoint ${endpoint} not found (404), trying next...`);
            continue;
          } else {
            console.log(`⚠️  Endpoint ${endpoint} returned status ${oddsResponse.status}, trying next...`);
            continue;
          }
        } catch (error) {
          console.log(`⚠️  Error trying endpoint ${endpoint}: ${error.message}`);
          continue;
        }
      }

      if (!oddsFetched) {
        console.warn('⚠️  Could not fetch NBA odds from any endpoint. Continuing without odds update.\n');
      }
    }

    // Step 3: Get NBA 2025 teams from DynamoDB
    console.log('📋 Step 3: Fetching NBA 2025 teams from DynamoDB...');
    const dbTeams = [];
    
    // Query Eastern Conference teams (must filter sportsLeague — NHL also uses East/West + season 2025)
    const easternQuery = new QueryCommand({
      TableName: TEAMS_TABLE,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      FilterExpression: '#sportsLeague = :sportsLeague',
      ExpressionAttributeNames: {
        '#league': 'league',
        '#season': 'season',
        '#sportsLeague': 'sportsLeague'
      },
      ExpressionAttributeValues: {
        ':league': 'Eastern Conference',
        ':season': '2025',
        ':sportsLeague': 'NBA'
      }
    });
    
    const easternResult = await docClient.send(easternQuery);
    const easternTeams = easternResult.Items || [];
    dbTeams.push(...easternTeams);
    
    // Query Western Conference teams
    const westernQuery = new QueryCommand({
      TableName: TEAMS_TABLE,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      FilterExpression: '#sportsLeague = :sportsLeague',
      ExpressionAttributeNames: {
        '#league': 'league',
        '#season': 'season',
        '#sportsLeague': 'sportsLeague'
      },
      ExpressionAttributeValues: {
        ':league': 'Western Conference',
        ':season': '2025',
        ':sportsLeague': 'NBA'
      }
    });
    
    const westernResult = await docClient.send(westernQuery);
    const westernTeams = westernResult.Items || [];
    dbTeams.push(...westernTeams);

    console.log(`✅ Found ${dbTeams.length} NBA 2025 teams in DynamoDB (${easternTeams.length} Eastern, ${westernTeams.length} Western)`);
    if (dbTeams.length > 0) {
      console.log(`   Sample teams: ${dbTeams.slice(0, 5).map(t => `${t.name} (${t.id})`).join(', ')}...\n`);
    }

    if (dbTeams.length === 0) {
      console.warn('⚠️  No teams found for NBA 2025. Make sure teams have been created first.\n');
      return;
    }

    // Step 4: Update teams with records and odds
    console.log('🔄 Step 4: Updating teams with records and odds...\n');
    let recordsUpdated = 0;
    let oddsUpdated = 0;

    for (const dbTeam of dbTeams) {
      try {
        // Find matching API team
        let apiTeam = apiTeams.find(api => 
          api.name === dbTeam.name || 
          (api.name && dbTeam.name && api.name.toLowerCase() === dbTeam.name.toLowerCase())
        );
        
        // Try matching by team name only (last 2 words)
        if (!apiTeam && dbTeam.name) {
          const dbTeamNameOnly = dbTeam.name.split(' ').slice(-2).join(' ');
          apiTeam = apiTeams.find(api => 
            api.name.toLowerCase().includes(dbTeamNameOnly.toLowerCase())
          );
        }
        
        // Special case: Los Angeles Clippers
        if (!apiTeam && dbTeam.name && dbTeam.name.includes('Clippers')) {
          apiTeam = apiTeams.find(api => 
            api.name && (api.name.includes('Clippers') || api.name.includes('LA Clippers'))
          );
        }
        
        if (apiTeam) {
          // Get odds for this team
          const normalizedName = dbTeam.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
          let odds = oddsMap[normalizedName] || null;
          
          // Try multiple name variations
          if (!odds) {
            const nameParts = normalizedName.split(/\s+/);
            if (nameParts.length > 0) {
              odds = oddsMap[nameParts[nameParts.length - 1]] || null;
            }
            if (!odds && nameParts.length >= 2) {
              odds = oddsMap[nameParts.slice(-2).join(' ')] || null;
            }
            // Handle "Los Angeles" -> "LA" conversion
            if (!odds && nameParts.length >= 2) {
              if (nameParts[0] === 'los' && nameParts[1] === 'angeles') {
                odds = oddsMap[`la ${nameParts.slice(2).join(' ')}`] || null;
              }
              if (!odds) {
                odds = oddsMap[nameParts.slice(-1).join(' ')] || null;
              }
            }
          }
          
          // Prepare update data
          const updateExpressions = [];
          const expressionAttributeNames = {};
          const expressionAttributeValues = {};
          
          updateExpressions.push('#record = :record');
          expressionAttributeNames['#record'] = 'record';
          expressionAttributeValues[':record'] = apiTeam.record;
          
          updateExpressions.push('#wins = :wins');
          expressionAttributeNames['#wins'] = 'wins';
          expressionAttributeValues[':wins'] = apiTeam.wins;
          
          updateExpressions.push('#losses = :losses');
          expressionAttributeNames['#losses'] = 'losses';
          expressionAttributeValues[':losses'] = apiTeam.losses;
          
          if (apiTeam.gamesBack !== undefined) {
            updateExpressions.push('#gamesBack = :gamesBack');
            expressionAttributeNames['#gamesBack'] = 'gamesBack';
            expressionAttributeValues[':gamesBack'] = apiTeam.gamesBack;
          }
          
          if (odds) {
            updateExpressions.push('#odds = :odds');
            expressionAttributeNames['#odds'] = 'odds';
            expressionAttributeValues[':odds'] = odds;
            oddsUpdated++;
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
          
          const oddsDisplay = odds || 'No odds found';
          console.log(`✅ Updated: ${dbTeam.name} - Record: ${apiTeam.record} (${apiTeam.wins}-${apiTeam.losses}), Odds: ${oddsDisplay}`);
        } else {
          console.warn(`⚠️  No API match found for: ${dbTeam.name}`);
        }
      } catch (error) {
        console.error(`❌ Error updating ${dbTeam.name}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Update Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Teams with records updated: ${recordsUpdated}`);
    console.log(`🎲 Teams with odds updated: ${oddsUpdated}`);
    console.log(`📈 Total teams in database: ${dbTeams.length}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error updating NBA 2025 data:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updateNba2025Data();

