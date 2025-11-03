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

// Fetch all NCAA teams
async function fetchNcaaTeams() {
  const data = await graphqlRequest(`
    query GetTeams($league: String!, $season: String!) {
      getTeams(league: $league, season: $season) {
        id
        name
        odds
        division
        owner
      }
    }
  `, { league: 'ncaa', season: '2025' });

  return data.getTeams || [];
}

// Delete team from GraphQL
async function deleteTeam(teamId) {
  const result = await graphqlRequest(`
    mutation DeleteTeam($id: ID!) {
      deleteTeam(id: $id)
    }
  `, { id: teamId });

  return result.deleteTeam;
}

// Main function to clear all NCAA data
async function main() {
  try {
    console.log('🗑️  Starting NCAA Football 2025 data clearance...');
    
    const teams = await fetchNcaaTeams();
    console.log(`📊 Found ${teams.length} NCAA teams to delete`);
    
    if (teams.length === 0) {
      console.log('✅ No NCAA teams found to delete');
      return;
    }
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const team of teams) {
      try {
        console.log(`🗑️  Deleting: ${team.name} (${team.odds}, ${team.division})`);
        await deleteTeam(team.id);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Failed to delete ${team.name}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\n✅ NCAA data clearance complete!`);
    console.log(`🗑️  Successfully deleted: ${deletedCount} teams`);
    console.log(`❌ Errors: ${errorCount} teams`);
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

