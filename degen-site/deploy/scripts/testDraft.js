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

// Test draft functionality
async function testDraft() {
  try {
    console.log('🧪 Testing Draft Functionality...');
    
    // Test 1: Initialize draft
    console.log('\n1️⃣ Testing draft initialization...');
    const owners = ['DM', 'TG', 'KH', 'MC'];
    const initResult = await graphqlRequest(`
      mutation InitializeDraft($league: String!, $season: String!, $owners: [String!]!) {
        initializeDraft(league: $league, season: $season, owners: $owners) {
          id
          league
          season
          round
          pickNumber
          owner
          teamId
          teamName
        }
      }
    `, { league: 'ncaa', season: '2025', owners });

    console.log(`✅ Draft initialized with ${initResult.initializeDraft.length} picks`);
    
    // Test 2: Fetch draft picks
    console.log('\n2️⃣ Testing draft picks fetch...');
    const picksResult = await graphqlRequest(`
      query GetDraftPicks($league: String!, $season: String!) {
        getDraftPicks(league: $league, season: $season) {
          id
          league
          season
          round
          pickNumber
          owner
          teamId
          teamName
        }
      }
    `, { league: 'ncaa', season: '2025' });

    console.log(`✅ Fetched ${picksResult.getDraftPicks.length} draft picks`);
    
    // Test 3: Show snake draft order
    console.log('\n3️⃣ Snake Draft Order:');
    const rounds = {};
    picksResult.getDraftPicks.forEach(pick => {
      if (!rounds[pick.round]) {
        rounds[pick.round] = [];
      }
      rounds[pick.round].push(pick);
    });
    
    Object.keys(rounds).sort((a, b) => parseInt(a) - parseInt(b)).forEach(round => {
      const roundPicks = rounds[round].sort((a, b) => a.pickNumber - b.pickNumber);
      console.log(`Round ${round}: ${roundPicks.map(p => `${p.owner} (#${p.pickNumber})`).join(' → ')}`);
    });
    
    // Test 4: Get some teams to test with
    console.log('\n4️⃣ Testing team selection...');
    const teamsResult = await graphqlRequest(`
      query GetTeams($league: String, $season: String) {
        getTeams(league: $league, season: $season) {
          id
          name
          division
        }
      }
    `, { league: 'ncaa', season: '2025' });

    if (teamsResult.getTeams.length > 0) {
      const testTeam = teamsResult.getTeams[0];
      const firstPick = picksResult.getDraftPicks[0];
      
      console.log(`✅ Found ${teamsResult.getTeams.length} teams`);
      console.log(`📝 Testing with team: ${testTeam.name} (${testTeam.division})`);
      console.log(`🎯 First pick: ${firstPick.owner} (Round ${firstPick.round}, Pick #${firstPick.pickNumber})`);
      
      // Test 5: Update a draft pick
      console.log('\n5️⃣ Testing draft pick update...');
      const updateResult = await graphqlRequest(`
        mutation UpdateDraftPick($input: UpdateDraftPickInput!) {
          updateDraftPick(input: $input) {
            id
            league
            season
            round
            pickNumber
            owner
            teamId
            teamName
          }
        }
      `, { 
        input: { 
          id: firstPick.id, 
          teamId: testTeam.id, 
          teamName: testTeam.name 
        } 
      });

      console.log(`✅ Updated draft pick: ${updateResult.updateDraftPick.owner} → ${updateResult.updateDraftPick.teamName}`);
      
      // Test 6: Verify the update
      console.log('\n6️⃣ Verifying update...');
      const verifyResult = await graphqlRequest(`
        query GetDraftPick($id: ID!) {
          getDraftPick(id: $id) {
            id
            owner
            teamId
            teamName
          }
        }
      `, { id: firstPick.id });

      console.log(`✅ Verification: ${verifyResult.getDraftPick.owner} selected ${verifyResult.getDraftPick.teamName}`);
    }
    
    console.log('\n🎉 All draft tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testDraft();

