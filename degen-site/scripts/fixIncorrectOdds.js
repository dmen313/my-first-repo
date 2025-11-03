require('dotenv').config();

// GraphQL client for Node.js
async function graphqlRequest(query, variables = {}) {
  const response = await fetch('http://localhost:4000/graphql', {
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

// Update team odds
async function updateTeamOdds(id, odds) {
  const result = await graphqlRequest(`
    mutation UpdateTeam($input: UpdateTeamInput!) {
      updateTeam(input: $input) {
        id
        name
        odds
      }
    }
  `, { input: { id, odds } });

  return result.updateTeam;
}

// Fetch current odds from The Odds API
async function fetchCurrentOdds() {
  const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;
  
  if (!ODDS_API_KEY) {
    throw new Error('REACT_APP_ODDS_API_KEY environment variable is required');
  }

  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf_championship_winner/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=outrights&oddsFormat=american&dateFormat=iso`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Odds API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Extract odds from the first bookmaker
  const oddsMap = new Map();
  if (data && data.length > 0 && data[0].bookmakers && data[0].bookmakers.length > 0) {
    const bookmaker = data[0].bookmakers[0];
    if (bookmaker.markets && bookmaker.markets.length > 0) {
      const market = bookmaker.markets[0];
      if (market.outcomes) {
        market.outcomes.forEach(outcome => {
          oddsMap.set(outcome.name, outcome.price);
        });
      }
    }
  }

  return oddsMap;
}

// Normalize team name for comparison
function normalizeTeamName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace('university', '')
    .replace('college', '')
    .replace('state', 'st')
    .trim();
}

// Find matching team between database and API
function findMatchingTeam(dbTeam, oddsMap) {
  const dbName = normalizeTeamName(dbTeam.name);
  
  for (const [apiName, odds] of oddsMap.entries()) {
    const normalizedApiName = normalizeTeamName(apiName);
    
    // Exact match
    if (dbName === normalizedApiName) {
      return { apiName, odds };
    }
    
    // Partial match for common variations
    if (dbName.includes(normalizedApiName) || normalizedApiName.includes(dbName)) {
      return { apiName, odds };
    }
  }
  
  return null;
}

// Main function
async function main() {
  try {
    console.log('🏈 Fixing incorrect NCAA Football 2025 odds...');
    
    // Fetch current odds from API
    console.log('📡 Fetching current odds from The Odds API...');
    const oddsMap = await fetchCurrentOdds();
    console.log(`✅ Fetched odds for ${oddsMap.size} teams from API`);
    
    // Get all NCAA teams from database
    console.log('📊 Fetching teams from GraphQL database...');
    const data = await graphqlRequest(`
      query GetNcaaTeams {
        getTeams(league: "ncaa", season: "2025") {
          id
          name
          odds
          division
        }
      }
    `);

    const teams = data.getTeams;
    console.log(`✅ Found ${teams.length} teams in database`);
    
    // Find teams with incorrect odds
    const teamsToUpdate = [];
    
    for (const team of teams) {
      const match = findMatchingTeam(team, oddsMap);
      
      if (match) {
        const dbOdds = parseInt(team.odds.replace('+', ''));
        const apiOdds = match.odds;
        
        if (dbOdds !== apiOdds) {
          teamsToUpdate.push({
            team,
            currentOdds: team.odds,
            newOdds: `+${apiOdds}`,
            apiName: match.apiName
          });
        }
      }
    }
    
    console.log(`\n📊 Found ${teamsToUpdate.length} teams with incorrect odds`);
    
    if (teamsToUpdate.length === 0) {
      console.log('✅ All odds are already correct!');
      return;
    }
    
    // Update incorrect odds
    console.log('\n🔄 Updating incorrect odds...');
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const update of teamsToUpdate) {
      try {
        console.log(`📝 Updating ${update.team.name}: ${update.currentOdds} → ${update.newOdds} (${update.apiName})`);
        
        await updateTeamOdds(update.team.id, update.newOdds);
        updatedCount++;
        
        // Add small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to update ${update.team.name}:`, error.message);
        errorCount++;
      }
    }
    
    // Verify the updates
    console.log('\n🔍 Verifying updates...');
    const verifyData = await graphqlRequest(`
      query GetNcaaTeams {
        getTeams(league: "ncaa", season: "2025") {
          id
          name
          odds
          division
        }
      }
    `);

    const updatedTeams = verifyData.getTeams;
    const validationResults = {
      correct: 0,
      incorrect: 0
    };
    
    for (const team of updatedTeams) {
      const match = findMatchingTeam(team, oddsMap);
      
      if (match) {
        const dbOdds = parseInt(team.odds.replace('+', ''));
        const apiOdds = match.odds;
        
        if (dbOdds === apiOdds) {
          validationResults.correct++;
        } else {
          validationResults.incorrect++;
        }
      }
    }
    
    // Display final results
    console.log('\n📊 Final Results:');
    console.log(`   ✅ Successfully updated: ${updatedCount} teams`);
    console.log(`   ❌ Update errors: ${errorCount} teams`);
    console.log(`   📈 Final odds accuracy: ${((validationResults.correct / updatedTeams.length) * 100).toFixed(1)}%`);
    console.log(`   ✅ Correct odds: ${validationResults.correct}`);
    console.log(`   ❌ Still incorrect: ${validationResults.incorrect}`);
    
    if (validationResults.incorrect > 0) {
      console.log('\n⚠️ Teams still with incorrect odds:');
      for (const team of updatedTeams) {
        const match = findMatchingTeam(team, oddsMap);
        if (match) {
          const dbOdds = parseInt(team.odds.replace('+', ''));
          const apiOdds = match.odds;
          
          if (dbOdds !== apiOdds) {
            console.log(`   ${team.name}: DB=${team.odds}, API=+${apiOdds} (${match.apiName})`);
          }
        }
      }
    }
    
    console.log(`\n🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

