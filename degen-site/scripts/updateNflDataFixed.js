import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const NFL_API_BASE = 'https://nfl-api-data.p.rapidapi.com';
const NFL_API_KEY = process.env.REACT_APP_NFL_API_KEY;
const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function updateNflDataFixed() {
  console.log('🏈 Updating NFL data with improved matching...\n');
  
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
    
    const dbTeams = teamsData.data?.getTeams || [];
    console.log(`✅ Found ${dbTeams.length} NFL teams in database`);
    
    if (dbTeams.length === 0) {
      console.log('⚠️ No NFL teams found in database.');
      return;
    }
    
    // Step 2: Fetch ALL NFL teams and their records from API
    console.log('\n📡 Step 2: Fetching ALL NFL teams and records from API...');
    
    // Get team listing
    const teamsApiResponse = await fetch(`${NFL_API_BASE}/nfl-team-listing/v1/data`, {
      headers: {
        'x-rapidapi-host': 'nfl-api-data.p.rapidapi.com',
        'x-rapidapi-key': NFL_API_KEY
      }
    });
    
    if (!teamsApiResponse.ok) {
      throw new Error(`Teams API failed: ${teamsApiResponse.status}`);
    }
    
    const apiTeamsData = await teamsApiResponse.json();
    console.log(`✅ Fetched ${apiTeamsData.length} teams from NFL API`);
    
    // Step 3: Fetch records for ALL teams
    console.log('\n📈 Step 3: Fetching records for all teams...');
    const currentYear = new Date().getFullYear();
    const year = currentYear; // Use 2025 for current standings
    
    const apiTeamsWithRecords = [];
    
    for (const teamItem of apiTeamsData) {
      const team = teamItem.team;
      if (!team || !team.id) continue;
      
      try {
        console.log(`📊 Fetching record for ${team.displayName}...`);
        
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
        } else {
          console.warn(`⚠️ Failed to get record for ${team.displayName}: ${recordResponse.status}`);
        }
        
        apiTeamsWithRecords.push({
          name: team.displayName,
          record,
          wins,
          losses,
          odds: null // We'll get odds separately if needed
        });
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.warn(`⚠️ Error fetching record for ${team.displayName}:`, error.message);
      }
    }
    
    console.log(`✅ Successfully fetched records for ${apiTeamsWithRecords.length} teams`);
    
    // Step 4: Update teams with perfect name matching
    console.log('\n🔄 Step 4: Updating teams with API data...');
    let updatedCount = 0;
    let failedCount = 0;
    
    for (const dbTeam of dbTeams) {
      try {
        // Find exact match by name
        const apiTeam = apiTeamsWithRecords.find(api => api.name === dbTeam.name);
        
        if (!apiTeam) {
          console.warn(`⚠️ No API match found for: "${dbTeam.name}"`);
          console.log(`   Available API names: ${apiTeamsWithRecords.map(t => `"${t.name}"`).slice(0, 3).join(', ')}...`);
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
        
        console.log(`📡 Updating ${dbTeam.name}: ${updateData.record} (${updateData.wins}-${updateData.losses})`);
        
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
    
    // Step 5: Verify updates
    if (updatedCount > 0) {
      console.log('\n🔍 Step 5: Verifying updates...');
      const verifyResponse = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: '{ getTeams(league: "nfl", season: "2025") { name record wins losses } }'
        })
      });
      
      const verifyData = await verifyResponse.json();
      const updatedTeams = verifyData.data.getTeams.filter(team => 
        team.record !== '0-0' && team.wins > 0
      );
      
      console.log(`✅ Verification: ${updatedTeams.length} teams have updated records`);
      console.log('📊 Sample updated teams:');
      updatedTeams.slice(0, 5).forEach(team => {
        console.log(`  - ${team.name}: ${team.record} (${team.wins}-${team.losses})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error updating NFL data:', error);
  }
}

// Run the update
if (import.meta.url === `file://${process.argv[1]}`) {
  updateNflDataFixed()
    .then(() => {
      console.log('\n🎉 NFL data update completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Update failed:', error);
      process.exit(1);
    });
}

export { updateNflDataFixed };
