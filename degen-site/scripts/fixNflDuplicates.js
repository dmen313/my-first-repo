import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

async function fixNflDuplicates() {
  console.log('🔧 Fixing NFL team duplicates...\n');
  
  try {
    // Step 1: Get all NFL teams
    console.log('📋 Step 1: Fetching all NFL teams...');
    const teamsResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getTeams(league: "nfl", season: "2025") {
              id
              name
              league
              division
              wins
              losses
              record
              owner
              odds
              createdAt
            }
          }
        `
      })
    });
    
    const teamsData = await teamsResponse.json();
    const allNflTeams = teamsData.data?.getTeams || [];
    console.log(`✅ Found ${allNflTeams.length} NFL teams`);
    
    // Step 2: Group by team name and find duplicates
    const teamsByName = {};
    allNflTeams.forEach(team => {
      if (!teamsByName[team.name]) {
        teamsByName[team.name] = [];
      }
      teamsByName[team.name].push(team);
    });
    
    console.log('\n📊 Duplicate analysis:');
    let totalDuplicates = 0;
    const teamsToDelete = [];
    
    Object.entries(teamsByName).forEach(([name, teams]) => {
      if (teams.length > 1) {
        console.log(`  ${name}: ${teams.length} copies`);
        totalDuplicates += teams.length - 1;
        
        // Keep the most recent team (by createdAt) or the one with the most data
        const bestTeam = teams.reduce((best, current) => {
          // Prefer teams with owners
          if (current.owner && !best.owner) return current;
          if (best.owner && !current.owner) return best;
          
          // Prefer teams with odds
          if (current.odds && !best.odds) return current;
          if (best.odds && !current.odds) return best;
          
          // Prefer more recent teams
          return new Date(current.createdAt) > new Date(best.createdAt) ? current : best;
        });
        
        // Mark others for deletion
        teams.forEach(team => {
          if (team.id !== bestTeam.id) {
            teamsToDelete.push(team.id);
          }
        });
      }
    });
    
    console.log(`\n🔍 Found ${totalDuplicates} duplicate teams to remove`);
    
    if (teamsToDelete.length === 0) {
      console.log('✅ No duplicates found - database is clean!');
      return;
    }
    
    // Step 3: Delete duplicate teams
    console.log('\n🗑️  Step 3: Removing duplicate teams...');
    let deletedCount = 0;
    
    for (const teamId of teamsToDelete) {
      try {
        const deleteResponse = await fetch(GRAPHQL_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              mutation {
                deleteTeam(id: "${teamId}")
              }
            `
          })
        });
        
        const deleteData = await deleteResponse.json();
        if (deleteData.data?.deleteTeam) {
          deletedCount++;
        } else {
          console.warn(`⚠️ Failed to delete team ${teamId}`);
        }
      } catch (error) {
        console.warn(`⚠️ Error deleting team ${teamId}:`, error.message);
      }
    }
    
    console.log(`✅ Deleted ${deletedCount} duplicate teams`);
    
    // Step 4: Verify cleanup
    console.log('\n🔍 Step 4: Verifying cleanup...');
    const verifyResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getTeams(league: "nfl", season: "2025") {
              id
              name
            }
          }
        `
      })
    });
    
    const verifyData = await verifyResponse.json();
    const remainingTeams = verifyData.data?.getTeams || [];
    const uniqueNames = new Set(remainingTeams.map(t => t.name));
    
    console.log(`✅ Cleanup complete: ${remainingTeams.length} teams remaining`);
    console.log(`✅ Unique team names: ${uniqueNames.size}`);
    
    if (uniqueNames.size === 32 && remainingTeams.length === 32) {
      console.log('🎉 Perfect! All 32 NFL teams are now unique');
    } else if (remainingTeams.length > 32) {
      console.log('⚠️ Still have duplicates - may need to run again');
    } else {
      console.log('⚠️ Missing some teams - may need to recreate');
    }
    
  } catch (error) {
    console.error('❌ Error fixing NFL duplicates:', error);
  }
}

// Run the fix
if (import.meta.url === `file://${process.argv[1]}`) {
  fixNflDuplicates()
    .then(() => {
      console.log('\n🎉 NFL duplicate fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

export { fixNflDuplicates };
