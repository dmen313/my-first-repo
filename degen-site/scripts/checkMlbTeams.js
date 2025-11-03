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
    // Get all teams and filter for MLB
    const data = await graphqlRequest(`
      query {
        getTeams {
          name
          season
          league
          division
        }
      }
    `);
    
    const allTeams = data.getTeams || [];
    // Filter to MLB teams (American League or National League)
    const mlbTeams = allTeams.filter(t => 
      (t.league && t.league.toLowerCase().includes('league')) &&
      !t.league.toLowerCase().includes('conference')
    );
    
    console.log(`Total MLB teams: ${mlbTeams.length}\n`);
    
    const bySeason = {};
    mlbTeams.forEach(t => {
      const season = t.season || 'null';
      if (!bySeason[season]) bySeason[season] = [];
      bySeason[season].push({ name: t.name, league: t.league, division: t.division });
    });
    
    Object.keys(bySeason).forEach(season => {
      console.log(`Season ${season}: ${bySeason[season].length} teams`);
      if (bySeason[season].length <= 10) {
        bySeason[season].forEach(t => console.log(`  - ${t.name} (${t.league}, ${t.division})`));
      } else {
        bySeason[season].slice(0, 5).forEach(t => console.log(`  - ${t.name} (${t.league}, ${t.division})`));
        console.log(`  ... and ${bySeason[season].length - 5} more`);
      }
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
})();

