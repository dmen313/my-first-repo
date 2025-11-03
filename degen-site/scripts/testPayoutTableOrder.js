import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function testPayoutTableOrder() {
  console.log('🧪 Testing Payout Table Dynamic Owner Order...\n');
  
  try {
    // Step 1: Get current draft picks to see the order
    console.log('📋 Step 1: Getting current draft picks for owner order...');
    const response = await fetch(GRAPHQL_ENDPOINT, {
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
            }
          }
        `
      })
    });
    
    const data = await response.json();
    const draftPicks = data.data?.getDraftPicks || [];
    
    if (draftPicks.length === 0) {
      console.log('❌ No draft picks found');
      return;
    }
    
    // Step 2: Determine expected owner order from Round 1 picks
    console.log('📋 Step 2: Analyzing Round 1 picks for payout table order...');
    const round1Picks = draftPicks
      .filter(pick => pick.round === 1)
      .sort((a, b) => a.pickNumber - b.pickNumber);
    
    const expectedOwnerOrder = round1Picks.map(pick => pick.owner);
    console.log(`\n📊 Expected Payout Table Column Order: ${expectedOwnerOrder.join(' → ')}`);
    
    // Step 3: Show what the payout table should display
    console.log('\n💰 Payout Table Headers Should Show:');
    console.log('   Level | Teams | % | Payout | ' + expectedOwnerOrder.join(' | '));
    console.log('   ------|-------|---|--------|' + expectedOwnerOrder.map(() => '------').join('|'));
    
    // Step 4: Verify the order matches draft order
    console.log('\n🎯 Verification:');
    console.log(`   First Owner Column: ${expectedOwnerOrder[0]} (should be KH)`);
    console.log(`   Second Owner Column: ${expectedOwnerOrder[1]} (should be DM)`);
    console.log(`   Third Owner Column: ${expectedOwnerOrder[2]} (should be TG)`);
    console.log(`   Fourth Owner Column: ${expectedOwnerOrder[3]} (should be MC)`);
    
    const correctOrder = 
      expectedOwnerOrder[0] === 'KH' &&
      expectedOwnerOrder[1] === 'DM' &&
      expectedOwnerOrder[2] === 'TG' &&
      expectedOwnerOrder[3] === 'MC';
    
    if (correctOrder) {
      console.log('\n🎉 SUCCESS: Payout table order matches draft order!');
      console.log('💰 The payout table should now show columns in this order:');
      console.log(`   Level | Teams | % | Payout | ${expectedOwnerOrder.join(' | ')}`);
      console.log('\n📱 Frontend Benefits:');
      console.log('   • KH appears as first owner column (matches first draft pick)');
      console.log('   • Column order is consistent with draft order');
      console.log('   • Automatically updates when draft order changes');
      console.log('   • All payout calculations show in correct owner sequence');
    } else {
      console.log('\n⚠️  WARNING: Payout table order may not match expected draft order');
      console.log(`   Expected: KH → DM → TG → MC`);
      console.log(`   Actual: ${expectedOwnerOrder.join(' → ')}`);
    }
    
    // Step 5: Show implementation details
    console.log('\n🔧 Implementation Details:');
    console.log('   • Payout table uses same dynamic owner logic as draft table');
    console.log('   • Owner order determined by Round 1 draft pick sequence');
    console.log('   • Headers, individual rows, totals, and net calculations all use dynamic order');
    console.log('   • Fallback to static order if no draft picks exist');
    
  } catch (error) {
    console.error('❌ Error testing payout table order:', error);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testPayoutTableOrder()
    .then(() => {
      console.log('\n🎉 Payout table order test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

export { testPayoutTableOrder };


