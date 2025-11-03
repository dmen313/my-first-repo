import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;
const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function testNflOdds() {
  console.log('🏈 Testing NFL Championship Odds API for 2025 season...\n');
  
  if (!ODDS_API_KEY) {
    console.error('❌ ODDS_API_KEY not found in environment variables');
    return;
  }
  
  console.log('✅ Odds API Key found');
  console.log('🔗 API Base URL:', ODDS_API_BASE);
  
  try {
    // Test 1: Check available NFL sports
    console.log('\n📋 Test 1: Checking available NFL sports...');
    const sportsResponse = await fetch(`${ODDS_API_BASE}/sports?apiKey=${ODDS_API_KEY}`);
    
    if (sportsResponse.ok) {
      const sportsData = await sportsResponse.json();
      const nflSports = sportsData.filter(sport => 
        sport.key.includes('nfl') || sport.key.includes('americanfootball')
      );
      
      console.log('✅ Available NFL sports:');
      nflSports.forEach(sport => {
        console.log(`  - ${sport.key}: ${sport.title} (Active: ${sport.active})`);
      });
      
      // Test 2: Fetch NFL Super Bowl winner odds
      console.log('\n🏆 Test 2: Fetching NFL Super Bowl winner odds...');
      const nflEndpoint = 'americanfootball_nfl_super_bowl_winner';
      const oddsUrl = `${ODDS_API_BASE}/sports/${nflEndpoint}/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
      
      console.log('🔗 Odds URL:', oddsUrl);
      
      const oddsResponse = await fetch(oddsUrl);
      
      if (oddsResponse.ok) {
        const oddsData = await oddsResponse.json();
        console.log(`✅ Successfully fetched odds data`);
        console.log(`📊 Number of games/markets: ${oddsData.length}`);
        
        if (oddsData.length > 0) {
          const firstGame = oddsData[0];
          console.log('\n📈 First market details:');
          console.log(`  Sport: ${firstGame.sport_title}`);
          console.log(`  Commence Time: ${firstGame.commence_time}`);
          console.log(`  Bookmakers: ${firstGame.bookmakers?.length || 0}`);
          
          if (firstGame.bookmakers && firstGame.bookmakers.length > 0) {
            const firstBookmaker = firstGame.bookmakers[0];
            console.log(`\n💰 ${firstBookmaker.title} odds:`);
            
            if (firstBookmaker.markets && firstBookmaker.markets.length > 0) {
              const market = firstBookmaker.markets[0];
              console.log(`  Market: ${market.key}`);
              console.log(`  Teams with odds:`);
              
              const oddsMap = {};
              market.outcomes.slice(0, 10).forEach(outcome => {
                const odds = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
                oddsMap[outcome.name] = odds;
                console.log(`    ${outcome.name}: ${odds}`);
              });
              
              console.log(`  ... and ${Math.max(0, market.outcomes.length - 10)} more teams`);
              
              // Test 3: Compare with current database teams
              console.log('\n🔍 Test 3: Comparing with database teams...');
              await compareWithDatabase(oddsMap);
            }
          }
        } else {
          console.log('⚠️ No odds data available for NFL Super Bowl winner');
        }
        
      } else {
        const errorText = await oddsResponse.text();
        console.error(`❌ Failed to fetch odds: ${oddsResponse.status} ${oddsResponse.statusText}`);
        console.error('Error details:', errorText);
      }
      
    } else {
      console.error(`❌ Failed to fetch sports: ${sportsResponse.status} ${sportsResponse.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing NFL odds API:', error);
  }
}

async function compareWithDatabase(oddsMap) {
  try {
    // Get current NFL teams from database
    const teamsResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ getTeams(league: "nfl", season: "2025") { name odds } }'
      })
    });
    
    const teamsData = await teamsResponse.json();
    const dbTeams = teamsData.data?.getTeams || [];
    
    console.log(`📊 Database has ${dbTeams.length} NFL teams`);
    
    let matchedCount = 0;
    let unmatchedDb = [];
    let unmatchedApi = Object.keys(oddsMap);
    
    dbTeams.forEach(dbTeam => {
      // Try to find matching odds
      const apiMatch = Object.keys(oddsMap).find(apiName => 
        apiName.toLowerCase().includes(dbTeam.name.toLowerCase()) ||
        dbTeam.name.toLowerCase().includes(apiName.toLowerCase()) ||
        // Check individual words
        dbTeam.name.split(' ').some(dbWord => 
          apiName.toLowerCase().includes(dbWord.toLowerCase()) && dbWord.length > 3
        )
      );
      
      if (apiMatch) {
        matchedCount++;
        unmatchedApi = unmatchedApi.filter(name => name !== apiMatch);
        console.log(`  ✅ ${dbTeam.name} → ${apiMatch}: ${oddsMap[apiMatch]} (DB: ${dbTeam.odds})`);
      } else {
        unmatchedDb.push(dbTeam.name);
      }
    });
    
    console.log(`\n📈 Matching Results:`);
    console.log(`✅ Successfully matched: ${matchedCount}/${dbTeams.length} teams`);
    
    if (unmatchedDb.length > 0) {
      console.log(`\n❌ Unmatched Database Teams (${unmatchedDb.length}):`);
      unmatchedDb.slice(0, 5).forEach(name => console.log(`  - ${name}`));
      if (unmatchedDb.length > 5) console.log(`  ... and ${unmatchedDb.length - 5} more`);
    }
    
    if (unmatchedApi.length > 0) {
      console.log(`\n🆕 Unmatched API Teams (${unmatchedApi.length}):`);
      unmatchedApi.slice(0, 5).forEach(name => console.log(`  - ${name}: ${oddsMap[name]}`));
      if (unmatchedApi.length > 5) console.log(`  ... and ${unmatchedApi.length - 5} more`);
    }
    
  } catch (error) {
    console.error('❌ Error comparing with database:', error);
  }
}

// Test the sportsApi function
async function testSportsApiOdds() {
  console.log('\n\n🔄 Testing sportsApi fetchLiveOdds function...');
  
  try {
    const { fetchLiveOdds } = await import('../src/services/sportsApi.js');
    
    console.log('📡 Calling fetchLiveOdds("nfl-2025")...');
    const result = await fetchLiveOdds('nfl-2025');
    
    if (result && result.oddsMap) {
      const oddsCount = Object.keys(result.oddsMap).length;
      console.log(`✅ Successfully fetched odds for ${oddsCount} teams`);
      
      console.log('📊 Sample odds:');
      Object.entries(result.oddsMap).slice(0, 5).forEach(([team, odds]) => {
        console.log(`  ${team}: ${odds}`);
      });
      
      console.log('\n📈 Metadata:', JSON.stringify(result.metadata, null, 2));
    } else {
      console.error('❌ No odds data received');
      console.log('Result:', JSON.stringify(result, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error testing sportsApi odds:', error);
  }
}

// Run tests
async function runTests() {
  await testNflOdds();
  await testSportsApiOdds();
  
  console.log('\n✅ NFL odds API tests completed!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

export { testNflOdds, testSportsApiOdds };
