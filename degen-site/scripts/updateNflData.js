import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function updateNflData() {
  console.log('🏈 Updating NFL data from API...\n');
  
  try {
    // Step 1: Get current NFL teams from GraphQL
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
              record
              wins
              losses
              odds
              owner
            }
          }
        `
      })
    });
    
    const teamsData = await teamsResponse.json();
    if (teamsData.errors) {
      throw new Error(`GraphQL Error: ${JSON.stringify(teamsData.errors)}`);
    }
    
    const teams = teamsData.data?.getTeams || [];
    console.log(`✅ Found ${teams.length} NFL teams in database`);
    
    if (teams.length === 0) {
      console.log('⚠️ No NFL teams found in database. Make sure teams are populated first.');
      return;
    }
    
    // Step 2: Fetch fresh API data using the sportsApi function
    console.log('\n📡 Step 2: Fetching fresh NFL data from API...');
    
    // Import the getCurrentStandings function (with proper error handling)
    let getCurrentStandings;
    try {
      const sportsApiModule = await import('../src/services/sportsApi.js');
      getCurrentStandings = sportsApiModule.getCurrentStandings;
    } catch (error) {
      console.error('❌ Error importing sportsApi:', error.message);
      console.log('🔄 Falling back to direct API calls...');
      
      // Fallback: Call NFL API directly
      const apiData = await fetchNflDataDirect();
      if (apiData) {
        await updateTeamsWithApiData(teams, apiData.teams);
      }
      return;
    }
    
    const apiResult = await getCurrentStandings('nfl-2025');
    
    if (!apiResult || !apiResult.teams) {
      console.error('❌ No API data received');
      return;
    }
    
    console.log(`✅ Fetched ${apiResult.teams.length} teams from NFL API`);
    console.log('📊 API Metadata:', JSON.stringify(apiResult.metadata, null, 2));
    
    // Step 3: Update teams with fresh API data
    console.log('\n🔄 Step 3: Updating teams with fresh API data...');
    await updateTeamsWithApiData(teams, apiResult.teams);
    
  } catch (error) {
    console.error('❌ Error updating NFL data:', error);
  }
}

async function updateTeamsWithApiData(dbTeams, apiTeams) {
  let updatedCount = 0;
  let failedCount = 0;
  
  for (const dbTeam of dbTeams) {
    try {
      // Find matching API team by name
      const apiTeam = apiTeams.find(api => 
        api.name === dbTeam.name || 
        api.name.toLowerCase() === dbTeam.name.toLowerCase() ||
        dbTeam.name.toLowerCase().includes(api.name.toLowerCase()) ||
        api.name.toLowerCase().includes(dbTeam.name.toLowerCase())
      );
      
      if (!apiTeam) {
        console.warn(`⚠️ No API match found for: ${dbTeam.name}`);
        failedCount++;
        continue;
      }
      
      // Prepare update data
      const updateData = {
        record: apiTeam.record || dbTeam.record,
        wins: apiTeam.wins || dbTeam.wins,
        losses: apiTeam.losses || dbTeam.losses,
        odds: apiTeam.odds || dbTeam.odds
      };
      
      console.log(`📡 Updating ${dbTeam.name}: ${updateData.record} (${updateData.wins}-${updateData.losses}) - Odds: ${updateData.odds}`);
      
      // Update team via GraphQL mutation
      const updateResponse = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation UpdateTeam($input: UpdateTeamInput!) {
              updateTeam(input: $input) {
                id
                name
                record
                wins
                losses
                odds
              }
            }
          `,
          variables: {
            input: {
              id: dbTeam.id,
              ...updateData
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
  
  console.log(`\n✅ Update complete: ${updatedCount} teams updated, ${failedCount} failed`);
}

// Fallback function to call NFL API directly
async function fetchNflDataDirect() {
  const NFL_API_BASE = 'https://nfl-api-data.p.rapidapi.com';
  const NFL_API_KEY = process.env.REACT_APP_NFL_API_KEY;
  
  if (!NFL_API_KEY) {
    console.error('❌ NFL_API_KEY not found');
    return null;
  }
  
  try {
    console.log('📋 Fetching NFL teams directly from API...');
    
    // Fetch team listing
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
    console.log(`✅ Fetched ${teamsData.length} teams from NFL API`);
    
    // Fetch records for each team
    const teams = [];
    const currentYear = new Date().getFullYear();
    const year = currentYear - 1; // Use 2024 for current standings
    
    for (const teamItem of teamsData.slice(0, 5)) { // Limit to first 5 for testing
      const team = teamItem.team;
      if (!team || !team.id) continue;
      
      try {
        console.log(`📈 Fetching record for ${team.displayName}...`);
        
        const recordResponse = await fetch(`${NFL_API_BASE}/nfl-team-record?id=${team.id}&year=${year}`, {
          headers: {
            'x-rapidapi-host': 'nfl-api-data.p.rapidapi.com',
            'x-rapidapi-key': NFL_API_KEY
          }
        });
        
        let wins = 0, losses = 0, record = '0-0';
        
        if (recordResponse.ok) {
          const recordData = await recordResponse.json();
          
          if (recordData && recordData.items && Array.isArray(recordData.items)) {
            const overallRecord = recordData.items.find(item => item.name === 'overall');
            if (overallRecord && overallRecord.summary) {
              const recordParts = overallRecord.summary.split('-');
              if (recordParts.length >= 2) {
                wins = parseInt(recordParts[0]) || 0;
                losses = parseInt(recordParts[1]) || 0;
                record = overallRecord.summary;
              }
            }
          }
        }
        
        teams.push({
          name: team.displayName,
          record,
          wins,
          losses,
          odds: null // Would need odds API for this
        });
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`⚠️ Error fetching record for ${team.displayName}:`, error.message);
      }
    }
    
    return { teams };
    
  } catch (error) {
    console.error('❌ Error in direct NFL API call:', error);
    return null;
  }
}

// Run the update
if (import.meta.url === `file://${process.argv[1]}`) {
  updateNflData()
    .then(() => {
      console.log('\n🎉 NFL data update completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Update failed:', error);
      process.exit(1);
    });
}

export { updateNflData };
