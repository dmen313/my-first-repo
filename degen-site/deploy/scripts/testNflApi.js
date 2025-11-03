import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const NFL_API_BASE = 'https://nfl-api-data.p.rapidapi.com';
const NFL_API_KEY = process.env.REACT_APP_NFL_API_KEY;

async function testNflApi() {
  console.log('🏈 Testing NFL API...\n');
  
  if (!NFL_API_KEY) {
    console.error('❌ NFL_API_KEY not found in environment variables');
    return;
  }
  
  console.log('✅ NFL API Key found');
  console.log('🔗 API Base URL:', NFL_API_BASE);
  
  try {
    // Test 1: Fetch team listing
    console.log('\n📋 Test 1: Fetching NFL team listing...');
    const teamsUrl = `${NFL_API_BASE}/nfl-team-listing/v1/data`;
    const teamsResponse = await fetch(teamsUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'nfl-api-data.p.rapidapi.com',
        'x-rapidapi-key': NFL_API_KEY
      }
    });
    
    if (teamsResponse.ok) {
      const teamsData = await teamsResponse.json();
      console.log(`✅ Successfully fetched ${teamsData.length} teams`);
      console.log('📊 First team example:', JSON.stringify(teamsData[0], null, 2));
      
      // Test 2: Fetch record for first team
      if (teamsData.length > 0 && teamsData[0].team && teamsData[0].team.id) {
        const firstTeam = teamsData[0].team;
        console.log(`\n📈 Test 2: Fetching record for ${firstTeam.displayName}...`);
        
        const currentYear = new Date().getFullYear();
        const year = currentYear - 1; // Use 2024 for current standings
        const recordUrl = `${NFL_API_BASE}/nfl-team-record?id=${firstTeam.id}&year=${year}`;
        
        console.log('🔗 Record URL:', recordUrl);
        
        const recordResponse = await fetch(recordUrl, {
          method: 'GET',
          headers: {
            'x-rapidapi-host': 'nfl-api-data.p.rapidapi.com',
            'x-rapidapi-key': NFL_API_KEY
          }
        });
        
        if (recordResponse.ok) {
          const recordData = await recordResponse.json();
          console.log('✅ Successfully fetched team record');
          console.log('📊 Record data:', JSON.stringify(recordData, null, 2));
          
          // Parse the record
          if (recordData && recordData.items && Array.isArray(recordData.items)) {
            const overallRecord = recordData.items.find(item => item.name === 'overall');
            if (overallRecord && overallRecord.summary) {
              console.log(`🏆 ${firstTeam.displayName} 2024 Record: ${overallRecord.summary}`);
            }
          }
        } else {
          console.error(`❌ Failed to fetch record: ${recordResponse.status} ${recordResponse.statusText}`);
          const errorText = await recordResponse.text();
          console.error('Error details:', errorText);
        }
      }
      
    } else {
      console.error(`❌ Failed to fetch teams: ${teamsResponse.status} ${teamsResponse.statusText}`);
      const errorText = await teamsResponse.text();
      console.error('Error details:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error testing NFL API:', error);
  }
}

// Test the current standings function from sportsApi
async function testCurrentStandings() {
  console.log('\n\n🔄 Testing getCurrentStandings function...');
  
  try {
    // Import the function
    const { getCurrentStandings } = await import('../src/services/sportsApi.js');
    
    console.log('📡 Calling getCurrentStandings("nfl-2025")...');
    const result = await getCurrentStandings('nfl-2025');
    
    if (result && result.teams) {
      console.log(`✅ Successfully fetched ${result.teams.length} NFL teams`);
      console.log('📊 First 3 teams:');
      result.teams.slice(0, 3).forEach((team, index) => {
        console.log(`  ${index + 1}. ${team.name}: ${team.record} (${team.wins}-${team.losses}) - Odds: ${team.odds}`);
      });
      
      console.log('\n📈 Metadata:', JSON.stringify(result.metadata, null, 2));
    } else {
      console.error('❌ No teams data received');
      console.log('Result:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error testing getCurrentStandings:', error);
  }
}

// Run tests
async function runTests() {
  await testNflApi();
  await testCurrentStandings();
  
  console.log('\n✅ NFL API tests completed!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

export { testNflApi, testCurrentStandings };
