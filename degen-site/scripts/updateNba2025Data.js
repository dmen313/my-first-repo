#!/usr/bin/env node

/**
 * Local script to update NBA 2025 team records and championship odds
 * Fetches data from ESPN NBA API and The Odds API, then updates DynamoDB
 *
 * Note: stats.nba.com blocks GitHub Actions / cloud IP ranges (silent TCP read
 * timeout from the runner), so we use ESPN's public standings endpoint, the same
 * source used by updateNfl2025Data.js. ESPN uses end-year for season — the
 * 2025-26 NBA season is `season=2026`.
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
    // Step 1: Fetch NBA standings from ESPN API
    console.log('📊 Step 1: Fetching NBA standings from ESPN API...');

    // ESPN uses end-year for season: 2025-26 NBA season = season=2026
    const seasonYear = 2025;
    const seasonEnd = 2026;
    const espnSeason = seasonEnd;
    const nbaSeasonLabel = `${seasonYear}-${String(seasonEnd).slice(-2)}`; // "2025-26"

    const ESPN_API_BASE = 'https://site.api.espn.com/apis/v2/sports/basketball/nba';
    const standingsUrl = `${ESPN_API_BASE}/standings?season=${espnSeason}&level=3`;

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

    // Parse ESPN standings data. ESPN groups standings by conference (children)
    // and may either put entries directly on conference.standings.entries OR
    // nest them under conference.children[].standings.entries (division-level).
    // Handle both shapes (mirrors updateNfl2025Data.js).
    const apiTeams = [];

    const extractEntries = (node, conferenceName) => {
      const entries = (node && node.standings && node.standings.entries) || [];
      for (const entry of entries) {
        const team = entry.team || {};
        const stats = entry.stats || [];

        let wins = 0;
        let losses = 0;
        let gamesBack = '—';

        for (const stat of stats) {
          const statName = (stat.name || '').toLowerCase();
          const statType = (stat.type || '').toLowerCase();
          if (statName === 'wins' || statType === 'wins') {
            wins = parseInt(stat.value) || 0;
          } else if (statName === 'losses' || statType === 'losses') {
            losses = parseInt(stat.value) || 0;
          } else if (statName === 'gamesbehind' || statType === 'gamesbehind' || statName === 'gb') {
            // ESPN returns 0 for the leader; surface that as "—" to match prior behavior.
            const v = stat.value;
            if (v === undefined || v === null) {
              gamesBack = '—';
            } else if (typeof v === 'number') {
              gamesBack = v === 0 ? '—' : v;
            } else {
              gamesBack = v;
            }
          }
        }

        apiTeams.push({
          name: team.displayName || team.name || '',
          shortName: team.shortDisplayName || team.abbreviation || '',
          record: `${wins}-${losses}`,
          wins,
          losses,
          gamesBack,
          conference: conferenceName
        });
      }
    };

    if (standingsData && Array.isArray(standingsData.children)) {
      for (const conference of standingsData.children) {
        const conferenceName = conference.name || conference.abbreviation || 'Unknown';

        // Flat case: entries directly on the conference
        extractEntries(conference, conferenceName);

        // Nested case: entries under divisions inside the conference
        if (Array.isArray(conference.children)) {
          for (const division of conference.children) {
            extractEntries(division, conferenceName);
          }
        }
      }
    }

    console.log(`✅ Fetched ${apiTeams.length} teams from ESPN API for ${nbaSeasonLabel} season`);
    if (apiTeams.length > 0) {
      console.log(`   Sample teams: ${apiTeams.slice(0, 5).map(t => `${t.name} (${t.record})`).join(', ')}...\n`);
    } else {
      console.log('   ⚠️  No standings entries returned (NBA season may not have started)\n');
    }

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
        'basketball_nba_futures'
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
                    );
                    
                    if (!championshipMarket) return;

                    // Futures markets list all teams (10+); game lines only have 2
                    if (!championshipMarket.outcomes || championshipMarket.outcomes.length < 5) return;

                    championshipMarket.outcomes.forEach(outcome => {
                      const teamName = outcome.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
                      const odds = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
                      
                      oddsMap[teamName] = odds;
                      
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
          
          if (!odds) odds = '+999999';
          updateExpressions.push('#odds = :odds');
          expressionAttributeNames['#odds'] = 'odds';
          expressionAttributeValues[':odds'] = odds;
          oddsUpdated++;
          
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

