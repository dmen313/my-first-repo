require('dotenv').config();

const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

async function graphqlRequest(query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const result = await response.json();
  return result.data;
}

(async () => {
  try {
    console.log('🔍 Debugging MLB 2024 query...\n');
    
    // Get all teams with season 2024
    const allData = await graphqlRequest(`
      query {
        getTeams {
          id
          name
          season
          league
          division
        }
      }
    `);
    
    const allTeams = allData.getTeams || [];
    console.log(`Total teams: ${allTeams.length}\n`);
    
    // Filter to MLB 2024 teams manually
    const mlb2024Teams = allTeams.filter(t => 
      t.season === '2024' &&
      t.league &&
      (t.league.toLowerCase().includes('league')) &&
      !t.league.toLowerCase().includes('conference')
    );
    
    console.log(`MLB 2024 teams found (manual filter): ${mlb2024Teams.length}\n`);
    
    if (mlb2024Teams.length > 0) {
      console.log('Sample MLB 2024 teams:');
      mlb2024Teams.slice(0, 5).forEach(t => {
        console.log(`  - ${t.name}`);
        console.log(`    League: "${t.league}"`);
        console.log(`    Season: "${t.season}"`);
        console.log(`    Division: "${t.division}"`);
        console.log('');
      });
    }
    
    // Now test the actual GraphQL query
    console.log('\n📡 Testing GraphQL query with league="mlb", season="2024"...');
    const queryData = await graphqlRequest(`
      query {
        getTeams(league: "mlb", season: "2024") {
          name
          league
          season
        }
      }
    `);
    
    console.log(`Teams returned by query: ${queryData.getTeams.length}`);
    if (queryData.getTeams.length === 0) {
      console.log('\n❌ Query returned 0 teams!');
      console.log('This suggests the filtering logic in getTeamsByLeague is not matching correctly.');
    } else {
      console.log('\n✅ Query returned teams:');
      queryData.getTeams.slice(0, 5).forEach(t => {
        console.log(`  - ${t.name} (${t.league}, ${t.season})`);
      });
    }
    
    // Check if case sensitivity is the issue
    console.log('\n🔍 Checking league values:');
    const uniqueLeagues = [...new Set(mlb2024Teams.map(t => t.league))];
    uniqueLeagues.forEach(league => {
      console.log(`  "${league}"`);
      console.log(`    .toLowerCase(): "${league.toLowerCase()}"`);
      console.log(`    .includes('league'): ${league.toLowerCase().includes('league')}`);
      console.log(`    .includes('conference'): ${league.toLowerCase().includes('conference')}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();

