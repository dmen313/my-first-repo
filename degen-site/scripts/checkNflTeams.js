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
        getTeams(league: "nfl") {
          name
          season
          league
        }
      }
    `);
    
    const teams = data.getTeams || [];
    console.log(`Total NFL teams: ${teams.length}\n`);
    
    const bySeason = {};
    teams.forEach(t => {
      const season = t.season || 'null';
      if (!bySeason[season]) bySeason[season] = [];
      bySeason[season].push(t.name);
    });
    
    Object.keys(bySeason).forEach(season => {
      console.log(`Season ${season}: ${bySeason[season].length} teams`);
      if (bySeason[season].length <= 10) {
        bySeason[season].forEach(name => console.log(`  - ${name}`));
      } else {
        bySeason[season].slice(0, 5).forEach(name => console.log(`  - ${name}`));
        console.log(`  ... and ${bySeason[season].length - 5} more`);
      }
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
})();

