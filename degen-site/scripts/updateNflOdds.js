import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const ODDS_API_KEY = process.env.REACT_APP_ODDS_API_KEY;
const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function updateNflOdds() {
  console.log('🏈 Updating NFL Championship Odds for 2025 season...\n');
  
  if (!ODDS_API_KEY) {
    console.error('❌ ODDS_API_KEY not found in environment variables');
    return;
  }
  
  try {
    // Step 1: Get current NFL teams from database
    console.log('📋 Step 1: Fetching current NFL teams from database...');
    const teamsResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getTeams(league: "nfl", season: "2025") {
              id
              name
              odds
            }
          }
        `
      })
    });
    
    const teamsData = await teamsResponse.json();
    if (teamsData.errors) {
      throw new Error(`GraphQL Error: ${JSON.stringify(teamsData.errors)}`);
    }
    
    const dbTeams = teamsData.data?.getTeams || [];
    console.log(`✅ Found ${dbTeams.length} NFL teams in database`);
    
    // Step 2: Fetch live championship odds from API
    console.log('\n🏆 Step 2: Fetching live NFL Super Bowl winner odds...');
    const nflEndpoint = 'americanfootball_nfl_super_bowl_winner';
    const oddsUrl = `${ODDS_API_BASE}/sports/${nflEndpoint}/odds?regions=us&oddsFormat=american&apiKey=${ODDS_API_KEY}`;
    
    const oddsResponse = await fetch(oddsUrl);
    
    if (!oddsResponse.ok) {
      const errorText = await oddsResponse.text();
      throw new Error(`Odds API error: ${oddsResponse.status} - ${errorText}`);
    }
    
    const oddsData = await oddsResponse.json();
    console.log(`✅ Successfully fetched odds data (${oddsData.length} markets)`);
    
    // Step 3: Extract odds from API response
    const apiOddsMap = {};
    
    if (oddsData.length > 0 && oddsData[0].bookmakers && oddsData[0].bookmakers.length > 0) {
      const bookmaker = oddsData[0].bookmakers[0]; // Use first bookmaker
      console.log(`📊 Using odds from: ${bookmaker.title}`);
      
      if (bookmaker.markets && bookmaker.markets.length > 0) {
        const market = bookmaker.markets[0];
        market.outcomes.forEach(outcome => {
          const odds = outcome.price > 0 ? `+${outcome.price}` : `${outcome.price}`;
          apiOddsMap[outcome.name] = odds;
        });
        
        console.log(`✅ Extracted odds for ${Object.keys(apiOddsMap).length} teams`);
      }
    }
    
    if (Object.keys(apiOddsMap).length === 0) {
      console.error('❌ No odds data extracted from API response');
      return;
    }
    
    // Step 4: Update teams with new odds
    console.log('\n🔄 Step 4: Updating teams with fresh championship odds...');
    let updatedCount = 0;
    let failedCount = 0;
    
    for (const dbTeam of dbTeams) {
      try {
        // Find matching odds by name
        let newOdds = null;
        
        // Try exact match first
        if (apiOddsMap[dbTeam.name]) {
          newOdds = apiOddsMap[dbTeam.name];
        } else {
          // Try partial matching
          const apiMatch = Object.keys(apiOddsMap).find(apiName => 
            apiName.toLowerCase().includes(dbTeam.name.toLowerCase()) ||
            dbTeam.name.toLowerCase().includes(apiName.toLowerCase()) ||
            // Check individual words (for teams like "Los Angeles Rams")
            dbTeam.name.split(' ').some(dbWord => 
              apiName.toLowerCase().includes(dbWord.toLowerCase()) && dbWord.length > 3
            )
          );
          
          if (apiMatch) {
            newOdds = apiOddsMap[apiMatch];
          }
        }
        
        if (!newOdds) {
          console.warn(`⚠️ No odds found for: ${dbTeam.name}`);
          failedCount++;
          continue;
        }
        
        // Only update if odds have changed
        if (newOdds === dbTeam.odds) {
          console.log(`➡️ ${dbTeam.name}: ${newOdds} (unchanged)`);
          continue;
        }
        
        console.log(`📈 Updating ${dbTeam.name}: ${dbTeam.odds} → ${newOdds}`);
        
        // Update team odds via GraphQL mutation
        const updateResponse = await fetch(GRAPHQL_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              mutation UpdateTeam($input: UpdateTeamInput!) {
                updateTeam(input: $input) {
                  id
                  name
                  odds
                }
              }
            `,
            variables: {
              input: {
                id: dbTeam.id,
                odds: newOdds
              }
            }
          })
        });
        
        const updateResult = await updateResponse.json();
        if (updateResult.errors) {
          console.error(`❌ Failed to update ${dbTeam.name}:`, updateResult.errors);
          failedCount++;
        } else {
          updatedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Error updating ${dbTeam.name}:`, error.message);
        failedCount++;
      }
    }
    
    console.log(`\n✅ Odds update complete: ${updatedCount} teams updated, ${failedCount} failed`);
    
    // Step 5: Verify updates
    if (updatedCount > 0) {
      console.log('\n🔍 Step 5: Verifying odds updates...');
      const verifyResponse = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '{ getTeams(league: "nfl", season: "2025") { name odds } }'
        })
      });
      
      const verifyData = await verifyResponse.json();
      const updatedTeams = verifyData.data.getTeams
        .filter(team => team.odds && team.odds !== 'null')
        .sort((a, b) => {
          const aOdds = parseInt(a.odds.replace(/[+\-]/g, ''));
          const bOdds = parseInt(b.odds.replace(/[+\-]/g, ''));
          return aOdds - bOdds;
        });
      
      console.log(`✅ Verification: ${updatedTeams.length} teams have championship odds`);
      console.log('🏆 Top 5 Super Bowl favorites:');
      updatedTeams.slice(0, 5).forEach((team, index) => {
        console.log(`  ${index + 1}. ${team.name}: ${team.odds}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error updating NFL odds:', error);
  }
}

// Run the update
if (import.meta.url === `file://${process.argv[1]}`) {
  updateNflOdds()
    .then(() => {
      console.log('\n🎉 NFL championship odds update completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Update failed:', error);
      process.exit(1);
    });
}

export { updateNflOdds };
