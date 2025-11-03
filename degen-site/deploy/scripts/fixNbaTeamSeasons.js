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
    console.log('🔍 Checking NBA teams...\n');
    
    // Get all NBA teams (without season filter to get all)
    const data = await graphqlRequest(`
      query {
        getTeams(league: "nba") {
          id
          name
          season
          league
        }
      }
    `);
    
    const teams = data.getTeams || [];
    console.log(`Found ${teams.length} total NBA teams\n`);
    
    // Filter to teams that have league containing "Conference" (actual NBA teams)
    // and have null/missing season
    const nbaTeamsWithNullSeason = teams.filter(t => 
      (!t.season || t.season === 'null') && 
      (t.league && (t.league.includes('Conference') || t.league === 'Eastern Conference' || t.league === 'Western Conference'))
    );
    
    console.log(`NBA teams (with Conference in league) with null season: ${nbaTeamsWithNullSeason.length}`);
    
    if (nbaTeamsWithNullSeason.length > 0) {
      console.log('\n📝 Updating null season teams to 2024...\n');
      
      let updatedCount = 0;
      let errorCount = 0;
      
      for (const team of nbaTeamsWithNullSeason) {
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
              season: '2024'
            }
          });
          console.log(`✅ Updated ${team.name} → season: 2024`);
          updatedCount++;
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`❌ Failed to update ${team.name}:`, error.message);
          errorCount++;
        }
      }
      
      console.log(`\n✅ Update complete!`);
      console.log(`📈 Updated: ${updatedCount} teams`);
      console.log(`❌ Errors: ${errorCount} teams`);
    } else {
      console.log('✅ No NBA teams found with null season that need updating.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
})();
