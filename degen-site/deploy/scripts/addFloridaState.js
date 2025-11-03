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

// Create team in GraphQL
async function createTeam(teamData) {
  const result = await graphqlRequest(`
    mutation CreateTeam($input: TeamInput!) {
      createTeam(input: $input) {
        id
        name
        odds
        division
        league
        owner
      }
    }
  `, { input: teamData });

  return result.createTeam;
}

// Main function to add Florida State
async function main() {
  try {
    console.log('🏈 Adding Florida State to NCAA Football 2025...');
    
    // Florida State data
    const floridaStateData = {
      name: "Florida State Seminoles",
      record: "0-0",
      league: "ncaa",
      division: "ACC",
      wins: 0,
      losses: 0,
      gamesBack: "0",
      wildCardGamesBack: "0",
      owner: "NA",
      odds: "+70000" // Reasonable odds for a major team
    };
    
    console.log(`📝 Creating team: ${floridaStateData.name}`);
    console.log(`📊 Division: ${floridaStateData.division}`);
    console.log(`💰 Odds: ${floridaStateData.odds}`);
    
    const result = await createTeam(floridaStateData);
    
    console.log(`✅ Successfully created Florida State Seminoles!`);
    console.log(`🆔 Team ID: ${result.id}`);
    console.log(`📊 Division: ${result.division}`);
    console.log(`💰 Odds: ${result.odds}`);
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

