import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const NFL_API_BASE = 'https://nfl-api-data.p.rapidapi.com';
const NFL_API_KEY = process.env.REACT_APP_NFL_API_KEY;
const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function analyzeTeamNames() {
  console.log('🔍 Analyzing NFL team name differences...\n');
  
  try {
    // Get database team names
    console.log('📋 Fetching team names from database...');
    const dbResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ getTeams(league: "nfl", season: "2025") { name } }'
      })
    });
    
    const dbData = await dbResponse.json();
    const dbTeamNames = dbData.data.getTeams.map(t => t.name).sort();
    console.log(`✅ Found ${dbTeamNames.length} teams in database`);
    
    // Get API team names
    console.log('📡 Fetching team names from NFL API...');
    const apiResponse = await fetch(`${NFL_API_BASE}/nfl-team-listing/v1/data`, {
      headers: {
        'x-rapidapi-host': 'nfl-api-data.p.rapidapi.com',
        'x-rapidapi-key': NFL_API_KEY
      }
    });
    
    const apiData = await apiResponse.json();
    const apiTeamNames = apiData.map(item => item.team.displayName).sort();
    console.log(`✅ Found ${apiTeamNames.length} teams from API`);
    
    // Compare and create mapping
    console.log('\n📊 Team Name Comparison:');
    console.log('=' .repeat(80));
    console.log('DATABASE NAME'.padEnd(35) + ' | ' + 'API NAME');
    console.log('=' .repeat(80));
    
    const mapping = {};
    
    dbTeamNames.forEach(dbName => {
      // Try exact match first
      let apiMatch = apiTeamNames.find(apiName => apiName === dbName);
      
      if (!apiMatch) {
        // Try partial matches
        apiMatch = apiTeamNames.find(apiName => 
          apiName.toLowerCase().includes(dbName.toLowerCase()) ||
          dbName.toLowerCase().includes(apiName.toLowerCase()) ||
          // Check if the city/team name parts match
          dbName.split(' ').some(dbPart => 
            apiName.split(' ').some(apiPart => 
              dbPart.toLowerCase() === apiPart.toLowerCase() && dbPart.length > 3
            )
          )
        );
      }
      
      if (apiMatch) {
        mapping[dbName] = apiMatch;
        const status = dbName === apiMatch ? '✅ EXACT' : '🔄 MAPPED';
        console.log(`${dbName.padEnd(35)} | ${apiMatch} ${status}`);
      } else {
        console.log(`${dbName.padEnd(35)} | ❌ NO MATCH FOUND`);
      }
    });
    
    console.log('=' .repeat(80));
    console.log(`\n📈 Mapping Results:`);
    console.log(`✅ Successfully mapped: ${Object.keys(mapping).length}/${dbTeamNames.length} teams`);
    console.log(`❌ Failed to map: ${dbTeamNames.length - Object.keys(mapping).length} teams`);
    
    // Show unmapped teams
    const unmappedDb = dbTeamNames.filter(name => !mapping[name]);
    const unmappedApi = apiTeamNames.filter(name => !Object.values(mapping).includes(name));
    
    if (unmappedDb.length > 0) {
      console.log(`\n❌ Unmapped Database Teams:`);
      unmappedDb.forEach(name => console.log(`  - ${name}`));
    }
    
    if (unmappedApi.length > 0) {
      console.log(`\n🆕 Unmapped API Teams:`);
      unmappedApi.forEach(name => console.log(`  - ${name}`));
    }
    
    // Generate mapping object for code
    console.log('\n🔧 Generated Mapping Object:');
    console.log('const NFL_TEAM_NAME_MAPPING = {');
    Object.entries(mapping).forEach(([dbName, apiName]) => {
      if (dbName !== apiName) {
        console.log(`  "${dbName}": "${apiName}",`);
      }
    });
    console.log('};');
    
    return { dbTeamNames, apiTeamNames, mapping };
    
  } catch (error) {
    console.error('❌ Error analyzing team names:', error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeTeamNames()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}

export { analyzeTeamNames };
