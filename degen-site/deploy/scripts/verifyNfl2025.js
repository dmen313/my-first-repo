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
    const data = await graphqlRequest(`
      query {
        getTeams(league: "nfl", season: "2025") {
          name
          league
          division
          season
        }
      }
    `);
    
    const nflTeams = data.getTeams || [];
    console.log(`✅ NFL 2025 teams found: ${nflTeams.length}`);
    
    if (nflTeams.length > 0) {
      console.log('\nSample teams:');
      nflTeams.slice(0, 5).forEach(t => {
        console.log(`  - ${t.name} (${t.league}, ${t.division}) - season: ${t.season}`);
      });
    }
    
    // Check for any NFL teams without season 2025
    const allData = await graphqlRequest(`
      query {
        getTeams {
          id
          name
          league
          season
        }
      }
    `);
    
    const allNflTeams = (allData.getTeams || []).filter(t => 
      t.league === 'AFC' || t.league === 'NFC'
    );
    
    const not2025 = allNflTeams.filter(t => t.season !== '2025');
    if (not2025.length > 0) {
      console.log(`\n⚠️  Found ${not2025.length} NFL teams not set to 2025:`);
      not2025.slice(0, 5).forEach(t => {
        console.log(`  - ${t.name} (season: ${t.season || 'null'})`);
      });
    } else {
      console.log('\n✅ All NFL teams are set to season 2025!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();

