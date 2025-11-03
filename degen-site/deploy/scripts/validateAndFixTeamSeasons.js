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

async function main() {
  try {
    console.log('🔍 Validating team seasons...\n');
    
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
    console.log(`Total teams in database: ${allTeams.length}\n`);
    
    // Categorize teams by season
    const bySeason = {};
    const nullSeasonTeams = [];
    
    allTeams.forEach(team => {
      const season = team.season || 'null';
      if (!bySeason[season]) {
        bySeason[season] = [];
      }
      bySeason[season].push(team);
      
      if (!team.season || team.season === 'null') {
        nullSeasonTeams.push(team);
      }
    });
    
    console.log('📊 Current season distribution:');
    Object.keys(bySeason).sort().forEach(season => {
      const count = bySeason[season].length;
      console.log(`  ${season}: ${count} teams`);
    });
    console.log('');
    
    // Report teams with null season
    if (nullSeasonTeams.length > 0) {
      console.log(`⚠️  Found ${nullSeasonTeams.length} teams with null/missing season:`);
      nullSeasonTeams.slice(0, 10).forEach(team => {
        console.log(`  - ${team.name} (${team.league || 'N/A'}, ${team.division || 'N/A'})`);
      });
      if (nullSeasonTeams.length > 10) {
        console.log(`  ... and ${nullSeasonTeams.length - 10} more`);
      }
      console.log('');
      
      // Update null season teams to 2025
      console.log('🔄 Updating null season teams to 2025...\n');
      
      let updatedCount = 0;
      let errorCount = 0;
      
      for (const team of nullSeasonTeams) {
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
          console.log(`✅ Updated ${team.name} → season: 2025`);
          updatedCount++;
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`❌ Failed to update ${team.name}:`, error.message);
          errorCount++;
        }
      }
      
      console.log(`\n✅ Updated ${updatedCount} teams to season 2025`);
      if (errorCount > 0) {
        console.log(`❌ ${errorCount} teams had errors`);
      }
      console.log('');
    } else {
      console.log('✅ All teams already have a season set!\n');
    }
    
    // Final validation - verify all teams have 2024 or 2025
    console.log('🔍 Final validation...\n');
    
    const finalData = await graphqlRequest(`
      query {
        getTeams {
          id
          name
          season
          league
        }
      }
    `);
    
    const finalTeams = finalData.getTeams || [];
    const invalidSeasons = finalTeams.filter(t => 
      !t.season || 
      t.season === 'null' || 
      (t.season !== '2024' && t.season !== '2025')
    );
    
    if (invalidSeasons.length > 0) {
      console.log(`⚠️  Warning: ${invalidSeasons.length} teams still have invalid seasons:`);
      invalidSeasons.slice(0, 10).forEach(team => {
        console.log(`  - ${team.name} (${team.league || 'N/A'}): season="${team.season || 'null'}"`);
      });
      if (invalidSeasons.length > 10) {
        console.log(`  ... and ${invalidSeasons.length - 10} more`);
      }
    } else {
      console.log('✅ All teams have valid seasons (2024 or 2025)!');
    }
    
    // Final summary by season
    const finalBySeason = {};
    finalTeams.forEach(team => {
      const season = team.season || 'null';
      finalBySeason[season] = (finalBySeason[season] || 0) + 1;
    });
    
    console.log('\n📊 Final season distribution:');
    Object.keys(finalBySeason).sort().forEach(season => {
      console.log(`  ${season}: ${finalBySeason[season]} teams`);
    });
    
    // Group by league and season
    console.log('\n📋 Breakdown by League and Season:');
    const byLeagueSeason = {};
    finalTeams.forEach(team => {
      const league = team.league || 'Unknown';
      const season = team.season || 'null';
      const key = `${league} - ${season}`;
      byLeagueSeason[key] = (byLeagueSeason[key] || 0) + 1;
    });
    
    Object.keys(byLeagueSeason).sort().forEach(key => {
      console.log(`  ${key}: ${byLeagueSeason[key]} teams`);
    });
    
    console.log('\n✅ Validation complete!');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

main();

