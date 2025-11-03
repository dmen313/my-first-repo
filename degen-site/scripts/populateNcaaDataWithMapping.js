require('dotenv').config();

const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;
const CFBD_API_KEY = process.env.CFBD_API_KEY;

if (!ODDS_API_KEY) {
  console.error('❌ ODDS_API_KEY environment variable is required');
  process.exit(1);
}

if (!CFBD_API_KEY) {
  console.error('❌ CFBD_API_KEY environment variable is required');
  process.exit(1);
}

const SPORT = "americanfootball_ncaaf_championship_winner";
const REGIONS = "us";
const MARKETS = "outrights";
const ODDS_FORMAT = "american";
const DATE_FORMAT = "iso";
const YEAR = 2025;

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

// Fetch team mappings from GraphQL
async function fetchTeamMappings() {
  console.log('📊 Fetching team mappings from GraphQL...');
  
  const data = await graphqlRequest(`
    query GetTeamMappings {
      getTeamMappings(league: "ncaa", season: "2025") {
        id
        cfbdId
        cfbdName
        cfbdMascot
        cfbdConference
        cfbdAbbreviation
        oddsApiName
        oddsApiOdds
        matchType
      }
    }
  `);

  const mappings = data.getTeamMappings;
  console.log(`✅ Fetched ${mappings.length} team mappings`);
  
  // Create lookup maps for easy access
  const cfbdIdToMapping = new Map();
  const oddsApiNameToMapping = new Map();
  const cfbdNameToMapping = new Map();
  
  mappings.forEach(mapping => {
    cfbdIdToMapping.set(mapping.cfbdId, mapping);
    oddsApiNameToMapping.set(mapping.oddsApiName, mapping);
    cfbdNameToMapping.set(mapping.cfbdName, mapping);
  });
  
  return {
    mappings,
    cfbdIdToMapping,
    oddsApiNameToMapping,
    cfbdNameToMapping
  };
}

// Fetch current odds from The Odds API
async function fetchOddsApiData() {
  console.log('📡 Fetching current odds from The Odds API...');
  
  const url = `https://api.the-odds-api.com/v4/sports/${SPORT}/odds?apiKey=${ODDS_API_KEY}&regions=${REGIONS}&markets=${MARKETS}&oddsFormat=${ODDS_FORMAT}&dateFormat=${DATE_FORMAT}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Odds API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Extract odds from the first bookmaker
  const oddsData = [];
  if (data && data.length > 0 && data[0].bookmakers && data[0].bookmakers.length > 0) {
    const bookmaker = data[0].bookmakers[0];
    if (bookmaker.markets && bookmaker.markets.length > 0) {
      const market = bookmaker.markets[0];
      if (market.outcomes) {
        market.outcomes.forEach(outcome => {
          oddsData.push({
            name: outcome.name,
            odds: outcome.price
          });
        });
      }
    }
  }

  console.log(`✅ Fetched odds for ${oddsData.length} teams from The Odds API`);
  return oddsData;
}

// Fetch teams from CFBD API
async function fetchCfbdData() {
  console.log('📡 Fetching teams from CFBD API...');
  
  const url = 'https://api.collegefootballdata.com/teams';
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${CFBD_API_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error(`CFBD API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Filter for FBS teams only (using classification field)
  const fbsTeams = data.filter(team => team.classification === 'fbs');
  
  console.log(`✅ Fetched ${fbsTeams.length} FBS teams from CFBD API`);
  return fbsTeams;
}

// Create or update team in GraphQL
async function createOrUpdateTeam(teamData) {
  try {
    const result = await graphqlRequest(`
      mutation CreateTeam($input: TeamInput!) {
        createTeam(input: $input) {
          id
          name
          odds
          division
        }
      }
    `, { input: teamData });

    return result.createTeam;
  } catch (error) {
    console.error(`❌ Failed to create team ${teamData.name}:`, error.message);
    throw error;
  }
}

// Update existing team in GraphQL
async function updateTeam(id, updateData) {
  try {
    const result = await graphqlRequest(`
      mutation UpdateTeam($input: UpdateTeamInput!) {
        updateTeam(input: $input) {
          id
          name
          odds
          division
        }
      }
    `, { input: { id, ...updateData } });

    return result.updateTeam;
  } catch (error) {
    console.error(`❌ Failed to update team ${id}:`, error.message);
    throw error;
  }
}

// Get existing teams from GraphQL
async function getExistingTeams() {
  const data = await graphqlRequest(`
    query GetTeams {
      getTeams(league: "ncaa", season: "2025") {
        id
        name
        odds
        division
        owner
      }
    }
  `);

  return data.getTeams;
}

// Find matching team using mappings
function findMatchingTeam(oddsTeam, mappings) {
  const { oddsApiNameToMapping } = mappings;
  
  // Direct lookup by Odds API name
  const mapping = oddsApiNameToMapping.get(oddsTeam.name);
  if (mapping) {
    return {
      mapping,
      matchType: 'direct',
      cfbdData: {
        id: mapping.cfbdId,
        name: mapping.cfbdName,
        mascot: mapping.cfbdMascot,
        conference: mapping.cfbdConference,
        abbreviation: mapping.cfbdAbbreviation
      }
    };
  }
  
  return null;
}

// Main function
async function main() {
  try {
    console.log('🏈 Populating NCAA Football 2025 data using TeamMapping table...');
    
    // Fetch team mappings
    const mappings = await fetchTeamMappings();
    
    // Fetch current odds
    const oddsData = await fetchOddsApiData();
    
    // Fetch CFBD data for additional metadata
    const cfbdData = await fetchCfbdData();
    
    // Get existing teams
    const existingTeams = await getExistingTeams();
    const existingTeamMap = new Map();
    existingTeams.forEach(team => {
      existingTeamMap.set(team.name, team);
    });
    
    console.log(`\n📊 Processing ${oddsData.length} teams from The Odds API...`);
    
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const oddsTeam of oddsData) {
      try {
        // Find matching team using mappings
        const match = findMatchingTeam(oddsTeam, mappings);
        
        if (!match) {
          console.log(`⚠️ No mapping found for: ${oddsTeam.name}`);
          skippedCount++;
          continue;
        }
        
        const { mapping, cfbdData: cfbdTeamData } = match;
        
        // Prepare team data
        const teamData = {
          name: mapping.cfbdName, // Use CFBD name for consistency
          record: "0-0",
          league: "ncaa",
          division: mapping.cfbdConference || "FBS",
          wins: 0,
          losses: 0,
          gamesBack: null,
          wildCardGamesBack: null,
          owner: "NA",
          odds: `+${oddsTeam.odds}`
        };
        
        // Check if team already exists
        const existingTeam = existingTeamMap.get(teamData.name);
        
        if (existingTeam) {
          // Update existing team
          console.log(`📝 Updating: ${teamData.name} (${existingTeam.odds} → ${teamData.odds})`);
          await updateTeam(existingTeam.id, {
            odds: teamData.odds,
            division: teamData.division
          });
          updatedCount++;
        } else {
          // Create new team
          console.log(`➕ Creating: ${teamData.name} (${teamData.odds})`);
          await createOrUpdateTeam(teamData);
          createdCount++;
        }
        
        // Add small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error processing ${oddsTeam.name}:`, error.message);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n📊 Population Summary:');
    console.log(`   ✅ Teams created: ${createdCount}`);
    console.log(`   🔄 Teams updated: ${updatedCount}`);
    console.log(`   ⚠️ Teams skipped: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📈 Total processed: ${createdCount + updatedCount + skippedCount}`);
    
    // Verify final count
    const finalTeams = await getExistingTeams();
    console.log(`   🎯 Final team count: ${finalTeams.length}`);
    
    // Show some examples
    if (finalTeams.length > 0) {
      console.log('\n📋 Sample teams in database:');
      finalTeams.slice(0, 10).forEach(team => {
        console.log(`   ${team.name}: ${team.odds} (${team.division})`);
      });
      if (finalTeams.length > 10) {
        console.log(`   ... and ${finalTeams.length - 10} more`);
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

