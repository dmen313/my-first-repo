import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const NFL_API_BASE = 'https://nfl-api-data.p.rapidapi.com';
const NFL_API_KEY = process.env.REACT_APP_NFL_API_KEY;

async function testNfl2025Api() {
  console.log('🏈 Testing NFL API for 2025 season...\n');
  
  if (!NFL_API_KEY) {
    console.error('❌ NFL_API_KEY not found in environment variables');
    return;
  }
  
  try {
    // Get team listing first
    console.log('📋 Fetching NFL team listing...');
    const teamsResponse = await fetch(`${NFL_API_BASE}/nfl-team-listing/v1/data`, {
      headers: {
        'x-rapidapi-host': 'nfl-api-data.p.rapidapi.com',
        'x-rapidapi-key': NFL_API_KEY
      }
    });
    
    if (!teamsResponse.ok) {
      throw new Error(`Teams API failed: ${teamsResponse.status}`);
    }
    
    const teamsData = await teamsResponse.json();
    console.log(`✅ Found ${teamsData.length} teams`);
    
    if (teamsData.length > 0 && teamsData[0].team) {
      const firstTeam = teamsData[0].team;
      console.log(`\n🔍 Testing different years for ${firstTeam.displayName} (ID: ${firstTeam.id}):`);
      
      // Test different years
      const yearsToTest = [2025, 2024, 2023];
      
      for (const year of yearsToTest) {
        console.log(`\n📅 Testing year ${year}:`);
        const recordUrl = `${NFL_API_BASE}/nfl-team-record?id=${firstTeam.id}&year=${year}`;
        
        try {
          const recordResponse = await fetch(recordUrl, {
            headers: {
              'x-rapidapi-host': 'nfl-api-data.p.rapidapi.com',
              'x-rapidapi-key': NFL_API_KEY
            }
          });
          
          if (recordResponse.ok) {
            const recordData = await recordResponse.json();
            
            if (recordData && recordData.items && recordData.items.length > 0) {
              const overallRecord = recordData.items.find(item => item.name === 'overall');
              if (overallRecord && overallRecord.summary) {
                console.log(`  ✅ ${year}: ${overallRecord.summary} (${recordData.items.length} record types)`);
              } else {
                console.log(`  ⚠️ ${year}: Data available but no overall record found`);
              }
            } else {
              console.log(`  ❌ ${year}: No record data available`);
            }
          } else {
            console.log(`  ❌ ${year}: API error ${recordResponse.status}`);
          }
        } catch (error) {
          console.log(`  ❌ ${year}: Request failed - ${error.message}`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Check what the current NFL season should be
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    
    console.log(`\n📅 Current Date Analysis:`);
    console.log(`  Current Date: ${now.toDateString()}`);
    console.log(`  Current Month: ${currentMonth}`);
    console.log(`  Current Year: ${currentYear}`);
    
    // NFL season typically runs September to February
    // So in 2025, we might be in the 2024-2025 season or 2025-2026 season
    let expectedSeason;
    if (currentMonth >= 9) {
      // September or later - new season starting
      expectedSeason = currentYear;
    } else if (currentMonth <= 2) {
      // January-February - still in previous year's season
      expectedSeason = currentYear - 1;
    } else {
      // March-August - off-season, use previous season
      expectedSeason = currentYear - 1;
    }
    
    console.log(`  Expected NFL Season: ${expectedSeason}`);
    console.log(`  Requested Season: 2025`);
    
    if (expectedSeason !== 2025) {
      console.log(`\n⚠️ Note: You requested 2025 season data, but based on current date (${now.toDateString()}),`);
      console.log(`   the active/most recent NFL season would be ${expectedSeason}.`);
      console.log(`   2025 season data may not be available yet.`);
    }
    
  } catch (error) {
    console.error('❌ Error testing NFL API:', error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testNfl2025Api()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

export { testNfl2025Api };
