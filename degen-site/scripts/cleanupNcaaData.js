#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

// GraphQL endpoint
const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

// Teams that should have 999999 odds (not major teams)
const TEAMS_TO_FIX = [
  'Texas Lutheran',
  'Old Dominion',
  'Missouri Western',
  'Texas State Bobcats',
  'North Texas Mean Green',
  'North Texas',
  'Middle Tennessee Blue Raiders',
  'Arkansas State Red Wolves',
  'Southern Mississippi Golden Eagles',
  'San Diego State Aztecs',
  'Rice Owls',
  'Nevada Wolf Pack',
  'Temple Owls',
  'Florida International Panthers',
  'Kent State Golden Flashes',
  'Central Michigan Chippewas',
  'Kennesaw State Owls',
  'New Mexico State Aggies',
  'Western Michigan Broncos',
  'Tulsa Golden Hurricane',
  'UL Monroe Warhawks',
  'Ball State Cardinals',
  'UTEP Miners',
  'Eastern Michigan Eagles',
  'Miami (OH) RedHawks',
  'Marshall Thundering Herd',
  'Hawaii Rainbow Warriors',
  'Wyoming Cowboys',
  'Georgia Southern Eagles',
  'Florida Atlantic Owls',
  'Coastal Carolina Chanticleers',
  'Charlotte 49ers',
  'Buffalo Bulls',
  'UAB Blazers',
  'Troy Trojans',
  'South Alabama Jaguars',
  'San Jose State Spartans',
  'Sam Houston State Bearkats',
  'Northern Illinois Huskies',
  'Air Force Falcons',
  'Bowling Green Falcons',
  'Toledo Rockets',
  'Army Black Knights',
  'UConn Huskies',
  'Wake Forest Demon Deacons',
  'East Carolina Pirates',
  'Fresno State Bulldogs',
  'Western Kentucky Hilltoppers',
  'Jacksonville State Gamecocks',
  'Liberty Flames',
  'Navy Midshipmen',
  'Northwestern Wildcats',
  'South Florida Bulls',
  'Stanford Cardinal',
  'Appalachian State Mountaineers',
  'Boston College Eagles',
  'UTSA Roadrunners',
  'James Madison Dukes',
  'Mississippi State Bulldogs',
  'Rutgers Scarlet Knights',
  'Georgia State Panthers'
];

// Simple GraphQL client using fetch
async function graphqlRequest(query, variables = {}) {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data;
  } catch (error) {
    throw new Error(`GraphQL request failed: ${error.message}`);
  }
}

// Get existing NCAA teams from GraphQL
async function getExistingNcaaTeams() {
  try {
    const query = `
      query GetNcaaTeams {
        getTeams(league: "ncaa", season: "2025") {
          id
          name
          owner
          odds
          division
        }
      }
    `;
    
    const data = await graphqlRequest(query);
    return data.getTeams || [];
  } catch (error) {
    console.error('❌ Error fetching existing NCAA teams:', error.message);
    return [];
  }
}

// Update team in GraphQL
async function updateTeam(id, updateData) {
  try {
    const mutation = `
      mutation UpdateTeam($input: UpdateTeamInput!) {
        updateTeam(input: $input) {
          id
          name
          owner
          odds
          division
          updatedAt
        }
      }
    `;
    
    const data = await graphqlRequest(mutation, {
      input: {
        id,
        ...updateData
      }
    });
    return data.updateTeam;
  } catch (error) {
    throw new Error(`Failed to update team: ${error.message}`);
  }
}

// Main function
async function main() {
  console.log('🧹 Starting NCAA Football 2025 data cleanup...');

  try {
    // Get existing teams
    const existingTeams = await getExistingNcaaTeams();
    console.log(`📊 Found ${existingTeams.length} existing NCAA teams`);

    // Find teams that need to be fixed
    let fixedCount = 0;
    let errorCount = 0;

    for (const team of existingTeams) {
      try {
        // Check if this team should have 999999 odds
        const shouldFix = TEAMS_TO_FIX.some(fixTeam => 
          team.name.toLowerCase().includes(fixTeam.toLowerCase()) ||
          fixTeam.toLowerCase().includes(team.name.toLowerCase())
        );

        if (shouldFix && team.odds !== '999999') {
          await updateTeam(team.id, {
            odds: '999999'
          });
          console.log(`🔧 Fixed ${team.name} odds to 999999`);
          fixedCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to fix ${team.name}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n✅ NCAA Football 2025 data cleanup complete!');
    console.log(`🔧 Fixed odds for: ${fixedCount} teams`);
    console.log(`❌ Errors: ${errorCount} teams`);
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);

  } catch (error) {
    console.error('❌ Error in main execution:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
