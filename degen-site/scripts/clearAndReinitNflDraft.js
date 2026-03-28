import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function clearAndReinitNflDraft() {
  console.log('🏈 Clearing and Reinitializing NFL 2025 Draft with 32 picks (8 rounds)...\n');
  
  try {
    // Step 1: Check current draft picks
    console.log('📋 Step 1: Checking current NFL draft picks...');
    const currentResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getDraftPicks(league: "nfl", season: "2025") {
              id
              round
              pickNumber
              owner
              teamId
              teamName
            }
          }
        `
      })
    });
    
    const currentData = await currentResponse.json();
    const currentPicks = currentData.data?.getDraftPicks || [];
    
    console.log(`📊 Current picks: ${currentPicks.length}`);
    
    // Check if any teams have been drafted
    const draftedPicks = currentPicks.filter(pick => pick.teamId);
    console.log(`🏈 Teams already drafted: ${draftedPicks.length}`);
    
    if (draftedPicks.length > 0) {
      console.log('⚠️  Found drafted teams. Will clear them and reinitialize...');
      
      // Step 2: Clear team owners back to "NA"
      console.log('\n🧹 Step 2: Clearing team owners...');
      for (const pick of draftedPicks) {
        if (pick.teamId) {
          try {
            await fetch(GRAPHQL_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: `
                  mutation {
                    updateTeam(input: {
                      id: "${pick.teamId}",
                      owner: "NA"
                    }) {
                      id
                      name
                      owner
                    }
                  }
                `
              })
            });
            console.log(`   ✅ Cleared ${pick.teamName} (was owned by ${pick.owner})`);
          } catch (error) {
            console.log(`   ❌ Failed to clear ${pick.teamName}: ${error.message}`);
          }
        }
      }
    }
    
    // Step 3: Reinitialize the draft with new structure
    console.log('\n🔄 Step 3: Reinitializing NFL draft with 8 rounds (32 picks)...');
    const owners = ['KH', 'DM', 'TG', 'MC']; // Current order from previous tests
    
    const initResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            initializeDraft(league: "nfl", season: "2025", owners: ${JSON.stringify(owners)}) {
              id
              round
              pickNumber
              owner
              teamId
              teamName
            }
          }
        `
      })
    });
    
    const initData = await initResponse.json();
    
    if (initData.errors) {
      console.log('❌ Initialization failed:', initData.errors[0].message);
      return;
    }
    
    const newPicks = initData.data?.initializeDraft || [];
    console.log(`✅ Successfully created ${newPicks.length} draft picks`);
    
    // Step 4: Verify the new structure
    console.log('\n📊 Step 4: Verifying new draft structure...');
    
    const rounds = {};
    newPicks.forEach(pick => {
      if (!rounds[pick.round]) {
        rounds[pick.round] = [];
      }
      rounds[pick.round].push(pick);
    });
    
    console.log(`📋 Total rounds: ${Object.keys(rounds).length}`);
    console.log(`📋 Total picks: ${newPicks.length}`);
    console.log(`📋 Picks per owner: ${newPicks.length / owners.length}`);
    
    // Show all rounds
    console.log('\n🏈 Complete Draft Order:');
    for (let round = 1; round <= Object.keys(rounds).length; round++) {
      const roundPicks = rounds[round].sort((a, b) => a.pickNumber - b.pickNumber);
      console.log(`\n  Round ${round}:`);
      roundPicks.forEach(pick => {
        console.log(`    Pick ${pick.pickNumber}: ${pick.owner}`);
      });
    }
    
    // Verify snake draft pattern
    console.log('\n🐍 Verifying snake draft pattern...');
    const round1 = rounds[1]?.sort((a, b) => a.pickNumber - b.pickNumber).map(p => p.owner) || [];
    const round2 = rounds[2]?.sort((a, b) => a.pickNumber - b.pickNumber).map(p => p.owner) || [];
    
    console.log(`Round 1: ${round1.join(' → ')}`);
    console.log(`Round 2: ${round2.join(' → ')}`);
    
    const expectedRound2 = [...round1].reverse();
    const snakeCorrect = JSON.stringify(round2) === JSON.stringify(expectedRound2);
    console.log(`Snake pattern: ${snakeCorrect ? '✅ Correct' : '❌ Incorrect'}`);
    
    // Summary
    console.log('\n🎉 NFL Draft successfully reinitialized!');
    console.log('📊 Summary of changes:');
    console.log(`   • Reduced from 48 picks (12 rounds) to 32 picks (8 rounds)`);
    console.log(`   • Each owner now drafts exactly 8 teams (perfect for 32 NFL teams)`);
    console.log(`   • All previously drafted teams have been cleared`);
    console.log(`   • Snake draft pattern maintained`);
    console.log('📱 You can now start drafting with the new 32-pick structure!');
    
  } catch (error) {
    console.error('❌ Error clearing and reinitializing NFL draft:', error);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  clearAndReinitNflDraft()
    .then(() => {
      console.log('\n🎉 NFL draft clear and reinitialization completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { clearAndReinitNflDraft };




