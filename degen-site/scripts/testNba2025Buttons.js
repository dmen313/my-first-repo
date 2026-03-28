#!/usr/bin/env node

/**
 * Test NBA 2025 Update Buttons
 * Tests both updateNbaTeamsFromApi (standings) and updateTeamOdds mutations
 */

require('dotenv').config();
const fetch = require('node-fetch').default || require('node-fetch');

const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'https://kubm8uzctg.execute-api.us-east-1.amazonaws.com/prod/graphql';

async function testStandingsUpdate() {
  console.log('📊 Testing "Update Standings" button...\n');
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation UpdateNbaTeamsFromApi($league: String!, $season: String!) {
            updateNbaTeamsFromApi(league: $league, season: $season) {
              success
              teamsUpdated
              oddsUpdated
              recordsUpdated
              totalTeams
              error
              message
            }
          }
        `,
        variables: { league: 'nba', season: '2025' }
      })
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`   ⏱️  Completed in ${duration} seconds`);

    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status}: ${response.statusText}\n`);
      return false;
    }

    const result = await response.json();
    
    if (result.errors) {
      console.log('   ❌ GraphQL Errors:');
      result.errors.forEach(error => console.log(`      • ${error.message}`));
      console.log('');
      return false;
    }

    const updateResult = result.data?.updateNbaTeamsFromApi;
    console.log(`   ✅ Success: ${updateResult.success}`);
    console.log(`   📝 Records Updated: ${updateResult.recordsUpdated}`);
    console.log(`   🏀 Total Teams: ${updateResult.totalTeams}`);
    console.log(`   💬 ${updateResult.message}\n`);

    return updateResult.success;
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    return false;
  }
}

async function testOddsUpdate() {
  console.log('💰 Testing "Update Odds" button...\n');
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation UpdateTeamOdds($league: String!, $season: String!) {
            updateTeamOdds(league: $league, season: $season) {
              success
              teamsUpdated
              oddsUpdated
              recordsUpdated
              totalTeams
              error
              message
            }
          }
        `,
        variables: { league: 'nba', season: '2025' }
      })
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`   ⏱️  Completed in ${duration} seconds`);

    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status}: ${response.statusText}\n`);
      return false;
    }

    const result = await response.json();
    
    if (result.errors) {
      console.log('   ❌ GraphQL Errors:');
      result.errors.forEach(error => console.log(`      • ${error.message}`));
      console.log('');
      return false;
    }

    const updateResult = result.data?.updateTeamOdds;
    console.log(`   ✅ Success: ${updateResult.success}`);
    console.log(`   💰 Odds Updated: ${updateResult.oddsUpdated}`);
    console.log(`   🏀 Total Teams: ${updateResult.totalTeams}`);
    console.log(`   💬 ${updateResult.message}\n`);

    return updateResult.success;
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}\n`);
    return false;
  }
}

async function runTests() {
  console.log('🏀 NBA 2025 Button Tests\n');
  console.log(`📡 Endpoint: ${GRAPHQL_ENDPOINT}\n`);
  console.log('═══════════════════════════════════════════════════\n');

  const standingsSuccess = await testStandingsUpdate();
  
  console.log('═══════════════════════════════════════════════════\n');
  
  const oddsSuccess = await testOddsUpdate();
  
  console.log('═══════════════════════════════════════════════════\n');
  
  console.log('📊 Test Summary:');
  console.log(`   Update Standings: ${standingsSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Update Odds: ${oddsSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
  
  if (standingsSuccess && oddsSuccess) {
    console.log('🎉 All tests passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed\n');
    process.exit(1);
  }
}

runTests();

