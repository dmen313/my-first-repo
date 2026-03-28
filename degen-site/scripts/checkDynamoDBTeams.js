/**
 * Script to check what teams exist in DynamoDB
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.REACT_APP_AWS_REGION || 'us-east-1';
const TABLE_NAME = 'sports-hub-teams';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function checkDynamoDBTeams() {
  console.log('🔍 Checking all teams in DynamoDB...\n');
  
  try {
    // Scan all teams
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      Limit: 100
    });
    
    const result = await docClient.send(command);
    const teams = result.Items || [];
    
    console.log(`✅ Found ${teams.length} total teams in DynamoDB\n`);
    
    if (teams.length === 0) {
      console.log('⚠️  No teams found in DynamoDB.');
      return;
    }
    
    // Group by league and season
    const byLeague = {};
    teams.forEach(team => {
      const league = team.league || 'unknown';
      const season = team.season || 'null';
      const key = `${league}-${season}`;
      if (!byLeague[key]) {
        byLeague[key] = [];
      }
      byLeague[key].push(team);
    });
    
    console.log('📊 Teams by league and season:');
    Object.keys(byLeague).sort().forEach(key => {
      const teamsInGroup = byLeague[key];
      console.log(`   ${key}: ${teamsInGroup.length} teams`);
      
      // Show sample team
      if (teamsInGroup.length > 0) {
        const sample = teamsInGroup[0];
        console.log(`      Sample: ${sample.name} (record: ${sample.record || 'N/A'}, odds: ${sample.odds || 'N/A'})`);
      }
    });
    
    // Check for NBA teams specifically
    const nbaTeams = teams.filter(t => 
      t.league && t.league.toLowerCase().includes('conference') ||
      (t.name && (t.name.includes('Lakers') || t.name.includes('Celtics') || t.name.includes('Warriors')))
    );
    
    if (nbaTeams.length > 0) {
      console.log(`\n🏀 Found ${nbaTeams.length} potential NBA teams:`);
      nbaTeams.slice(0, 5).forEach(team => {
        console.log(`   ${team.name} - league: ${team.league}, season: ${team.season || 'null'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking DynamoDB teams:', error);
    if (error.name === 'ResourceNotFoundException') {
      console.error('   The table does not exist. Make sure DynamoDB is set up correctly.');
    }
  }
}

checkDynamoDBTeams();

