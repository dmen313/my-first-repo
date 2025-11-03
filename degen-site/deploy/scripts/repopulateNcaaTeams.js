#!/usr/bin/env node
require('dotenv').config();

const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
const CFBD_API_KEY = process.env.CFBD_API_KEY;
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;

async function graphqlRequest(query, variables = {}) {
  try {
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

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }
    
    return result.data;
  } catch (error) {
    console.error('GraphQL request failed:', error.message);
    throw error;
  }
}

async function getTeamMappings() {
  const query = `
    query {
      getTeamMappings {
        id
        cfbdId
        cfbdName
        cfbdMascot
        cfbdConference
        cfbdAbbreviation
        oddsApiName
        oddsApiOdds
        league
        season
        matchType
      }
    }
  `;
  
  const result = await graphqlRequest(query);
  return result.getTeamMappings;
}

async function deleteAllNcaaTeams() {
  const query = `
    query {
      getTeams(league: "ncaa", season: "2025") {
        id
        name
      }
    }
  `;
  
  const result = await graphqlRequest(query);
  const teams = result.getTeams;
  
  if (teams.length === 0) {
    console.log('📭 No existing NCAA 2025 teams to delete');
    return 0;
  }
  
  console.log(`🗑️  Deleting ${teams.length} existing NCAA 2025 teams...`);
  
  let deletedCount = 0;
  for (const team of teams) {
    try {
      await deleteTeam(team.id);
      deletedCount++;
      console.log(`   ✅ Deleted team: ${team.name}`);
    } catch (error) {
      console.error(`❌ Error deleting team ${team.name}:`, error.message);
    }
  }
  
  console.log(`✅ Deleted ${deletedCount} NCAA 2025 teams`);
  return deletedCount;
}

async function deleteTeam(id) {
  const mutation = `
    mutation DeleteTeam($id: ID!) {
      deleteTeam(id: $id)
    }
  `;
  
  const result = await graphqlRequest(mutation, { id });
  return result.deleteTeam;
}

async function fetchCFBDTeamData(cfbdId) {
  if (!CFBD_API_KEY) {
    console.warn('⚠️  CFBD_API_KEY not found, skipping CFBD data fetch');
    return null;
  }

  try {
    const response = await fetch(`https://api.collegefootballdata.com/teams?id=${cfbdId}`, {
      headers: {
        'Authorization': `Bearer ${CFBD_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`CFBD API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error(`❌ Error fetching CFBD data for team ${cfbdId}:`, error.message);
    return null;
  }
}

async function fetchCFBDTeamRecord(cfbdId, season = '2025') {
  if (!CFBD_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(`https://api.collegefootballdata.com/records?year=${season}&team=${cfbdId}`, {
      headers: {
        'Authorization': `Bearer ${CFBD_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`CFBD API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data[0] || null;
  } catch (error) {
    console.error(`❌ Error fetching CFBD record for team ${cfbdId}:`, error.message);
    return null;
  }
}

async function fetchOddsData(oddsApiName) {
  if (!ODDS_API_KEY) {
    console.warn('⚠️  ODDS_API_KEY not found, skipping odds data fetch');
    return null;
  }

  try {
    // Try championship winner endpoint first
    const response = await fetch(`https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf_championship_winner/odds?apiKey=${ODDS_API_KEY}&regions=us&oddsFormat=american`);
    
    if (!response.ok) {
      throw new Error(`Odds API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const teamOdds = data.find(team => team.title === oddsApiName);
    
    if (teamOdds) {
      return teamOdds.odds;
    }

    // If not found in championship winner, try regular odds
    const regularResponse = await fetch(`https://api.the-odds-api.com/v4/sports/americanfootball_ncaaf/odds?apiKey=${ODDS_API_KEY}&regions=us&markets=winner&oddsFormat=american`);
    
    if (!regularResponse.ok) {
      return null;
    }

    const regularData = await regularResponse.json();
    const regularTeamOdds = regularData.find(team => team.title === oddsApiName);
    return regularTeamOdds ? regularTeamOdds.odds : null;
    
  } catch (error) {
    console.error(`❌ Error fetching odds data for ${oddsApiName}:`, error.message);
    return null;
  }
}

async function createTeam(teamData) {
  const mutation = `
    mutation CreateTeam($input: TeamInput!) {
      createTeam(input: $input) {
        id
        name
        odds
        record
        division
        league
        wins
        losses
        owner
      }
    }
  `;
  
  const result = await graphqlRequest(mutation, { input: teamData });
  return result.createTeam;
}

async function main() {
  try {
    console.log('🔄 Starting NCAA 2025 teams repopulation...\n');
    
    // First, delete all existing NCAA 2025 teams
    const deletedCount = await deleteAllNcaaTeams();
    console.log('');
    
    // Get all team mappings
    console.log('📋 Fetching team mappings...');
    const mappings = await getTeamMappings();
    
    if (mappings.length === 0) {
      console.log('❌ No team mappings found. Please run the repopulate-mappings script first.');
      return;
    }
    
    console.log(`📊 Found ${mappings.length} team mappings\n`);
    
    let createdCount = 0;
    let errorCount = 0;
    const currentTime = new Date().toISOString();

    for (const mapping of mappings) {
      try {
        console.log(`📝 Processing ${mapping.cfbdName}...`);
        
        // Fetch data from APIs
        const cfbdData = await fetchCFBDTeamData(mapping.cfbdId);
        const cfbdRecord = await fetchCFBDTeamRecord(mapping.cfbdId);
        const oddsData = await fetchOddsData(mapping.oddsApiName);
        
        // Prepare team data
        const record = cfbdRecord ? `${cfbdRecord.total.wins}-${cfbdRecord.total.losses}` : '0-0';
        const odds = oddsData ? oddsData.toString() : '999999';
        const wins = cfbdRecord ? cfbdRecord.total.wins : 0;
        const losses = cfbdRecord ? cfbdRecord.total.losses : 0;
        
        const teamInput = {
          name: mapping.cfbdName,
          odds: odds,
          record: record,
          division: mapping.cfbdConference || 'FBS',
          league: 'ncaa',
          wins: wins,
          losses: losses,
          owner: null
        };

        // Create the team
        const result = await createTeam(teamInput);
        console.log(`   ✅ Created team: ${mapping.cfbdName} (ID: ${result.id})`);
        console.log(`      📊 Record: ${record}, Odds: ${odds}`);
        createdCount++;
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`   ❌ Error creating team ${mapping.cfbdName}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n🎉 NCAA 2025 teams repopulation completed!');
    console.log(`   🗑️  Deleted: ${deletedCount} existing teams`);
    console.log(`   📊 Created: ${createdCount} teams`);
    console.log(`   ❌ Errors: ${errorCount} teams`);
    console.log(`   📈 Total processed: ${mappings.length} mappings`);
    console.log(`   🕐 Last updated: ${currentTime}`);

  } catch (error) {
    console.error('❌ Error during NCAA teams repopulation:', error.message);
    process.exit(1);
  }
}

main();
