#!/usr/bin/env node

// Script to fix NBA 2025 teams - delete incorrectly created ones and recreate with proper season
require('dotenv').config();

const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

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
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

// Get all NBA teams to check their seasons
async function getAllNbaTeams() {
  const data = await graphqlRequest(`
    query GetAllTeams {
      getTeams(league: "nba") {
        id
        name
        league
        division
        season
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

// Main function
async function main() {
  try {
    console.log('🔍 Checking NBA teams...\n');
    
    // Get all NBA teams
    const allTeams = await getAllNbaTeams();
    console.log(`Found ${allTeams.length} total NBA teams\n`);
    
    // Group by season
    const teamsBySeason = {};
    allTeams.forEach(team => {
      const season = team.season || 'unknown';
      if (!teamsBySeason[season]) {
        teamsBySeason[season] = [];
      }
      teamsBySeason[season].push(team);
    });
    
    console.log('Teams by season:');
    Object.keys(teamsBySeason).forEach(season => {
      console.log(`  ${season}: ${teamsBySeason[season].length} teams`);
    });
    console.log('');
    
    // Find teams that might need fixing
    // If there are teams with season '2025' that were just created, we might need to delete them
    // But first, let's see what we have
    if (teamsBySeason['2025'] && teamsBySeason['2025'].length > 0) {
      console.log('⚠️  Found NBA teams with season 2025:');
      teamsBySeason['2025'].forEach(team => {
        console.log(`  - ${team.name} (${team.league}, ${team.division})`);
      });
      console.log('\nThese teams should show up on NBA 2025 page.\n');
    }
    
    if (teamsBySeason['2024'] && teamsBySeason['2024'].length > 0) {
      console.log('✅ Found NBA teams with season 2024:');
      teamsBySeason['2024'].forEach(team => {
        console.log(`  - ${team.name} (${team.league}, ${team.division})`);
      });
      console.log('\nThese teams should show up on NBA 2024 page.\n');
    }
    
    // If there are duplicate teams (same name, same league, different seasons), that's expected
    // But if there are teams without a season, or with wrong season, we should fix them
    
    console.log('✅ Team check complete. If teams are showing on wrong pages,');
    console.log('   the filter fix should resolve it. If not, we may need to');
    console.log('   delete and recreate teams with explicit seasons.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

