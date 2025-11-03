#!/usr/bin/env node

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
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }
  return result.data;
}

(async () => {
  try {
    console.log('⚾ Updating MLB teams with null season to 2025...\n');
    
    // Get all teams
    const data = await graphqlRequest(`
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
    
    const allTeams = data.getTeams || [];
    
    // Filter to MLB teams with null season
    const mlbTeams = allTeams.filter(t => 
      t.league && 
      (t.league.toLowerCase().includes('league')) &&
      !t.league.toLowerCase().includes('conference') &&
      (!t.season || t.season === 'null')
    );
    
    console.log(`Found ${mlbTeams.length} MLB teams with null season\n`);
    
    if (mlbTeams.length === 0) {
      console.log('✅ No MLB teams found with null season. All MLB teams already have a season set.');
      return;
    }
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const team of mlbTeams) {
      try {
        await graphqlRequest(`
          mutation UpdateTeam($input: UpdateTeamInput!) {
            updateTeam(input: $input) {
              id
              name
              season
            }
          }
        `, {
          input: {
            id: team.id,
            season: '2025'
          }
        });
        console.log(`✅ Updated ${team.name} (${team.league}, ${team.division}) → season: 2025`);
        updatedCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`❌ Failed to update ${team.name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n✅ MLB team update complete!');
    console.log(`📈 Updated: ${updatedCount} teams to season 2025`);
    console.log(`❌ Errors: ${errorCount} teams`);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
})();

