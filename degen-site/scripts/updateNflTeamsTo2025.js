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
    console.log('🏈 Updating NFL teams to season 2025...\n');
    
    // First, get all teams to find NFL teams
    // NFL teams have league = "AFC" or "NFC"
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
    console.log(`Total teams in database: ${allTeams.length}\n`);
    
    // Filter to NFL teams (AFC or NFC)
    const nflTeams = allTeams.filter(t => 
      t.league === 'AFC' || t.league === 'NFC'
    );
    
    console.log(`Found ${nflTeams.length} NFL teams (AFC/NFC)\n`);
    
    // Group by season
    const bySeason = {};
    nflTeams.forEach(t => {
      const season = t.season || 'null';
      if (!bySeason[season]) bySeason[season] = [];
      bySeason[season].push(t);
    });
    
    console.log('NFL teams by season:');
    Object.keys(bySeason).forEach(season => {
      console.log(`  ${season}: ${bySeason[season].length} teams`);
    });
    console.log('');
    
    // Update all NFL teams to season 2025
    let updatedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (const team of nflTeams) {
      // Skip if already 2025
      if (team.season === '2025') {
        skippedCount++;
        continue;
      }
      
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
    
    console.log('\n✅ NFL team update complete!');
    console.log(`📈 Updated: ${updatedCount} teams`);
    console.log(`⏭️  Skipped (already 2025): ${skippedCount} teams`);
    console.log(`❌ Errors: ${errorCount} teams`);
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
})();

