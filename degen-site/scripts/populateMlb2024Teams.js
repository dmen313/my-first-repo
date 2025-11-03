#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;
const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

// GraphQL helper function
async function graphqlRequest(query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

// Fetch existing MLB teams (from 2025 or null season)
async function fetchMlbSourceTeams() {
  console.log('📊 Fetching MLB teams from database...');
  
  // First try to get MLB 2025 teams
  let data = await graphqlRequest(`
    query GetMlb2025Teams {
      getTeams(league: "mlb", season: "2025") {
        id
        name
        record
        league
        division
        wins
        losses
        gamesBack
        wildCardGamesBack
        owner
        odds
      }
    }
  `);

  let teams = data.getTeams || [];
  
  // If no 2025 teams, get all MLB teams (which may have null season)
  if (teams.length === 0) {
    console.log('   No MLB 2025 teams found, checking all MLB teams...');
    const allData = await graphqlRequest(`
      query GetAllTeams {
        getTeams {
          id
          name
          record
          league
          division
          wins
          losses
          gamesBack
          wildCardGamesBack
          owner
          odds
          season
        }
      }
    `);
    
    // Filter to MLB teams (American League or National League, not Conference)
    const allTeams = allData.getTeams || [];
    teams = allTeams.filter(t => 
      t.league && 
      (t.league.toLowerCase().includes('league')) &&
      !t.league.toLowerCase().includes('conference')
    );
    console.log(`   Found ${teams.length} MLB teams (some may have null season)`);
  }
  
  console.log(`✅ Found ${teams.length} MLB teams to use as source`);
  
  return teams;
}

// Check if MLB 2024 team already exists
async function teamExists(name, league, season) {
  const data = await graphqlRequest(`
    query CheckTeam($league: String, $season: String) {
      getTeams(league: $league, season: $season) {
        id
        name
      }
    }
  `, { league, season });
  
  const teams = data.getTeams || [];
  return teams.some(team => team.name.toLowerCase() === name.toLowerCase());
}

// Fetch MLB odds from The Odds API
async function fetchMlbOdds() {
  if (!ODDS_API_KEY || ODDS_API_KEY === 'YOUR_API_KEY') {
    console.warn('⚠️ Odds API key not configured, skipping odds fetch');
    return null;
  }

  try {
    console.log('📡 Fetching MLB World Series odds from The Odds API...');
    const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb_world_series_winner/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Odds API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Check for API errors
    if (data.error_code) {
      if (data.error_code === 'OUT_OF_USAGE_CREDITS') {
        console.warn('🚫 Odds API quota exceeded, continuing without odds');
        return null;
      }
      throw new Error(`Odds API error: ${data.message || 'Unknown error'}`);
    }

    // Parse odds data
    const oddsMap = {};
    if (data && data.length > 0) {
      data.forEach(game => {
        if (game.bookmakers && game.bookmakers.length > 0) {
          const bookmaker = game.bookmakers[0];
          if (bookmaker.markets && bookmaker.markets.length > 0) {
            const market = bookmaker.markets[0];
            if (market.outcomes) {
              market.outcomes.forEach(outcome => {
                const teamName = outcome.name.toLowerCase().replace(/[^a-z\s]/g, '');
                const odds = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
                oddsMap[teamName] = odds;
              });
            }
          }
        }
      });
    }

    console.log(`✅ Fetched odds for ${Object.keys(oddsMap).length} teams`);
    return oddsMap;
  } catch (error) {
    console.warn(`⚠️ Failed to fetch odds: ${error.message}`);
    return null;
  }
}

// Get odds for a team name
function getOddsForTeam(teamName, oddsMap) {
  if (!oddsMap) return '+5000'; // Default odds
  
  const normalizedName = teamName.toLowerCase().replace(/[^a-z\s]/g, '');
  
  // Try exact match
  if (oddsMap[normalizedName]) {
    return oddsMap[normalizedName];
  }
  
  // Try partial matching
  const matchingKey = Object.keys(oddsMap).find(key => 
    key.includes(normalizedName) || normalizedName.includes(key)
  );
  
  if (matchingKey) {
    return oddsMap[matchingKey];
  }
  
  return '+5000'; // Default odds
}

// Create MLB 2024 team
async function createMlb2024Team(sourceTeam, oddsMap) {
  // Check if team already exists
  const exists = await teamExists(sourceTeam.name, 'mlb', '2024');
  if (exists) {
    console.log(`⏭️ Skipping ${sourceTeam.name} (already exists)`);
    return null;
  }

  // Get odds for the team (use existing odds if available, otherwise fetch)
  let odds = sourceTeam.odds || getOddsForTeam(sourceTeam.name, oddsMap);
  if (!odds || odds === '999999' || odds === 'null') {
    odds = getOddsForTeam(sourceTeam.name, oddsMap);
  }

  const teamData = {
    name: sourceTeam.name,
    record: '0-0', // Start fresh for 2024 season
    league: sourceTeam.league, // Keep league (American League or National League)
    division: sourceTeam.division, // Keep division
    wins: 0,
    losses: 0,
    gamesBack: '0',
    wildCardGamesBack: '0',
    owner: sourceTeam.owner || 'NA',
    odds: odds,
    season: '2024' // Explicitly set season to 2024
  };

  try {
    const result = await graphqlRequest(`
      mutation CreateTeam($input: TeamInput!) {
        createTeam(input: $input) {
          id
          name
          league
          division
          odds
          season
        }
      }
    `, { input: teamData });

    console.log(`✅ Created ${sourceTeam.name} (${sourceTeam.league}, ${sourceTeam.division}, ${odds}) - season: 2024`);
    return result.createTeam;
  } catch (error) {
    console.error(`❌ Failed to create ${sourceTeam.name}:`, error.message);
    throw error;
  }
}

// Main function
async function main() {
  try {
    console.log('⚾ Populating MLB 2024 teams...\n');

    // Step 1: Fetch MLB source teams (2025 or existing teams)
    const mlbSourceTeams = await fetchMlbSourceTeams();
    
    if (mlbSourceTeams.length === 0) {
      console.error('❌ No MLB teams found in database. Please ensure MLB teams exist first.');
      process.exit(1);
    }

    // Step 2: Fetch odds from API (optional)
    console.log('');
    const oddsMap = await fetchMlbOdds();

    // Step 3: Create MLB 2024 teams
    console.log('\n🔄 Creating MLB 2024 teams...\n');
    
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const team of mlbSourceTeams) {
      try {
        const result = await createMlb2024Team(team, oddsMap);
        if (result) {
          createdCount++;
        } else {
          skippedCount++;
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`❌ Error processing ${team.name}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n✅ MLB 2024 team population complete!');
    console.log(`📈 Created: ${createdCount} teams`);
    console.log(`⏭️ Skipped (already exists): ${skippedCount} teams`);
    console.log(`❌ Errors: ${errorCount} teams`);
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

