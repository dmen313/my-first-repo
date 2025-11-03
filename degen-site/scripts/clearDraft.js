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

// Clear all draft picks
async function clearDraft() {
  try {
    console.log('🧹 Clearing all draft picks...');
    
    // Get all draft picks
    const picksResult = await graphqlRequest(`
      query GetDraftPicks($league: String!, $season: String!) {
        getDraftPicks(league: $league, season: $season) {
          id
        }
      }
    `, { league: 'ncaa', season: '2025' });

    const picks = picksResult.getDraftPicks;
    console.log(`📊 Found ${picks.length} draft picks to delete`);
    
    // Delete each pick
    let deletedCount = 0;
    for (const pick of picks) {
      try {
        await graphqlRequest(`
          mutation DeleteDraftPick($id: ID!) {
            deleteDraftPick(id: $id)
          }
        `, { id: pick.id });
        deletedCount++;
      } catch (err) {
        console.error(`❌ Failed to delete pick ${pick.id}:`, err.message);
      }
    }
    
    console.log(`✅ Successfully deleted ${deletedCount} draft picks`);
    
    // Verify deletion
    const verifyResult = await graphqlRequest(`
      query GetDraftPicks($league: String!, $season: String!) {
        getDraftPicks(league: $league, season: $season) {
          id
        }
      }
    `, { league: 'ncaa', season: '2025' });

    console.log(`📊 Remaining draft picks: ${verifyResult.getDraftPicks.length}`);
    
  } catch (error) {
    console.error('❌ Error clearing draft:', error.message);
    process.exit(1);
  }
}

// Run the script
clearDraft();

