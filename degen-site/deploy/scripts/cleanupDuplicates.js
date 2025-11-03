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

// Fetch teams from GraphQL
async function fetchExistingTeams() {
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

// Main function to clean up duplicates
async function main() {
  try {
    console.log('🧹 Starting duplicate cleanup...');
    
    const teams = await fetchExistingTeams();
    console.log(`📊 Found ${teams.length} total teams`);
    
    // Group teams by name
    const teamsByName = {};
    teams.forEach(team => {
      if (!teamsByName[team.name]) {
        teamsByName[team.name] = [];
      }
      teamsByName[team.name].push(team);
    });
    
    // Find duplicates
    const duplicates = Object.entries(teamsByName)
      .filter(([name, teamList]) => teamList.length > 1)
      .map(([name, teamList]) => ({ name, teams: teamList }));
    
    console.log(`🔍 Found ${duplicates.length} teams with duplicate entries`);
    
    let deletedCount = 0;
    
    for (const duplicate of duplicates) {
      console.log(`\n📋 Processing duplicates for: ${duplicate.name}`);
      
      // Sort teams: prefer ones with proper conference divisions over "FBS"
      const sortedTeams = duplicate.teams.sort((a, b) => {
        const aIsFBS = a.division === 'FBS';
        const bIsFBS = b.division === 'FBS';
        
        if (aIsFBS && !bIsFBS) return 1; // FBS teams go last
        if (!aIsFBS && bIsFBS) return -1; // Non-FBS teams go first
        return 0; // Keep original order if both same type
      });
      
      // Keep the first team (best one), delete the rest
      const teamsToDelete = sortedTeams.slice(1);
      
      for (const team of teamsToDelete) {
        console.log(`🗑️  Deleting duplicate: ${team.name} (${team.odds}, ${team.division})`);
        try {
          await deleteTeam(team.id);
          deletedCount++;
        } catch (error) {
          console.error(`❌ Failed to delete ${team.name}:`, error.message);
        }
      }
    }
    
    console.log(`\n✅ Duplicate cleanup complete!`);
    console.log(`🗑️  Deleted ${deletedCount} duplicate entries`);
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

