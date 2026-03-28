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
  draftPicks: 'sports-hub-draft-picks',
  draftPickDeletions: 'sports-hub-draft-pick-deletions',
  draftStatuses: 'sports-hub-draft-statuses',
  updateStatuses: 'sports-hub-update-statuses'
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
    
    const leagueLower = league?.toLowerCase() || '';
    
    // NHL and NFL-MVP use sportsLeague field, not league field - need to scan
    if (leagueLower === 'nhl' || leagueLower === 'nfl-mvp') {
      const sportsLeagueValue = leagueLower === 'nhl' ? 'NHL' : 'NFL-MVP';
      const scanCommand = new ScanCommand({
        TableName: TABLES.teams,
        FilterExpression: '#season = :season AND #sportsLeague = :sportsLeague',
        ExpressionAttributeNames: {
          '#season': 'season',
          '#sportsLeague': 'sportsLeague'
        },
        ExpressionAttributeValues: {
          ':season': season,
          ':sportsLeague': sportsLeagueValue
        }
      });
      const result = await docClient.send(scanCommand);
      return result.Items || [];
    }
    
    // Use GSI to query by league and season for other leagues
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
        if (leagueLower === 'nba' && (season === '2024' || season === '2025')) {
          return seasonMatches && team.league && team.league.toLowerCase().includes('conference');
        }
        // MLB teams have league like "American League" or "National League"  
        if (leagueLower === 'mlb' && (season === '2024' || season === '2025')) {
          return seasonMatches && team.league && team.league.toLowerCase().includes('league') && !team.league.toLowerCase().includes('conference');
        }
        // NFL teams have league like "AFC" or "NFC"
        if (leagueLower === 'nfl' && season === '2025') {
          return seasonMatches && (team.league?.toLowerCase() === 'afc' || team.league?.toLowerCase() === 'nfc');
        }
        // NCAA teams have league "NCAA"
        if (leagueLower === 'ncaa' && season === '2025') {
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
    
    // First, get the pick details before deleting (for logging)
    const getCommand = new GetCommand({
      TableName: TABLES.draftPicks,
      Key: { id }
    });
    const pickData = await docClient.send(getCommand);
    
    if (!pickData.Item) {
      throw new Error(`Draft pick with id ${id} not found`);
    }
    
    // Delete the pick
    const deleteCommand = new DeleteCommand({
      TableName: TABLES.draftPicks,
      Key: { id }
    });
    await docClient.send(deleteCommand);
    
    // Log the deletion
    try {
      await this.logDraftPickDeletion(pickData.Item);
    } catch (logError) {
      console.error('Error logging draft pick deletion:', logError);
      // Don't throw - deletion succeeded, logging is secondary
    }
    
    return true;
  }

  async logDraftPickDeletion(pickData) {
    await this.ensureInitialized();
    
    // Get current user info for logging (if available in Lambda context)
    let deletedBy = 'system';
    try {
      // In Lambda, we might have user info from the event context
      // For now, use 'system' as default
      if (process.env.USERNAME) {
        deletedBy = process.env.USERNAME;
      }
    } catch (err) {
      console.warn('Could not get user info for deletion log:', err);
    }
    
    // Generate UUID - use crypto.randomUUID if available, otherwise fallback
    const generateId = () => {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
      }
      return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };
    
    const logEntry = {
      id: generateId(),
      deletedPickId: pickData.id,
      league: pickData.league,
      season: pickData.season,
      round: pickData.round,
      pickNumber: pickData.pickNumber,
      owner: pickData.owner,
      teamId: pickData.teamId || null,
      teamName: pickData.teamName || null,
      deletedBy: deletedBy,
      deletedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    const command = new PutCommand({
      TableName: TABLES.draftPickDeletions,
      Item: logEntry
    });
    
    await docClient.send(command);
    return logEntry;
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

  // Draft Status operations
  async getDraftStatus(league, season) {
    await this.ensureInitialized();
    console.log('🔍 DynamoDB: getDraftStatus', { league, season });
    
    try {
      const command = new QueryCommand({
        TableName: TABLES.draftStatuses,
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
      const status = result.Items?.[0] || null;
      console.log('✅ DynamoDB: getDraftStatus result', status ? { id: status.id, status: status.status } : 'null');
      return status;
    } catch (error) {
      console.error('❌ DynamoDB: Error getting draft status:', error);
      throw error;
    }
  }

  async getAllDraftStatuses() {
    await this.ensureInitialized();
    console.log('🔍 DynamoDB: getAllDraftStatuses');
    
    try {
      const command = new ScanCommand({
        TableName: TABLES.draftStatuses
      });
      
      const result = await docClient.send(command);
      const statuses = result.Items || [];
      console.log(`✅ DynamoDB: getAllDraftStatuses returned ${statuses.length} statuses`);
      return statuses;
    } catch (error) {
      console.error('❌ DynamoDB: Error getting all draft statuses:', error);
      throw error;
    }
  }

  async updateDraftStatus(league, season, status) {
    await this.ensureInitialized();
    console.log('🔄 DynamoDB: updateDraftStatus', { league, season, status });
    
    try {
      // First, try to get existing status
      const existing = await this.getDraftStatus(league, season);
      
      if (existing) {
        // Update existing status
        const command = new UpdateCommand({
          TableName: TABLES.draftStatuses,
          Key: { id: existing.id },
          UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#updatedAt': 'updatedAt'
          },
          ExpressionAttributeValues: {
            ':status': status,
            ':updatedAt': new Date().toISOString()
          },
          ReturnValues: 'ALL_NEW'
        });
        
        const result = await docClient.send(command);
        console.log('✅ DynamoDB: Draft status updated', result.Attributes);
        return result.Attributes;
      } else {
        // Create new status
        const generateId = () => {
          if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
          }
          return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        };
        
        const newStatus = {
          id: generateId(),
          league,
          season,
          status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        const command = new PutCommand({
          TableName: TABLES.draftStatuses,
          Item: newStatus
        });
        
        await docClient.send(command);
        console.log('✅ DynamoDB: Draft status created', newStatus);
        return newStatus;
      }
    } catch (error) {
      console.error('❌ DynamoDB: Error updating draft status:', error);
      throw error;
    }
  }

  // Update Status methods (for async operations)
  async createUpdateStatus(updateStatus) {
    await this.ensureInitialized();
    console.log('💾 DynamoDB: createUpdateStatus', { id: updateStatus.id, type: updateStatus.updateType });
    
    try {
      const command = new PutCommand({
        TableName: TABLES.updateStatuses,
        Item: updateStatus
      });
      
      await docClient.send(command);
      console.log('✅ DynamoDB: Update status created', updateStatus.id);
      return updateStatus;
    } catch (error) {
      console.error('❌ DynamoDB: Error creating update status:', error);
      throw error;
    }
  }

  async getUpdateStatus(id) {
    await this.ensureInitialized();
    console.log('🔍 DynamoDB: getUpdateStatus', { id });
    
    try {
      const command = new GetCommand({
        TableName: TABLES.updateStatuses,
        Key: { id }
      });
      
      const result = await docClient.send(command);
      return result.Item || null;
    } catch (error) {
      console.error('❌ DynamoDB: Error getting update status:', error);
      throw error;
    }
  }

  async updateUpdateStatus(id, updates) {
    await this.ensureInitialized();
    console.log('🔄 DynamoDB: updateUpdateStatus', { id, updates });
    
    try {
      // Build update expression dynamically
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
      
      // Always update the updatedAt timestamp
      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();
      
      const command = new UpdateCommand({
        TableName: TABLES.updateStatuses,
        Key: { id },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW'
      });
      
      const result = await docClient.send(command);
      console.log('✅ DynamoDB: Update status updated', result.Attributes?.id);
      return result.Attributes;
    } catch (error) {
      console.error('❌ DynamoDB: Error updating update status:', error);
      throw error;
    }
  }

  async getActiveUpdates(league, season) {
    await this.ensureInitialized();
    console.log('🔍 DynamoDB: getActiveUpdates', { league, season });
    
    try {
      const command = new ScanCommand({
        TableName: TABLES.updateStatuses,
        FilterExpression: '#status = :inProgress OR #status = :pending',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':inProgress': 'in_progress',
          ':pending': 'pending'
        }
      });
      
      if (league) {
        command.input.FilterExpression += ' AND #league = :league';
        command.input.ExpressionAttributeNames['#league'] = 'league';
        command.input.ExpressionAttributeValues[':league'] = league;
      }
      
      if (season) {
        command.input.FilterExpression += ' AND #season = :season';
        command.input.ExpressionAttributeNames['#season'] = 'season';
        command.input.ExpressionAttributeValues[':season'] = season;
      }
      
      const result = await docClient.send(command);
      return result.Items || [];
    } catch (error) {
      console.error('❌ DynamoDB: Error getting active updates:', error);
      throw error;
    }
  }
}

export { DynamoDBAdapter };

