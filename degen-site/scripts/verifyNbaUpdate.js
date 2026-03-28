/**
 * Script to verify NBA team data was updated in DynamoDB
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.REACT_APP_AWS_REGION || 'us-east-1';
const TABLE_NAME = 'sports-hub-teams';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function verifyNbaUpdate() {
  console.log('🔍 Verifying NBA 2025 team data in DynamoDB...\n');
  
  try {
    // Query for NBA 2025 teams
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: {
        '#league': 'league',
        '#season': 'season'
      },
      ExpressionAttributeValues: {
        ':league': 'nba',
        ':season': '2025'
      }
    });
    
    const result = await docClient.send(command);
    const teams = result.Items || [];
    
    console.log(`✅ Found ${teams.length} NBA 2025 teams in DynamoDB\n`);
    
    if (teams.length === 0) {
      console.log('⚠️  No teams found. Make sure teams exist in DynamoDB.');
      return;
    }
    
    // Show sample teams with their records and odds
    console.log('📊 Sample teams (first 5):');
    teams.slice(0, 5).forEach(team => {
      console.log(`   ${team.name}:`);
      console.log(`     - Record: ${team.record || 'N/A'} (${team.wins || 0}-${team.losses || 0})`);
      console.log(`     - Odds: ${team.odds || 'N/A'}`);
      console.log(`     - Games Back: ${team.gamesBack || 'N/A'}`);
      console.log(`     - Updated: ${team.updatedAt || 'N/A'}`);
      console.log('');
    });
    
    // Count teams with updated records
    const teamsWithRecords = teams.filter(t => t.record && t.record !== '0-0' && t.record !== 'N/A');
    const teamsWithOdds = teams.filter(t => t.odds && t.odds !== 'N/A');
    
    console.log(`📈 Summary:`);
    console.log(`   - Teams with records (not 0-0): ${teamsWithRecords.length}/${teams.length}`);
    console.log(`   - Teams with odds: ${teamsWithOdds.length}/${teams.length}`);
    
    if (teamsWithRecords.length === 0) {
      console.log('\n⚠️  WARNING: No teams have updated records. The update may not have completed.');
    } else {
      console.log('\n✅ Teams appear to have updated records!');
    }
    
  } catch (error) {
    console.error('❌ Error verifying NBA update:', error);
    if (error.name === 'ResourceNotFoundException') {
      console.error('   The table or index does not exist. Make sure DynamoDB is set up correctly.');
    }
  }
}

verifyNbaUpdate();

