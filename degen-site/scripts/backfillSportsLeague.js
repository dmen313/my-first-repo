/**
 * Script to backfill sportsLeague field for existing teams in DynamoDB
 */

require('dotenv').config();
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const REGION = process.env.REACT_APP_AWS_REGION || 'us-east-1';
const TABLE_NAME = 'sports-hub-teams';

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

// Helper function to determine sportsLeague from league value
function getSportsLeagueFromLeague(league) {
  if (!league) return null;
  const leagueLower = league.toLowerCase();
  
  // NBA teams have "Eastern Conference" or "Western Conference"
  if (leagueLower.includes('conference') && (leagueLower.includes('eastern') || leagueLower.includes('western'))) {
    return 'NBA';
  }
  
  // NFL teams have "AFC" or "NFC"
  if (leagueLower === 'afc' || leagueLower === 'nfc') {
    return 'NFL';
  }
  
  // MLB teams have "American League" or "National League"
  if (leagueLower.includes('league') && (leagueLower.includes('american') || leagueLower.includes('national'))) {
    return 'MLB';
  }
  
  // NCAA teams have "NCAA"
  if (leagueLower === 'ncaa') {
    return 'NCAAF';
  }
  
  return null;
}

async function backfillSportsLeague() {
  console.log('🔄 Backfilling sportsLeague field for all teams in DynamoDB...\n');
  
  try {
    // Scan all teams
    let lastEvaluatedKey = null;
    let totalScanned = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    
    do {
      const scanParams = {
        TableName: TABLE_NAME,
        Limit: 100
      };
      
      if (lastEvaluatedKey) {
        scanParams.ExclusiveStartKey = lastEvaluatedKey;
      }
      
      const scanResult = await docClient.send(new ScanCommand(scanParams));
      const teams = scanResult.Items || [];
      
      for (const team of teams) {
        totalScanned++;
        
        // Skip if sportsLeague is already set
        if (team.sportsLeague) {
          totalSkipped++;
          continue;
        }
        
        // Determine sportsLeague from league
        const sportsLeague = getSportsLeagueFromLeague(team.league);
        
        if (!sportsLeague) {
          console.log(`⚠️  Could not determine sportsLeague for ${team.name} (league: ${team.league})`);
          totalSkipped++;
          continue;
        }
        
        // Update the team
        const updateCommand = new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id: team.id },
          UpdateExpression: 'SET sportsLeague = :sportsLeague, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':sportsLeague': sportsLeague,
            ':updatedAt': new Date().toISOString()
          }
        });
        
        await docClient.send(updateCommand);
        console.log(`✅ Updated ${team.name}: ${team.league} → ${sportsLeague}`);
        totalUpdated++;
      }
      
      lastEvaluatedKey = scanResult.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    console.log(`\n✅ Backfill complete!`);
    console.log(`   - Teams scanned: ${totalScanned}`);
    console.log(`   - Teams updated: ${totalUpdated}`);
    console.log(`   - Teams skipped: ${totalSkipped} (already had sportsLeague or couldn't determine)`);
    
  } catch (error) {
    console.error('❌ Error backfilling sportsLeague:', error);
    if (error.name === 'ResourceNotFoundException') {
      console.error('   The table does not exist. Make sure DynamoDB is set up correctly.');
    }
  }
}

backfillSportsLeague();

