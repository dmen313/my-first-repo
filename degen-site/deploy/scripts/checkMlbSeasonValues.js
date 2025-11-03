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
    const allData = await graphqlRequest(`
      query {
        getTeams {
          name
          season
          league
          division
        }
      }
    `);
    
    const allTeams = allData.getTeams || [];
    
    // Find MLB teams (American League or National League)
    const mlbTeams = allTeams.filter(t => 
      t.league && 
      (t.league.toLowerCase().includes('league')) &&
      !t.league.toLowerCase().includes('conference')
    );
    
    console.log(`Total MLB teams: ${mlbTeams.length}\n`);
    
    const bySeason = {};
    mlbTeams.forEach(t => {
      const season = t.season || 'null';
      if (!bySeason[season]) bySeason[season] = [];
      bySeason[season].push(t);
    });
    
    console.log('MLB teams by season:');
    Object.keys(bySeason).sort().forEach(season => {
      console.log(`\nSeason "${season}" (type: ${typeof bySeason[season][0]?.season}): ${bySeason[season].length} teams`);
      bySeason[season].slice(0, 3).forEach(t => {
        console.log(`  - ${t.name} (${t.league})`);
        console.log(`    season value: "${t.season}" (type: ${typeof t.season})`);
      });
    });
    
    // Test exact comparison
    console.log('\n\n🔍 Testing exact season comparisons:');
    const testSeason2024 = '2024';
    const testSeason2025 = '2025';
    
    const mlb2024 = mlbTeams.filter(t => t.season === testSeason2024);
    const mlb2025 = mlbTeams.filter(t => t.season === testSeason2025);
    
    console.log(`Teams with season === "2024": ${mlb2024.length}`);
    console.log(`Teams with season === "2025": ${mlb2025.length}`);
    
    if (mlb2024.length > 0) {
      console.log('\nSample MLB 2024 team details:');
      const sample = mlb2024[0];
      console.log(JSON.stringify(sample, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();

