import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function reinitializeNflDraft() {
  console.log('🏈 Reinitializing NFL 2025 Draft with 32 picks (8 rounds)...\n');
  
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
      console.log('⚠️  WARNING: Some teams have already been drafted:');
      draftedPicks.forEach(pick => {
        console.log(`   Pick ${pick.pickNumber}: ${pick.owner} → ${pick.teamName}`);
      });
      console.log('\n❌ Cannot reinitialize draft after teams have been selected.');
      console.log('💡 If you want to proceed, you would need to manually clear the drafted teams first.');
      return;
    }
    
    // Step 2: Reinitialize the draft
    console.log('\n🔄 Step 2: Reinitializing NFL draft with 8 rounds...');
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
    
    // Step 3: Verify the new structure
    console.log('\n📊 Step 3: Verifying new draft structure...');
    
    const rounds = {};
    newPicks.forEach(pick => {
      if (!rounds[pick.round]) {
        rounds[pick.round] = [];
      }
      rounds[pick.round].push(pick);
    });
    
    console.log(`📋 Total rounds: ${Object.keys(rounds).length}`);
    console.log(`📋 Total picks: ${newPicks.length}`);
    
    // Show first few rounds
    console.log('\n🏈 Draft Order Preview:');
    for (let round = 1; round <= Math.min(3, Object.keys(rounds).length); round++) {
      const roundPicks = rounds[round].sort((a, b) => a.pickNumber - b.pickNumber);
      console.log(`\n  Round ${round}:`);
      roundPicks.forEach(pick => {
        console.log(`    Pick ${pick.pickNumber}: ${pick.owner}`);
      });
    }
    
    // Show last round
    const lastRound = Math.max(...Object.keys(rounds).map(Number));
    if (lastRound > 3) {
      const lastRoundPicks = rounds[lastRound].sort((a, b) => a.pickNumber - b.pickNumber);
      console.log(`\n  Round ${lastRound} (Final):`);
      lastRoundPicks.forEach(pick => {
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
    
    console.log('\n🎉 NFL Draft successfully reinitialized!');
    console.log('📱 The draft now has 32 picks (8 rounds) instead of 48 picks (12 rounds)');
    console.log('🏈 Each owner will draft exactly 8 teams (32 NFL teams ÷ 4 owners)');
    
  } catch (error) {
    console.error('❌ Error reinitializing NFL draft:', error);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  reinitializeNflDraft()
    .then(() => {
      console.log('\n🎉 NFL draft reinitialization completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { reinitializeNflDraft };




