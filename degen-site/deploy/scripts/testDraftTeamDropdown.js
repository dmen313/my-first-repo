import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function testDraftTeamDropdown() {
  console.log('🧪 Testing Draft Team Dropdown Functionality...\n');
  
  try {
    // Step 1: Get all NFL teams
    console.log('📋 Step 1: Getting all NFL teams...');
    const teamsResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getTeams(league: "nfl", season: "2025") {
              id
              name
              owner
              odds
            }
          }
        `
      })
    });
    
    const teamsData = await teamsResponse.json();
    const allTeams = teamsData.data?.getTeams || [];
    
    console.log(`📊 Total NFL teams: ${allTeams.length}`);
    
    // Step 2: Get draft picks
    console.log('\n📋 Step 2: Getting draft picks...');
    const picksResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getDraftPicks(league: "nfl", season: "2025") {
              id
              pickNumber
              owner
              teamId
              teamName
            }
          }
        `
      })
    });
    
    const picksData = await picksResponse.json();
    const draftPicks = picksData.data?.getDraftPicks || [];
    
    console.log(`📊 Total draft picks: ${draftPicks.length}`);
    
    // Step 3: Analyze team availability
    console.log('\n🔍 Step 3: Analyzing team availability...');
    
    // Teams with owners (not NA)
    const teamsWithOwners = allTeams.filter(team => team.owner && team.owner !== 'NA');
    console.log(`👥 Teams with owners: ${teamsWithOwners.length}`);
    teamsWithOwners.forEach(team => {
      console.log(`   - ${team.name}: ${team.owner}`);
    });
    
    // Teams already drafted
    const draftedTeamIds = draftPicks.filter(pick => pick.teamId).map(pick => pick.teamId);
    const draftedTeams = allTeams.filter(team => draftedTeamIds.includes(team.id));
    console.log(`🏈 Teams already drafted: ${draftedTeams.length}`);
    draftedTeams.forEach(team => {
      console.log(`   - ${team.name}`);
    });
    
    // Available teams (should appear in dropdown)
    const availableTeams = allTeams.filter(team => 
      !draftedTeamIds.includes(team.id) && (!team.owner || team.owner === 'NA')
    );
    
    console.log(`\n✅ Available teams for dropdown: ${availableTeams.length}`);
    
    if (availableTeams.length === 0) {
      console.log('❌ NO TEAMS AVAILABLE - This is why the dropdown is empty!');
      console.log('\n🔍 Debugging info:');
      console.log(`   - Total teams: ${allTeams.length}`);
      console.log(`   - Teams with owners: ${teamsWithOwners.length}`);
      console.log(`   - Teams already drafted: ${draftedTeams.length}`);
      console.log(`   - Expected available: ${allTeams.length - teamsWithOwners.length - draftedTeams.length}`);
    } else {
      console.log('🎉 Teams should appear in dropdown!');
      console.log('\n📋 First 5 available teams:');
      availableTeams.slice(0, 5).forEach(team => {
        console.log(`   - ${team.name} (${team.odds || 'No odds'})`);
      });
    }
    
    // Step 4: Check next pick
    const nextPick = draftPicks.find(pick => !pick.teamId);
    if (nextPick) {
      console.log(`\n🎯 Next pick: ${nextPick.owner} (Pick #${nextPick.pickNumber})`);
      console.log('📱 This pick should have an active dropdown with available teams');
    } else {
      console.log('\n✅ All picks have been made!');
    }
    
  } catch (error) {
    console.error('❌ Error testing draft team dropdown:', error);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testDraftTeamDropdown()
    .then(() => {
      console.log('\n🎉 Draft team dropdown test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

export { testDraftTeamDropdown };


