require('dotenv').config();

const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

async function graphqlRequest(query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const result = await response.json();
  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
  }
  return result.data;
}

(async () => {
  try {
    // Get all teams and manually test the filter logic
    const allData = await graphqlRequest(`
      query {
        getTeams {
          id
          name
          season
          league
        }
      }
    `);
    
    const allTeams = allData.getTeams || [];
    
    // Test the exact filter logic from dataStore.js
    const league = 'mlb';
    const season = '2024';
    
    console.log(`Testing filter: league="${league}", season="${season}"\n`);
    
    const filtered = allTeams.filter(team => {
      if (league && season) {
        // First check if team season matches the requested season
        const seasonMatches = team.season === season;
        
        console.log(`Team: ${team.name}`);
        console.log(`  team.season = "${team.season}" (type: ${typeof team.season})`);
        console.log(`  season = "${season}" (type: ${typeof season})`);
        console.log(`  seasonMatches = ${seasonMatches}`);
        console.log(`  team.league = "${team.league}"`);
        
        // MLB teams have league like "American League" or "National League"  
        if (league.toLowerCase() === 'mlb' && (season === '2024' || season === '2025')) {
          const leagueCheck = team.league && team.league.toLowerCase().includes('league') && !team.league.toLowerCase().includes('conference');
          console.log(`  leagueCheck = ${leagueCheck}`);
          const result = seasonMatches && leagueCheck;
          console.log(`  Final result = ${result}\n`);
          return result;
        }
        return false;
      }
      return true;
    });
    
    console.log(`\n✅ Filtered teams: ${filtered.length}`);
    if (filtered.length > 0) {
      console.log('Sample:');
      filtered.slice(0, 3).forEach(t => {
        console.log(`  - ${t.name} (${t.league}, season: ${t.season})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
})();

