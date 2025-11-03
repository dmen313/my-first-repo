import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const GRAPHQL_ENDPOINT = 'http://localhost:4000/graphql';

// Fetch all teams from GraphQL
async function fetchAllTeams() {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getTeams {
              id
              name
              league
              division
              owner
              record
              wins
              losses
              odds
              createdAt
              updatedAt
            }
          }
        `
      })
    });

    const data = await response.json();
    if (data.errors) {
      throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
    }

    return data.data.getTeams || [];
  } catch (error) {
    console.error('❌ Error fetching teams:', error);
    throw error;
  }
}

// Delete a team by ID
async function deleteTeam(teamId) {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
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

    const data = await response.json();
    if (data.errors) {
      throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
    }

    return data.data.deleteTeam;
  } catch (error) {
    console.error(`❌ Error deleting team ${teamId}:`, error);
    return false;
  }
}

// Score a team based on data completeness
function scoreTeam(team) {
  let score = 0;
  
  // Prefer teams with owners (not null, "NA", or "No Owner")
  if (team.owner && team.owner !== 'NA' && team.owner !== 'No Owner') {
    score += 10;
  }
  
  // Prefer teams with odds
  if (team.odds && team.odds !== 'null') {
    score += 5;
  }
  
  // Prefer teams with better records (more wins)
  if (team.wins > 0) {
    score += team.wins * 0.1;
  }
  
  // Prefer newer teams (more recent createdAt)
  const createdDate = new Date(team.createdAt);
  const daysSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 30 - daysSinceCreated); // Newer teams get higher scores
  
  return score;
}

// Find and group duplicate teams
function findDuplicates(teams) {
  const duplicateGroups = new Map();
  
  teams.forEach(team => {
    // Create a key based on name and league to identify duplicates
    const key = `${team.name.toLowerCase().trim()}|${team.league.toLowerCase().trim()}`;
    
    if (!duplicateGroups.has(key)) {
      duplicateGroups.set(key, []);
    }
    duplicateGroups.get(key).push(team);
  });
  
  // Filter to only groups with duplicates
  const duplicates = Array.from(duplicateGroups.values())
    .filter(group => group.length > 1)
    .map(group => {
      // Sort by score (highest first)
      return group.sort((a, b) => scoreTeam(b) - scoreTeam(a));
    });
  
  return duplicates;
}

// Main cleanup function
async function cleanupDuplicateTeams() {
  console.log('🧹 Starting duplicate team cleanup...\n');
  
  try {
    // Fetch all teams
    console.log('📊 Fetching all teams...');
    const teams = await fetchAllTeams();
    console.log(`✅ Found ${teams.length} total teams\n`);
    
    // Find duplicates
    console.log('🔍 Analyzing duplicates...');
    const duplicateGroups = findDuplicates(teams);
    
    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicates found! Database is clean.');
      return;
    }
    
    console.log(`📋 Found ${duplicateGroups.length} groups of duplicates:\n`);
    
    // Show duplicates and plan
    let totalToDelete = 0;
    duplicateGroups.forEach((group, index) => {
      const keepTeam = group[0];
      const deleteTeams = group.slice(1);
      
      console.log(`${index + 1}. "${keepTeam.name}" (${keepTeam.league})`);
      console.log(`   📊 ${group.length} duplicates found`);
      console.log(`   ✅ KEEP: ID ${keepTeam.id} (Score: ${scoreTeam(keepTeam).toFixed(1)}, Owner: ${keepTeam.owner || 'None'})`);
      
      deleteTeams.forEach(team => {
        console.log(`   ❌ DELETE: ID ${team.id} (Score: ${scoreTeam(team).toFixed(1)}, Owner: ${team.owner || 'None'})`);
      });
      
      totalToDelete += deleteTeams.length;
      console.log('');
    });
    
    console.log(`📈 Summary:`);
    console.log(`   • Total teams: ${teams.length}`);
    console.log(`   • Duplicate groups: ${duplicateGroups.length}`);
    console.log(`   • Teams to delete: ${totalToDelete}`);
    console.log(`   • Teams after cleanup: ${teams.length - totalToDelete}\n`);
    
    // Ask for confirmation (in a real script, you might want to add readline)
    console.log('🚨 PROCEEDING WITH DELETION IN 5 SECONDS...');
    console.log('   Press Ctrl+C to cancel\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Delete duplicates
    console.log('🗑️  Starting deletion process...\n');
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const [groupIndex, group] of duplicateGroups.entries()) {
      const keepTeam = group[0];
      const deleteTeams = group.slice(1);
      
      console.log(`Processing group ${groupIndex + 1}/${duplicateGroups.length}: "${keepTeam.name}"`);
      
      for (const team of deleteTeams) {
        const success = await deleteTeam(team.id);
        if (success) {
          console.log(`   ✅ Deleted: ${team.id}`);
          deletedCount++;
        } else {
          console.log(`   ❌ Failed to delete: ${team.id}`);
          errorCount++;
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('\n🎉 Cleanup completed!');
    console.log(`   ✅ Successfully deleted: ${deletedCount} teams`);
    console.log(`   ❌ Failed to delete: ${errorCount} teams`);
    console.log(`   📊 Final team count: ${teams.length - deletedCount}`);
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some deletions failed. You may want to run the script again.');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDuplicateTeams()
    .then(() => {
      console.log('\n✅ Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { cleanupDuplicateTeams };
