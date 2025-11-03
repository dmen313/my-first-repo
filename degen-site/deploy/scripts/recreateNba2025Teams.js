#!/usr/bin/env node

// Script to delete incorrectly created NBA 2025 teams and recreate them properly
require('dotenv').config();

const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;

// GraphQL helper function
async function graphqlRequest(query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
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
    const text = await response.text();
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText} - ${text}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

// Fetch NBA 2024 teams (these are the source of truth)
async function fetchNba2024Teams() {
  const data = await graphqlRequest(`
    query GetNba2024Teams {
      getTeams(league: "nba", season: "2024") {
        id
        name
        record
        league
        division
        wins
        losses
        gamesBack
        wildCardGamesBack
        owner
        odds
      }
    }
  `);

  return data.getTeams || [];
}

// Fetch NBA 2025 teams (these might need to be deleted and recreated)
async function fetchNba2025Teams() {
  const data = await graphqlRequest(`
    query GetNba2025Teams {
      getTeams(league: "nba", season: "2025") {
        id
        name
        league
        division
      }
    }
  `);

  return data.getTeams || [];
}

// Delete a team
async function deleteTeam(teamId) {
  const data = await graphqlRequest(`
    mutation DeleteTeam($id: ID!) {
      deleteTeam(id: $id)
    }
  `, { id: teamId });
  
  return data.deleteTeam;
}

// Create NBA 2025 team with explicit season
async function createNba2025Team(team2024) {
  const teamData = {
    name: team2024.name,
    record: '0-0',
    league: team2024.league,
    division: team2024.division,
    wins: 0,
    losses: 0,
    gamesBack: '0',
    wildCardGamesBack: '0',
    owner: team2024.owner || 'NA',
    odds: team2024.odds || '+5000',
    season: '2025' // Explicitly set season
  };

  const result = await graphqlRequest(`
      mutation CreateTeam($input: TeamInput!) {
        createTeam(input: $input) {
          id
          name
          league
          division
          odds
        }
      }
  `, { input: teamData });

  return result.createTeam;
}

// Main function
async function main() {
  try {
    console.log('🏀 Fixing NBA 2025 teams...\n');

    // Step 1: Get NBA 2024 teams (source of truth)
    console.log('📊 Fetching NBA 2024 teams...');
    const nba2024Teams = await fetchNba2024Teams();
    console.log(`✅ Found ${nba2024Teams.length} NBA 2024 teams\n`);

    // Step 2: Get existing NBA 2025 teams
    console.log('📊 Checking existing NBA 2025 teams...');
    const nba2025Teams = await fetchNba2025Teams();
    console.log(`Found ${nba2025Teams.length} existing NBA 2025 teams\n`);

    // Step 3: Delete existing NBA 2025 teams (they were created without explicit season)
    if (nba2025Teams.length > 0) {
      console.log('🗑️  Deleting incorrectly created NBA 2025 teams...');
      for (const team of nba2025Teams) {
        try {
          await deleteTeam(team.id);
          console.log(`  ✓ Deleted ${team.name}`);
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`  ✗ Failed to delete ${team.name}:`, error.message);
        }
      }
      console.log('');
    }

    // Step 4: Recreate NBA 2025 teams with explicit season
    console.log('✨ Creating NBA 2025 teams with explicit season...\n');
    
    let createdCount = 0;
    let errorCount = 0;

    for (const team of nba2024Teams) {
      try {
        await createNba2025Team(team);
        console.log(`✅ Created ${team.name} (${team.league}, ${team.division}) - season: 2025`);
        createdCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`❌ Failed to create ${team.name}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n✅ NBA 2025 team recreation complete!');
    console.log(`📈 Created: ${createdCount} teams`);
    console.log(`❌ Errors: ${errorCount} teams`);
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();

