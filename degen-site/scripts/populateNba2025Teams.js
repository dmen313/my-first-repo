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

// Fetch existing NBA 2024 teams
async function fetchNba2024Teams() {
  console.log('📊 Fetching NBA 2024 teams from database...');
  
  const data = await graphqlRequest(`
    query GetNbaTeams {
      getTeams(league: "nba", season: "2024") {
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

  const teams = data.getTeams || [];
  console.log(`✅ Found ${teams.length} NBA 2024 teams`);
  
  return teams;
}

// Check if NBA 2025 team already exists
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

// Fetch NBA odds from The Odds API
async function fetchNbaOdds() {
  if (!ODDS_API_KEY || ODDS_API_KEY === 'YOUR_API_KEY') {
    console.warn('⚠️ Odds API key not configured, skipping odds fetch');
    return null;
  }

  try {
    console.log('📡 Fetching NBA championship odds from The Odds API...');
    const url = `https://api.the-odds-api.com/v4/sports/basketball_nba_championship/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
    
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

// Create NBA 2025 team
async function createNba2025Team(team2024, oddsMap) {
  // Check if team already exists
  const exists = await teamExists(team2024.name, 'nba', '2025');
  if (exists) {
    console.log(`⏭️ Skipping ${team2024.name} (already exists)`);
    return null;
  }

  // Get odds for the team
  const odds = getOddsForTeam(team2024.name, oddsMap);

  const teamData = {
    name: team2024.name,
    record: '0-0', // Start fresh for 2025 season
    league: team2024.league, // Keep conference (Eastern Conference or Western Conference)
    division: team2024.division, // Keep division
    wins: 0,
    losses: 0,
    gamesBack: '0',
    wildCardGamesBack: '0',
    owner: team2024.owner || 'NA',
    odds: odds,
    season: '2025' // Explicitly set season to 2025
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
        }
      }
    `, { input: teamData });

    console.log(`✅ Created ${team2024.name} (${team2024.league}, ${team2024.division}, ${odds})`);
    return result.createTeam;
  } catch (error) {
    console.error(`❌ Failed to create ${team2024.name}:`, error.message);
    throw error;
  }
}

// Main function
async function main() {
  try {
    console.log('🏀 Populating NBA 2025 teams...\n');

    // Step 1: Fetch NBA 2024 teams
    const nba2024Teams = await fetchNba2024Teams();
    
    if (nba2024Teams.length === 0) {
      console.error('❌ No NBA 2024 teams found in database. Please ensure NBA 2024 teams exist first.');
      process.exit(1);
    }

    // Step 2: Fetch odds from API (optional)
    console.log('');
    const oddsMap = await fetchNbaOdds();

    // Step 3: Create NBA 2025 teams
    console.log('\n🔄 Creating NBA 2025 teams...\n');
    
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const team of nba2024Teams) {
      try {
        const result = await createNba2025Team(team, oddsMap);
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

    console.log('\n✅ NBA 2025 team population complete!');
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

