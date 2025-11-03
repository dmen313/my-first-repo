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

// Fetch Ohio State team
async function fetchOhioState() {
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

  const teams = data.getTeams || [];
  return teams.find(team => team.name.includes('Ohio State'));
}

// Update team in GraphQL
async function updateTeam(teamId, updateData) {
  const result = await graphqlRequest(`
    mutation UpdateTeam($input: UpdateTeamInput!) {
      updateTeam(input: $input) {
        id
        name
        division
      }
    }
  `, { input: { id: teamId, division: updateData.division } });

  return result.updateTeam;
}

// Main function to fix Ohio State
async function main() {
  try {
    console.log('🏈 Fixing Ohio State conference assignment...');
    
    // Fetch Ohio State team
    console.log('📊 Fetching Ohio State team...');
    const ohioState = await fetchOhioState();
    
    if (!ohioState) {
      console.error('❌ Ohio State team not found');
      process.exit(1);
    }
    
    console.log(`📝 Found: ${ohioState.name}`);
    console.log(`📊 Current division: ${ohioState.division}`);
    
    if (ohioState.division === 'Big Ten') {
      console.log('✅ Ohio State already has correct Big Ten assignment');
      return;
    }
    
    // Update to Big Ten
    console.log('🔄 Updating Ohio State to Big Ten...');
    const result = await updateTeam(ohioState.id, {
      division: 'Big Ten'
    });
    
    console.log(`✅ Successfully updated Ohio State to Big Ten!`);
    console.log(`🆔 Team ID: ${result.id}`);
    console.log(`📊 New division: ${result.division}`);
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

