const { ApolloClient, InMemoryCache, gql } = require('@apollo/client/core');
require('dotenv').config();

// GraphQL client setup
const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cache: new InMemoryCache(),
});

// GraphQL queries and mutations
const GET_NFL_TEAMS = gql`
  query GetNFLTeams {
    getTeams(league: "nfl", season: "2025") {
      id
      name
      owner
    }
  }
`;

const UPDATE_TEAM_OWNER = gql`
  mutation UpdateTeamOwner($id: ID!, $owner: String!) {
    updateTeam(id: $id, owner: $owner) {
      id
      name
      owner
    }
  }
`;

async function getNflTeamsFromGraphQL() {
  try {
    const { data } = await client.query({
      query: GET_NFL_TEAMS,
    });
    return data.getTeams || [];
  } catch (error) {
    console.error('❌ Error fetching NFL teams:', error.message);
    return [];
  }
}

async function updateTeamOwner(teamId, owner) {
  try {
    const { data } = await client.mutate({
      mutation: UPDATE_TEAM_OWNER,
      variables: { id: teamId, owner },
    });
    return data.updateTeam;
  } catch (error) {
    console.error(`❌ Error updating team ${teamId}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🏈 Starting NFL Team Owner Update...');
  
  try {
    // Step 1: Fetch current NFL teams from GraphQL
    console.log('📊 Fetching NFL teams from GraphQL...');
    const teams = await getNflTeamsFromGraphQL();
    
    if (teams.length === 0) {
      console.log('⚠️ No NFL teams found in GraphQL database');
      return;
    }
    
    console.log(`Found ${teams.length} NFL teams`);
    
    // Step 2: Update all teams to NA owner
    console.log('🔄 Updating team owners to NA...');
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const team of teams) {
      try {
        if (team.owner !== 'NA') {
          await updateTeamOwner(team.id, 'NA');
          console.log(`✅ Updated ${team.name}: ${team.owner} → NA`);
          updatedCount++;
        } else {
          console.log(`➡️ No change for ${team.name}: already NA`);
        }
      } catch (error) {
        console.error(`❌ Failed to update ${team.name}:`, error.message);
        errorCount++;
      }
    }
    
    // Step 3: Summary
    console.log('\n📊 Update Summary:');
    console.log(`✅ Successfully updated: ${updatedCount} teams`);
    console.log(`➡️ No changes needed: ${teams.length - updatedCount - errorCount} teams`);
    console.log(`❌ Errors: ${errorCount} teams`);
    console.log(`🕒 Update completed at: ${new Date().toLocaleString()}`);
    
    if (updatedCount > 0) {
      console.log('\n🎉 NFL team owners have been updated successfully!');
    } else {
      console.log('\n📋 All teams already have NA owner - no changes made.');
    }
    
  } catch (error) {
    console.error('❌ Error in main execution:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);






