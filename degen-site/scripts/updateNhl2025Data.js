#!/usr/bin/env node

/**
 * Local script to update NHL 2025 team records and championship odds
 * Fetches data from NHL API and The Odds API, then updates DynamoDB
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// Use native fetch (Node.js 18+) or import node-fetch if not available
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
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

// NHL team name mappings (API name -> common variations)
const NHL_TEAM_MAPPINGS = {
  'utah mammoth': ['utah mammoth', 'utah hockey club', 'utah', 'utah hc'],
  'vegas golden knights': ['vegas golden knights', 'golden knights', 'vegas'],
  'seattle kraken': ['seattle kraken', 'kraken', 'seattle'],
  'colorado avalanche': ['colorado avalanche', 'avalanche', 'colorado'],
  'dallas stars': ['dallas stars', 'stars', 'dallas'],
  'winnipeg jets': ['winnipeg jets', 'jets', 'winnipeg'],
  'minnesota wild': ['minnesota wild', 'wild', 'minnesota'],
  'los angeles kings': ['los angeles kings', 'kings', 'la kings'],
  'edmonton oilers': ['edmonton oilers', 'oilers', 'edmonton'],
  'vancouver canucks': ['vancouver canucks', 'canucks', 'vancouver'],
  'calgary flames': ['calgary flames', 'flames', 'calgary'],
  'nashville predators': ['nashville predators', 'predators', 'nashville'],
  'st louis blues': ['st louis blues', 'blues', 'st. louis blues', 'saint louis blues'],
  'chicago blackhawks': ['chicago blackhawks', 'blackhawks', 'chicago'],
  'anaheim ducks': ['anaheim ducks', 'ducks', 'anaheim'],
  'san jose sharks': ['san jose sharks', 'sharks', 'san jose'],
  'florida panthers': ['florida panthers', 'panthers', 'florida'],
  'toronto maple leafs': ['toronto maple leafs', 'maple leafs', 'toronto'],
  'tampa bay lightning': ['tampa bay lightning', 'lightning', 'tampa bay', 'tampa'],
  'boston bruins': ['boston bruins', 'bruins', 'boston'],
  'detroit red wings': ['detroit red wings', 'red wings', 'detroit'],
  'ottawa senators': ['ottawa senators', 'senators', 'ottawa'],
  'montreal canadiens': ['montreal canadiens', 'canadiens', 'montreal', 'habs'],
  'buffalo sabres': ['buffalo sabres', 'sabres', 'buffalo'],
  'new york rangers': ['new york rangers', 'rangers', 'ny rangers'],
  'new york islanders': ['new york islanders', 'islanders', 'ny islanders'],
  'carolina hurricanes': ['carolina hurricanes', 'hurricanes', 'carolina'],
  'washington capitals': ['washington capitals', 'capitals', 'washington'],
  'new jersey devils': ['new jersey devils', 'devils', 'new jersey', 'nj devils'],
  'philadelphia flyers': ['philadelphia flyers', 'flyers', 'philadelphia'],
  'pittsburgh penguins': ['pittsburgh penguins', 'penguins', 'pittsburgh'],
  'columbus blue jackets': ['columbus blue jackets', 'blue jackets', 'columbus']
};

async function updateNhl2025Data() {
  console.log('🏒 Updating NHL 2025 team records and championship odds...\n');

  try {
    // Step 1: Fetch NHL standings from NHL API
    console.log('📊 Step 1: Fetching NHL standings...');
    
    const NHL_API_BASE = 'https://api-web.nhle.com/v1';
    const standingsUrl = `${NHL_API_BASE}/standings/now`;
    
    let apiTeams = [];
    
    try {
      const standingsResponse = await fetch(standingsUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });

      if (!standingsResponse.ok) {
        throw new Error(`NHL API error: ${standingsResponse.status} ${standingsResponse.statusText}`);
      }

      const standingsData = await standingsResponse.json();
      
      if (!standingsData || !standingsData.standings) {
        throw new Error('Invalid NHL API response: missing standings');
      }

      standingsData.standings.forEach((team) => {
        const teamName = team.teamName?.default || team.teamCommonName?.default || '';
        const teamAbbrev = team.teamAbbrev?.default || '';
        const placeName = team.placeName?.default || '';
        const fullTeamName = placeName && teamName ? `${placeName} ${teamName}` : teamName;
        
        apiTeams.push({
          name: fullTeamName,
          abbrev: teamAbbrev,
          record: `${team.wins || 0}-${team.losses || 0}-${team.otLosses || 0}`,
          wins: team.wins || 0,
          losses: team.losses || 0,
          otLosses: team.otLosses || 0,
          points: team.points || 0,
          gamesPlayed: team.gamesPlayed || 0,
          conferenceSequence: team.conferenceSequence,
          divisionSequence: team.divisionSequence,
          conferenceName: team.conferenceName,
          divisionName: team.divisionName
        });
      });

      console.log(`✅ Fetched ${apiTeams.length} teams from NHL API`);
      console.log(`   Sample teams: ${apiTeams.slice(0, 5).map(t => `${t.name} (${t.record}, ${t.points} pts)`).join(', ')}...\n`);
    } catch (nhlError) {
      console.warn(`⚠️  Could not fetch NHL standings: ${nhlError.message}`);
      console.log('   Will continue with odds update only.\n');
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
        'icehockey_nhl_championship_winner',
        'icehockey_nhl_championship',
        'icehockey_nhl'
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
                console.log(`✅ Successfully fetched NHL odds from endpoint: ${endpoint}`);
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
        console.warn('⚠️  Could not fetch NHL odds from any endpoint. Continuing without odds update.\n');
      }
    }

    // Step 3: Get NHL 2025 teams from DynamoDB
    console.log('📋 Step 3: Fetching NHL 2025 teams from DynamoDB...');
    
    // Scan for teams where sportsLeague = 'NHL' and season = '2025'
    const scanCommand = new ScanCommand({
      TableName: TEAMS_TABLE,
      FilterExpression: '#sportsLeague = :sportsLeague AND #season = :season',
      ExpressionAttributeNames: {
        '#sportsLeague': 'sportsLeague',
        '#season': 'season'
      },
      ExpressionAttributeValues: {
        ':sportsLeague': 'NHL',
        ':season': '2025'
      }
    });
    
    const scanResult = await docClient.send(scanCommand);
    const dbTeams = scanResult.Items || [];

    console.log(`✅ Found ${dbTeams.length} NHL 2025 teams in DynamoDB`);
    if (dbTeams.length > 0) {
      console.log(`   Sample teams: ${dbTeams.slice(0, 5).map(t => `${t.name} (${t.id})`).join(', ')}...\n`);
    }

    if (dbTeams.length === 0) {
      console.warn('⚠️  No teams found for NHL 2025. Make sure teams have been created first.\n');
      return;
    }

    // Step 4: Update teams with records and odds
    console.log('🔄 Step 4: Updating teams with records and odds...\n');
    let recordsUpdated = 0;
    let oddsUpdated = 0;

    for (const dbTeam of dbTeams) {
      try {
        // Find matching API team by name
        let apiTeam = null;
        if (apiTeams.length > 0) {
          const dbTeamNameLower = dbTeam.name.toLowerCase();
          
          // Try exact match first
          apiTeam = apiTeams.find(api => 
            api.name.toLowerCase() === dbTeamNameLower
          );
          
          // Try matching by last part of name
          if (!apiTeam) {
            const dbTeamNameParts = dbTeamNameLower.split(' ');
            const dbTeamLastPart = dbTeamNameParts.slice(-2).join(' ');
            const dbTeamLastWord = dbTeamNameParts[dbTeamNameParts.length - 1];
            
            apiTeam = apiTeams.find(api => {
              const apiNameLower = api.name.toLowerCase();
              return apiNameLower.includes(dbTeamLastPart) || apiNameLower.includes(dbTeamLastWord);
            });
          }
        }
        
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
          // Try NHL team mappings
          if (!odds) {
            for (const [key, variations] of Object.entries(NHL_TEAM_MAPPINGS)) {
              if (variations.some(v => normalizedName.includes(v) || v.includes(normalizedName))) {
                odds = oddsMap[key] || oddsMap[variations[1]] || oddsMap[variations[2]] || null;
                if (odds) break;
              }
            }
          }
        }
        
        // Prepare update data
        const updateExpressions = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        
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
          
          if (apiTeam.points !== undefined) {
            updateExpressions.push('#gamesBack = :gamesBack');
            expressionAttributeNames['#gamesBack'] = 'gamesBack';
            expressionAttributeValues[':gamesBack'] = `${apiTeam.points} pts`;
          }
        }
        
        if (odds) {
          updateExpressions.push('#odds = :odds');
          expressionAttributeNames['#odds'] = 'odds';
          expressionAttributeValues[':odds'] = odds;
          oddsUpdated++;
        }
        
        if (updateExpressions.length > 0) {
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
          
          await docClient.send(updateCommand);
          
          if (apiTeam) recordsUpdated++;
          
          const recordDisplay = apiTeam ? apiTeam.record : dbTeam.record || 'N/A';
          const pointsDisplay = apiTeam ? `${apiTeam.points} pts` : '';
          const oddsDisplay = odds || 'No odds found';
          console.log(`✅ Updated: ${dbTeam.name} - Record: ${recordDisplay} ${pointsDisplay}, Odds: ${oddsDisplay}`);
        } else {
          console.warn(`⚠️  No updates available for: ${dbTeam.name}`);
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
    console.error('\n❌ Error updating NHL 2025 data:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updateNhl2025Data();


