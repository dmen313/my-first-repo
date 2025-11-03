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

// Delete team
async function deleteTeam(id) {
  const result = await graphqlRequest(`
    mutation DeleteTeam($id: ID!) {
      deleteTeam(id: $id)
    }
  `, { id });

  return result.deleteTeam;
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
    console.log('🏈 Validating all NCAA Football 2025 odds...');
    
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
    
    // Group teams by normalized name to find duplicates
    const teamGroups = new Map();
    teams.forEach(team => {
      const normalizedName = normalizeTeamName(team.name);
      if (!teamGroups.has(normalizedName)) {
        teamGroups.set(normalizedName, []);
      }
      teamGroups.get(normalizedName).push(team);
    });
    
    // Find duplicates
    const duplicates = [];
    const validTeams = [];
    
    for (const [normalizedName, teamList] of teamGroups.entries()) {
      if (teamList.length > 1) {
        duplicates.push({ normalizedName, teams: teamList });
      } else {
        validTeams.push(teamList[0]);
      }
    }
    
    console.log(`\n📊 Analysis Results:`);
    console.log(`   Total teams: ${teams.length}`);
    console.log(`   Valid teams: ${validTeams.length}`);
    console.log(`   Duplicate groups: ${duplicates.length}`);
    
    // Handle duplicates
    if (duplicates.length > 0) {
      console.log('\n🔄 Processing duplicates...');
      for (const duplicate of duplicates) {
        console.log(`\n📋 Duplicate group: ${duplicate.normalizedName}`);
        duplicate.teams.forEach(team => {
          console.log(`   - ${team.name}: ${team.odds} (${team.division})`);
        });
        
        // Find which one matches the API
        let bestMatch = null;
        let bestMatchTeam = null;
        
        for (const team of duplicate.teams) {
          const match = findMatchingTeam(team, oddsMap);
          if (match) {
            if (!bestMatch || Math.abs(match.odds - parseInt(team.odds.replace('+', ''))) < Math.abs(bestMatch.odds - parseInt(bestMatchTeam.odds.replace('+', '')))) {
              bestMatch = match;
              bestMatchTeam = team;
            }
          }
        }
        
        if (bestMatch) {
          console.log(`   ✅ Best match: ${bestMatchTeam.name} (${bestMatchTeam.odds}) matches API: ${bestMatch.apiName} (${bestMatch.odds})`);
          
          // Delete other duplicates
          for (const team of duplicate.teams) {
            if (team.id !== bestMatchTeam.id) {
              console.log(`   🗑️ Deleting duplicate: ${team.name} (${team.odds})`);
              await deleteTeam(team.id);
            }
          }
        } else {
          console.log(`   ❌ No API match found for any team in this group`);
        }
      }
    }
    
    // Validate odds for remaining teams
    console.log('\n🔍 Validating odds for all teams...');
    const updatedData = await graphqlRequest(`
      query GetNcaaTeams {
        getTeams(league: "ncaa", season: "2025") {
          id
          name
          odds
          division
        }
      }
    `);

    const remainingTeams = updatedData.getTeams;
    const validationResults = {
      correct: [],
      incorrect: [],
      notFound: []
    };
    
    for (const team of remainingTeams) {
      const match = findMatchingTeam(team, oddsMap);
      
      if (match) {
        const dbOdds = parseInt(team.odds.replace('+', ''));
        const apiOdds = match.odds;
        
        if (dbOdds === apiOdds) {
          validationResults.correct.push({
            team: team.name,
            odds: team.odds,
            apiName: match.apiName
          });
        } else {
          validationResults.incorrect.push({
            team: team.name,
            dbOdds: team.odds,
            apiOdds: `+${apiOdds}`,
            apiName: match.apiName
          });
        }
      } else {
        validationResults.notFound.push({
          team: team.name,
          odds: team.odds
        });
      }
    }
    
    // Display results
    console.log('\n📊 Validation Results:');
    console.log(`   ✅ Correct odds: ${validationResults.correct.length}`);
    console.log(`   ❌ Incorrect odds: ${validationResults.incorrect.length}`);
    console.log(`   ❓ Not found in API: ${validationResults.notFound.length}`);
    
    if (validationResults.correct.length > 0) {
      console.log('\n✅ Teams with correct odds:');
      validationResults.correct.slice(0, 5).forEach(result => {
        console.log(`   ${result.team}: ${result.odds} ✓`);
      });
      if (validationResults.correct.length > 5) {
        console.log(`   ... and ${validationResults.correct.length - 5} more`);
      }
    }
    
    if (validationResults.incorrect.length > 0) {
      console.log('\n❌ Teams with incorrect odds:');
      validationResults.incorrect.forEach(result => {
        console.log(`   ${result.team}: DB=${result.dbOdds}, API=${result.apiOdds} (${result.apiName})`);
      });
    }
    
    if (validationResults.notFound.length > 0) {
      console.log('\n❓ Teams not found in API:');
      validationResults.notFound.slice(0, 10).forEach(result => {
        console.log(`   ${result.team}: ${result.odds}`);
      });
      if (validationResults.notFound.length > 10) {
        console.log(`   ... and ${validationResults.notFound.length - 10} more`);
      }
    }
    
    // Summary
    console.log('\n📈 Summary:');
    console.log(`   Total teams processed: ${remainingTeams.length}`);
    console.log(`   Duplicates removed: ${duplicates.reduce((sum, d) => sum + d.teams.length - 1, 0)}`);
    console.log(`   Odds accuracy: ${((validationResults.correct.length / remainingTeams.length) * 100).toFixed(1)}%`);
    
    console.log(`\n🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

