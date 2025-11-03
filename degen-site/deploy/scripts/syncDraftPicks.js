#!/usr/bin/env node

require('dotenv').config();

const fetch = require('node-fetch').default || require('node-fetch');

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function makeGraphQLRequest(query, variables = {}) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`);
  }

  const result = await response.json();
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

async function syncDraftPicksWithTeamOwnership() {
  console.log('🔄 Starting draft picks sync...');

  try {
    // Step 1: Get all teams with owners
    const teamsData = await makeGraphQLRequest(`
      query {
        getTeams(league: "ncaa", season: "2025") {
          id
          name
          owner
        }
      }
    `);

    const teamsWithOwners = teamsData.getTeams.filter(team => team.owner !== null);
    console.log(`📊 Found ${teamsWithOwners.length} teams with owners:`, 
      teamsWithOwners.map(t => `${t.name} (${t.owner})`));

    // Step 2: Get all draft picks
    const draftData = await makeGraphQLRequest(`
      query {
        getDraftPicks(league: "ncaa", season: "2025") {
          id
          pickNumber
          owner
          teamId
          teamName
        }
      }
    `);

    const draftPicks = draftData.getDraftPicks.sort((a, b) => a.pickNumber - b.pickNumber);
    console.log(`📋 Found ${draftPicks.length} draft picks`);

    // Step 3: Match teams to draft picks by owner
    let updatedCount = 0;
    
    for (const team of teamsWithOwners) {
      // Find the first available draft pick for this owner that doesn't have a team assigned
      const availablePick = draftPicks.find(pick => 
        pick.owner === team.owner && (pick.teamId === null || pick.teamName === null)
      );

      if (availablePick) {
        console.log(`🔄 Updating pick #${availablePick.pickNumber} (${availablePick.owner}) with ${team.name}`);
        
        try {
          await makeGraphQLRequest(`
            mutation {
              updateDraftPick(input: {
                id: "${availablePick.id}"
                teamId: "${team.id}"
                teamName: "${team.name}"
              }) {
                id
                pickNumber
                owner
                teamName
              }
            }
          `);
          
          updatedCount++;
          console.log(`   ✅ Updated pick #${availablePick.pickNumber}: ${availablePick.owner} → ${team.name}`);
        } catch (error) {
          console.error(`   ❌ Failed to update pick #${availablePick.pickNumber}:`, error.message);
        }
      } else {
        console.log(`⚠️  No available draft pick found for ${team.owner} (${team.name})`);
      }
    }

    console.log(`\n🎉 Draft picks sync completed!`);
    console.log(`   📊 Updated: ${updatedCount} draft picks`);
    console.log(`   🏈 Teams with owners: ${teamsWithOwners.length}`);

  } catch (error) {
    console.error('❌ Error syncing draft picks:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  syncDraftPicksWithTeamOwnership();
}

module.exports = { syncDraftPicksWithTeamOwnership };

