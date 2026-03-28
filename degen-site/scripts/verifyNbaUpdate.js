/**
 * Script to verify NBA team data was updated in DynamoDB
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.REACT_APP_AWS_REGION || 'us-east-1';
const TABLE_NAME = 'sports-hub-teams';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

async function verifyNbaUpdate() {
  console.log('🔍 Verifying NBA 2025 team data in DynamoDB...\n');
  
  try {
    // NBA rows use league = Eastern/Western Conference + sportsLeague = NBA (not league = "nba")
    const scanParams = {
      TableName: TABLE_NAME,
      FilterExpression: '#season = :season AND #sportsLeague = :sportsLeague',
      ExpressionAttributeNames: {
        '#season': 'season',
        '#sportsLeague': 'sportsLeague'
      },
      ExpressionAttributeValues: {
        ':season': '2025',
        ':sportsLeague': 'NBA'
      }
    };
    const teams = [];
    let lastKey;
    do {
      const result = await docClient.send(new ScanCommand({ ...scanParams, ExclusiveStartKey: lastKey }));
      teams.push(...(result.Items || []));
      lastKey = result.LastEvaluatedKey;
    } while (lastKey);
    
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

