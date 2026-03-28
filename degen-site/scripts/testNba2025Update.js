#!/usr/bin/env node

/**
 * Test NBA 2025 Data Update
 * Tests the updateNbaTeamsFromApi mutation against the deployed Lambda
 */

require('dotenv').config();
const fetch = require('node-fetch').default || require('node-fetch');

const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'https://kubm8uzctg.execute-api.us-east-1.amazonaws.com/prod/graphql';

async function testNba2025Update() {
  console.log('🏀 Testing NBA 2025 Data Update\n');
  console.log(`📡 GraphQL Endpoint: ${GRAPHQL_ENDPOINT}\n`);

  try {
    const startTime = Date.now();
    
    console.log('🚀 Sending updateNbaTeamsFromApi mutation...');
    console.log('   League: nba');
    console.log('   Season: 2025\n');
    
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
        variables: {
          league: 'nba',
          season: '2025'
        }
      })
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`⏱️  Request completed in ${duration} seconds\n`);

    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(`   Response body: ${text}\n`);
      process.exit(1);
    }

    const result = await response.json();
    
    if (result.errors) {
      console.error('❌ GraphQL Errors:');
      result.errors.forEach(error => {
        console.error(`   • ${error.message}`);
      });
      console.error('');
      process.exit(1);
    }

    if (!result.data || !result.data.updateNbaTeamsFromApi) {
      console.error('❌ Invalid response structure');
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    const updateResult = result.data.updateNbaTeamsFromApi;
    
    console.log('📊 Update Results:');
    console.log(`   ✅ Success: ${updateResult.success}`);
    console.log(`   📝 Teams Updated: ${updateResult.teamsUpdated}`);
    console.log(`   💰 Odds Updated: ${updateResult.oddsUpdated}`);
    console.log(`   📊 Records Updated: ${updateResult.recordsUpdated}`);
    console.log(`   🏀 Total Teams: ${updateResult.totalTeams}`);
    
    if (updateResult.error) {
      console.log(`   ⚠️  Error: ${updateResult.error}`);
    }
    
    console.log(`   💬 Message: ${updateResult.message}\n`);

    if (!updateResult.success) {
      console.error('❌ Update failed!\n');
      process.exit(1);
    }

    // Performance assessment
    console.log('🎯 Performance Assessment:');
    if (duration < 10) {
      console.log(`   ✅ EXCELLENT: ${duration}s (well within API Gateway timeout)`);
    } else if (duration < 20) {
      console.log(`   ✅ GOOD: ${duration}s (acceptable performance)`);
    } else if (duration < 29) {
      console.log(`   ⚠️  MARGINAL: ${duration}s (close to timeout limit)`);
    } else {
      console.log(`   ❌ FAILED: ${duration}s (exceeded API Gateway timeout)`);
    }
    console.log('');

    console.log('✅ NBA 2025 Update Test Completed Successfully!\n');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      console.error('\n💡 The request timed out. This indicates the Lambda function is taking too long.');
      console.error('   The API Gateway has a 29-second timeout limit.\n');
    }
    
    process.exit(1);
  }
}

testNba2025Update();

