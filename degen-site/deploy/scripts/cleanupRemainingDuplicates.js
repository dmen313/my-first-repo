require('dotenv').config();

// GraphQL client for Node.js
async function graphqlRequest(query, variables = {}) {
  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

// Delete team
async function deleteTeam(id) {
  const result = await graphqlRequest(`
    mutation DeleteTeam($id: ID!) {
      deleteTeam(id: $id)
    }
  `, { id });

  return result.deleteTeam;
}

// Main function
async function main() {
  try {
    console.log('🏈 Cleaning up remaining duplicate entries...');
    
    // Get all NCAA teams from database
    const data = await graphqlRequest(`
      query GetNcaaTeams {
        getTeams(league: "ncaa", season: "2025") {
          id
          name
          odds
          division
        }
      }
    `);

    const teams = data.getTeams;
    console.log(`✅ Found ${teams.length} teams in database`);
    
    // Define duplicate groups to clean up
    const duplicateGroups = [
      {
        name: 'Georgia',
        teams: ['Georgia', 'Georgia Bulldogs'],
        keep: 'Georgia Bulldogs' // Keep the more specific name
      },
      {
        name: 'Texas',
        teams: ['Texas', 'Texas Longhorns'],
        keep: 'Texas Longhorns' // Keep the more specific name
      },
      {
        name: 'Ohio State',
        teams: ['Ohio State', 'Ohio State Buckeyes'],
        keep: 'Ohio State Buckeyes' // Keep the more specific name
      }
    ];
    
    let totalDeleted = 0;
    
    for (const group of duplicateGroups) {
      console.log(`\n📋 Processing ${group.name} duplicates...`);
      
      const matchingTeams = teams.filter(team => 
        group.teams.includes(team.name)
      );
      
      if (matchingTeams.length > 1) {
        console.log(`   Found ${matchingTeams.length} entries:`);
        matchingTeams.forEach(team => {
          console.log(`   - ${team.name}: ${team.odds} (${team.division})`);
        });
        
        // Find the team to keep
        const teamToKeep = matchingTeams.find(team => team.name === group.keep);
        const teamsToDelete = matchingTeams.filter(team => team.name !== group.keep);
        
        if (teamToKeep) {
          console.log(`   ✅ Keeping: ${teamToKeep.name} (${teamToKeep.odds})`);
          
          // Delete the other duplicates
          for (const team of teamsToDelete) {
            console.log(`   🗑️ Deleting: ${team.name} (${team.odds})`);
            await deleteTeam(team.id);
            totalDeleted++;
          }
        } else {
          console.log(`   ⚠️ Could not find team to keep: ${group.keep}`);
        }
      } else {
        console.log(`   ✅ No duplicates found for ${group.name}`);
      }
    }
    
    // Verify the cleanup
    console.log('\n🔍 Verifying cleanup...');
    const verifyData = await graphqlRequest(`
      query GetNcaaTeams {
        getTeams(league: "ncaa", season: "2025") {
          id
          name
          odds
          division
        }
      }
    `);

    const remainingTeams = verifyData.getTeams;
    
    console.log('\n📊 Final Results:');
    console.log(`   Teams deleted: ${totalDeleted}`);
    console.log(`   Remaining teams: ${remainingTeams.length}`);
    
    // Check for any remaining duplicates
    const remainingDuplicates = [];
    for (const group of duplicateGroups) {
      const matchingTeams = remainingTeams.filter(team => 
        group.teams.includes(team.name)
      );
      
      if (matchingTeams.length > 1) {
        remainingDuplicates.push({
          group: group.name,
          teams: matchingTeams.map(t => t.name)
        });
      }
    }
    
    if (remainingDuplicates.length > 0) {
      console.log('\n⚠️ Remaining duplicates:');
      remainingDuplicates.forEach(dup => {
        console.log(`   ${dup.group}: ${dup.teams.join(', ')}`);
      });
    } else {
      console.log('\n✅ All duplicates cleaned up successfully!');
    }
    
    // Show final team list
    console.log('\n📋 Final team list:');
    remainingTeams
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(team => {
        console.log(`   ${team.name}: ${team.odds} (${team.division})`);
      });
    
    console.log(`\n🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

