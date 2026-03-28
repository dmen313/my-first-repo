#!/usr/bin/env node

/**
 * Test script to verify draft status GraphQL endpoints are working
 */

require('dotenv').config();

const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'https://kubm8uzctg.execute-api.us-east-1.amazonaws.com/prod/graphql';

async function testDraftStatus() {
  console.log('🧪 Testing Draft Status GraphQL Endpoints...\n');
  console.log(`📍 Endpoint: ${GRAPHQL_ENDPOINT}\n`);

  // Test 1: getAllDraftStatuses query
  console.log('Test 1: getAllDraftStatuses query');
  try {
    const query1 = {
      query: `
        query {
          getAllDraftStatuses {
            id
            league
            season
            status
            createdAt
            updatedAt
          }
        }
      `
    };

    const response1 = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query1)
    });

    let result1;
    try {
      const text = await response1.text();
      result1 = JSON.parse(text);
    } catch (e) {
      console.error('❌ Failed to parse response:', await response1.text());
      return;
    }
    
    if (response1.ok) {
      if (result1.errors) {
        console.error('❌ GraphQL Errors:', JSON.stringify(result1.errors, null, 2));
      } else {
        console.log('✅ Success!');
        console.log(`   Found ${result1.data?.getAllDraftStatuses?.length || 0} draft status(es)`);
        if (result1.data?.getAllDraftStatuses?.length > 0) {
          console.log('   Statuses:');
          result1.data.getAllDraftStatuses.forEach(status => {
            console.log(`     - ${status.league}-${status.season}: ${status.status}`);
          });
        } else {
          console.log('   (No statuses found - this is OK if none exist yet)');
        }
      }
    } else {
      console.error(`❌ HTTP Error: ${response1.status} ${response1.statusText}`);
      console.error('Full Response:', JSON.stringify(result1, null, 2));
      if (result1.error || result1.message) {
        console.error('Error Message:', result1.error || result1.message);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 2: getDraftStatus query (for a specific league/season)
  console.log('Test 2: getDraftStatus query (nfl-2025)');
  try {
    const query2 = {
      query: `
        query {
          getDraftStatus(league: "nfl", season: "2025") {
            id
            league
            season
            status
            createdAt
            updatedAt
          }
        }
      `
    };

    const response2 = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query2)
    });

    const result2 = await response2.json();
    
    if (response2.ok) {
      if (result2.errors) {
        console.error('❌ GraphQL Errors:', JSON.stringify(result2.errors, null, 2));
      } else {
        console.log('✅ Success!');
        if (result2.data?.getDraftStatus) {
          const status = result2.data.getDraftStatus;
          console.log(`   Found status: ${status.league}-${status.season}: ${status.status}`);
        } else {
          console.log('   No status found for nfl-2025 (this is OK if none has been created yet)');
        }
      }
    } else {
      console.error(`❌ HTTP Error: ${response2.status} ${response2.statusText}`);
      console.error('Response:', JSON.stringify(result2, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Test 3: Try to create a draft status
  console.log('Test 3: createDraftStatus mutation');
  try {
    const mutation = {
      query: `
        mutation {
          createDraftStatus(league: "nfl", season: "2025", status: "Draft In Progress") {
            id
            league
            season
            status
            createdAt
            updatedAt
          }
        }
      `
    };

    const response3 = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mutation)
    });

    const result3 = await response3.json();
    
    if (response3.ok) {
      if (result3.errors) {
        console.error('❌ GraphQL Errors:', JSON.stringify(result3.errors, null, 2));
      } else {
        console.log('✅ Success!');
        const status = result3.data?.createDraftStatus;
        if (status) {
          console.log(`   Created status: ${status.league}-${status.season}: ${status.status}`);
        }
      }
    } else {
      console.error(`❌ HTTP Error: ${response3.status} ${response3.statusText}`);
      console.error('Response:', JSON.stringify(result3, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }

  console.log('\n' + '='.repeat(60) + '\n');
  console.log('✅ Test completed!');
}

testDraftStatus().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

