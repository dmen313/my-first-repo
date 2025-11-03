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
    console.log('🏈 Fixing Alabama odds...');
    
    // Get current Alabama entries
    const data = await graphqlRequest(`
      query GetAlabamaTeams {
        getTeams(league: "ncaa", season: "2025") {
          id
          name
          odds
          division
        }
      }
    `);

    const alabamaTeams = data.getTeams.filter(team => 
      team.name.includes('Alabama') && !team.name.includes('South Alabama')
    );

    console.log('📊 Found Alabama teams:');
    alabamaTeams.forEach(team => {
      console.log(`   ${team.name}: ${team.odds} (${team.division})`);
    });

    if (alabamaTeams.length !== 2) {
      console.log('⚠️ Expected 2 Alabama teams, found:', alabamaTeams.length);
      return;
    }

    // Find the incorrect entry (should be "Alabama" with +500 odds)
    const incorrectEntry = alabamaTeams.find(team => 
      team.name === 'Alabama' && team.odds === '+500'
    );

    if (!incorrectEntry) {
      console.log('❌ Could not find incorrect Alabama entry to delete');
      return;
    }

    console.log(`🗑️ Deleting incorrect entry: ${incorrectEntry.name} (${incorrectEntry.odds})`);
    
    // Delete the incorrect entry
    await deleteTeam(incorrectEntry.id);
    
    console.log('✅ Successfully deleted incorrect Alabama entry');
    
    // Verify the fix
    const verifyData = await graphqlRequest(`
      query GetAlabamaTeams {
        getTeams(league: "ncaa", season: "2025") {
          id
          name
          odds
          division
        }
      }
    `);

    const remainingAlabamaTeams = verifyData.getTeams.filter(team => 
      team.name.includes('Alabama') && !team.name.includes('South Alabama')
    );

    console.log('\n📊 Remaining Alabama teams:');
    remainingAlabamaTeams.forEach(team => {
      console.log(`   ${team.name}: ${team.odds} (${team.division})`);
    });

    if (remainingAlabamaTeams.length === 1 && 
        remainingAlabamaTeams[0].name === 'Alabama Crimson Tide' && 
        remainingAlabamaTeams[0].odds === '+1000') {
      console.log('✅ Alabama odds validation successful!');
      console.log('✅ Correct entry: Alabama Crimson Tide (+1000)');
    } else {
      console.log('❌ Alabama odds validation failed!');
    }
    
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

