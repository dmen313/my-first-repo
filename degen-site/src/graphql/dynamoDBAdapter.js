/**
 * DynamoDB Adapter for DataStore
 * Provides DynamoDB-backed storage instead of file-based storage
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  QueryCommand, 
  ScanCommand, 
  DeleteCommand,
  UpdateCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';

// Get region from environment (Lambda sets AWS_REGION automatically)
const REGION = process.env.AWS_REGION || process.env.REGION || 'us-east-1';

const client = new DynamoDBClient({ 
  region: REGION 
});

const docClient = DynamoDBDocumentClient.from(client);

const TABLES = {
  teams: 'sports-hub-teams',
  achievements: 'sports-hub-achievements',
  payouts: 'sports-hub-payouts',
  leagueSettings: 'sports-hub-league-settings',
  teamMappings: 'sports-hub-team-mappings',
  owners: 'sports-hub-owners',
  draftPicks: 'sports-hub-draft-picks'
};

class DynamoDBAdapter {
  constructor() {
    this.initialized = false;
  }

  async ensureInitialized() {
    if (!this.initialized) {
      this.initialized = true;
      console.log('✅ DynamoDB adapter initialized');
    }
  }

  // Teams operations
  async getAllTeams() {
    await this.ensureInitialized();
    const command = new ScanCommand({
      TableName: TABLES.teams
    });
    const result = await docClient.send(command);
    return result.Items || [];
  }

  async getTeamsByLeague(league, season) {
    await this.ensureInitialized();
    
    // Use GSI to query by league and season
    const command = new QueryCommand({
      TableName: TABLES.teams,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: {
        '#league': 'league',
        '#season': 'season'
      },
      ExpressionAttributeValues: {
        ':league': league,
        ':season': season
      }
    });
    
    const result = await docClient.send(command);
    let teams = result.Items || [];
    
    // Apply same filtering logic as file-based store
    if (league && season) {
      teams = teams.filter(team => {
        const seasonMatches = team.season === season;
        
        // NBA teams have league like "Eastern Conference" or "Western Conference"
        if (league.toLowerCase() === 'nba' && (season === '2024' || season === '2025')) {
          return seasonMatches && team.league && team.league.toLowerCase().includes('conference');
        }
        // MLB teams have league like "American League" or "National League"  
        if (league.toLowerCase() === 'mlb' && (season === '2024' || season === '2025')) {
          return seasonMatches && team.league && team.league.toLowerCase().includes('league') && !team.league.toLowerCase().includes('conference');
        }
        // NFL teams have league like "AFC" or "NFC"
        if (league.toLowerCase() === 'nfl' && season === '2025') {
          return seasonMatches && (team.league?.toLowerCase() === 'afc' || team.league?.toLowerCase() === 'nfc');
        }
        // NCAA teams have league "NCAA"
        if (league.toLowerCase() === 'ncaa' && season === '2025') {
          return seasonMatches && team.league?.toLowerCase() === 'ncaa';
        }
        return seasonMatches;
      });
    }
    
    return teams;
  }

  async getTeam(id) {
    await this.ensureInitialized();
    const command = new GetCommand({
      TableName: TABLES.teams,
      Key: { id }
    });
    const result = await docClient.send(command);
    return result.Item || null;
  }

  async createTeam(team) {
    await this.ensureInitialized();
    const command = new PutCommand({
      TableName: TABLES.teams,
      Item: team
    });
    await docClient.send(command);
    return team;
  }

  async updateTeam(id, updates) {
    await this.ensureInitialized();
    
    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    Object.keys(updates).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updates[key];
    });
    
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    updateExpressions.push('#updatedAt = :updatedAt');
    
    const command = new UpdateCommand({
      TableName: TABLES.teams,
      Key: { id },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });
    
    const result = await docClient.send(command);
    return result.Attributes;
  }

  async deleteTeam(id) {
    await this.ensureInitialized();
    const command = new DeleteCommand({
      TableName: TABLES.teams,
      Key: { id }
    });
    await docClient.send(command);
    return true;
  }

  // Achievements operations
  async getAchievementsByTeam(teamId) {
    await this.ensureInitialized();
    const command = new QueryCommand({
      TableName: TABLES.achievements,
      IndexName: 'teamId-index',
      KeyConditionExpression: 'teamId = :teamId',
      ExpressionAttributeValues: {
        ':teamId': teamId
      }
    });
    const result = await docClient.send(command);
    return result.Items || [];
  }

  async createAchievement(achievement) {
    await this.ensureInitialized();
    const command = new PutCommand({
      TableName: TABLES.achievements,
      Item: achievement
    });
    await docClient.send(command);
    return achievement;
  }

  // Payouts operations
  async getPayoutRows(league, season) {
    await this.ensureInitialized();
    const command = new QueryCommand({
      TableName: TABLES.payouts,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: {
        '#league': 'league',
        '#season': 'season'
      },
      ExpressionAttributeValues: {
        ':league': league,
        ':season': season
      }
    });
    const result = await docClient.send(command);
    return result.Items || [];
  }

  async createPayoutRow(payout) {
    await this.ensureInitialized();
    const command = new PutCommand({
      TableName: TABLES.payouts,
      Item: payout
    });
    await docClient.send(command);
    return payout;
  }

  // League Settings operations
  async getLeagueSettings(league, season) {
    await this.ensureInitialized();
    const command = new QueryCommand({
      TableName: TABLES.leagueSettings,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: {
        '#league': 'league',
        '#season': 'season'
      },
      ExpressionAttributeValues: {
        ':league': league,
        ':season': season
      }
    });
    const result = await docClient.send(command);
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  }

  async createLeagueSetting(setting) {
    await this.ensureInitialized();
    const command = new PutCommand({
      TableName: TABLES.leagueSettings,
      Item: setting
    });
    await docClient.send(command);
    return setting;
  }

  // Owners operations
  async getAllOwners() {
    await this.ensureInitialized();
    const command = new ScanCommand({
      TableName: TABLES.owners
    });
    const result = await docClient.send(command);
    return result.Items || [];
  }

  async createOwner(owner) {
    await this.ensureInitialized();
    const command = new PutCommand({
      TableName: TABLES.owners,
      Item: owner
    });
    await docClient.send(command);
    return owner;
  }

  // Draft Picks operations
  async getDraftPicks(league, season) {
    await this.ensureInitialized();
    const command = new QueryCommand({
      TableName: TABLES.draftPicks,
      IndexName: 'league-season-index',
      KeyConditionExpression: '#league = :league AND #season = :season',
      ExpressionAttributeNames: {
        '#league': 'league',
        '#season': 'season'
      },
      ExpressionAttributeValues: {
        ':league': league,
        ':season': season
      }
    });
    const result = await docClient.send(command);
    return result.Items || [];
  }

  async getDraftPick(id) {
    await this.ensureInitialized();
    const command = new GetCommand({
      TableName: TABLES.draftPicks,
      Key: { id }
    });
    const result = await docClient.send(command);
    return result.Item || null;
  }

  async createDraftPick(pick) {
    await this.ensureInitialized();
    const command = new PutCommand({
      TableName: TABLES.draftPicks,
      Item: pick
    });
    await docClient.send(command);
    return pick;
  }

  async updateDraftPick(id, updates) {
    await this.ensureInitialized();
    
    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    Object.keys(updates).forEach((key, index) => {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updates[key];
    });
    
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    updateExpressions.push('#updatedAt = :updatedAt');
    
    const command = new UpdateCommand({
      TableName: TABLES.draftPicks,
      Key: { id },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    });
    
    const result = await docClient.send(command);
    return result.Attributes;
  }

  async deleteDraftPick(id) {
    await this.ensureInitialized();
    const command = new DeleteCommand({
      TableName: TABLES.draftPicks,
      Key: { id }
    });
    await docClient.send(command);
    return true;
  }

  // Team Mappings operations
  async getAllTeamMappings() {
    await this.ensureInitialized();
    const command = new ScanCommand({
      TableName: TABLES.teamMappings
    });
    const result = await docClient.send(command);
    return result.Items || [];
  }

  async createTeamMapping(mapping) {
    await this.ensureInitialized();
    const command = new PutCommand({
      TableName: TABLES.teamMappings,
      Item: mapping
    });
    await docClient.send(command);
    return mapping;
  }
}

export { DynamoDBAdapter };

