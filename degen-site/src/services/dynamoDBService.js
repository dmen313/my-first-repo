/**
 * Direct DynamoDB access service for frontend
 * Replaces GraphQL layer with direct DynamoDB calls
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';

const REGION = process.env.REACT_APP_AWS_REGION || 'us-east-1';
const IDENTITY_POOL_ID = process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID;
const USER_POOL_ID = process.env.REACT_APP_COGNITO_USER_POOL_ID || 'us-east-1_MI78r8fcJ';

// Initialize DynamoDB client with Cognito credentials
let docClient = null;
let clientInitPromise = null;
let cachedIdToken = null;

// Pre-initialize the client on module load for faster first request
async function getDynamoDBClient() {
  // Return existing client if available
  if (docClient) return docClient;
  
  // If initialization is in progress, wait for it
  if (clientInitPromise) return clientInitPromise;
  
  // Start initialization
  clientInitPromise = initializeDynamoDBClient();
  return clientInitPromise;
}

async function initializeDynamoDBClient() {
  try {
    // Get the ID token from Cognito User Pool (cache it)
    if (!cachedIdToken) {
      try {
        const { getCurrentUser } = await import('./authService.js');
        const user = await getCurrentUser();
        if (user && user.session) {
          cachedIdToken = user.session.getIdToken().getJwtToken();
        }
      } catch (err) {
        console.warn('Could not get Cognito token:', err);
      }
    }

    // Configure credentials provider - with validation
    let credentialsProvider = undefined;
    
    if (IDENTITY_POOL_ID) {
      try {
        const USER_POOL_REGION = USER_POOL_ID.split('_')[0] || REGION;
        const cognitoIdentityClient = new CognitoIdentityClient({ region: REGION });
        
        credentialsProvider = fromCognitoIdentityPool({
          client: cognitoIdentityClient,
          identityPoolId: IDENTITY_POOL_ID,
          logins: cachedIdToken
            ? {
                [`cognito-idp.${USER_POOL_REGION}.amazonaws.com/${USER_POOL_ID}`]: cachedIdToken,
              }
            : undefined,
        });
        
        // Test the credentials by calling them once
        await credentialsProvider();
        console.log('✅ Cognito Identity Pool credentials configured successfully');
      } catch (credError) {
        console.warn('⚠️ Cognito Identity Pool error, falling back to default credentials:', credError.message);
        credentialsProvider = undefined;
      }
    }

    const client = new DynamoDBClient({
      region: REGION,
      credentials: credentialsProvider,
    });

    docClient = DynamoDBDocumentClient.from(client);
    return docClient;
  } catch (error) {
    console.error('Error initializing DynamoDB client:', error);
    // Fallback to default credentials (will fail if no credentials available)
    const client = new DynamoDBClient({ region: REGION });
    docClient = DynamoDBDocumentClient.from(client);
    return docClient;
  }
}

// Pre-initialize the client - call this early in app lifecycle
export const preInitializeDynamoDBClient = () => {
  if (!docClient && !clientInitPromise) {
    clientInitPromise = initializeDynamoDBClient();
  }
  return clientInitPromise;
};

// Clear cached credentials (call on logout)
export const clearDynamoDBClientCache = () => {
  docClient = null;
  clientInitPromise = null;
  cachedIdToken = null;
};

const TABLES = {
  teams: 'sports-hub-teams',
  achievements: 'sports-hub-achievements',
  payouts: 'sports-hub-payouts',
  leagueSettings: 'sports-hub-league-settings',
  teamMappings: 'sports-hub-team-mappings',
  owners: 'sports-hub-owners',
  draftPicks: 'sports-hub-draft-picks',
  draftPickDeletions: 'sports-hub-draft-pick-deletions',
  activityLogs: 'sports-hub-activity-logs',
  draftStatuses: 'sports-hub-draft-statuses',
  draftAccess: 'sports-hub-draft-access',
  ncaaTourneyGames: 'sports-hub-ncaa-tourney-games',
  userPreferences: 'sports-hub-user-preferences'
};

// Team operations
export const getTeams = async (league, season) => {
  const client = await getDynamoDBClient();
  
  if (league && season) {
    const leagueLower = league.toLowerCase();
    let filterExpression = '#season = :season';
    const expressionAttributeNames = {
      '#season': 'season'
    };
    const expressionAttributeValues = {
      ':season': season
    };

    if (leagueLower === 'nba') {
      // NBA teams have sportsLeague = 'NBA' and league like "Eastern Conference" or "Western Conference"
      expressionAttributeNames['#sportsLeague'] = 'sportsLeague';
      filterExpression += ' AND #sportsLeague = :sportsLeague';
      expressionAttributeValues[':sportsLeague'] = 'NBA';
    } else if (leagueLower === 'mlb') {
      // MLB teams have league like "American League" or "National League"
      expressionAttributeNames['#league'] = 'league';
      filterExpression += ' AND contains(#league, :leagueVal) AND NOT contains(#league, :conference)';
      expressionAttributeValues[':leagueVal'] = 'League';
      expressionAttributeValues[':conference'] = 'Conference';
    } else if (leagueLower === 'nfl') {
      // NFL teams store league as AFC/NFC (optionally with division) and sportsLeague as NFL
      expressionAttributeNames['#league'] = 'league';
      expressionAttributeNames['#sportsLeague'] = 'sportsLeague';
      filterExpression += ' AND (#sportsLeague = :sportsLeague OR contains(#league, :afc) OR contains(#league, :nfc))';
      expressionAttributeValues[':sportsLeague'] = 'NFL';
      expressionAttributeValues[':afc'] = 'AFC';
      expressionAttributeValues[':nfc'] = 'NFC';
    } else if (leagueLower === 'nhl') {
      // NHL teams have sportsLeague = 'NHL'
      expressionAttributeNames['#sportsLeague'] = 'sportsLeague';
      filterExpression += ' AND #sportsLeague = :sportsLeague';
      expressionAttributeValues[':sportsLeague'] = 'NHL';
    } else if (leagueLower === 'nfl-mvp') {
      // NFL MVP has sportsLeague = 'NFL-MVP' (uppercase in DB)
      expressionAttributeNames['#sportsLeague'] = 'sportsLeague';
      filterExpression += ' AND #sportsLeague = :sportsLeague';
      expressionAttributeValues[':sportsLeague'] = 'NFL-MVP';
    } else if (leagueLower === 'ncaa-tourney-4') {
      // NCAA Tournament 4-player variant
      expressionAttributeNames['#sportsLeague'] = 'sportsLeague';
      filterExpression += ' AND #sportsLeague = :sportsLeague';
      expressionAttributeValues[':sportsLeague'] = 'NCAA-TOURNEY-4';
    } else if (leagueLower === 'ncaa-tourney') {
      // NCAA Tournament teams have sportsLeague = 'NCAA-TOURNEY'
      expressionAttributeNames['#sportsLeague'] = 'sportsLeague';
      filterExpression += ' AND #sportsLeague = :sportsLeague';
      expressionAttributeValues[':sportsLeague'] = 'NCAA-TOURNEY';
    } else {
      // Default: exact league match (e.g., NCAA)
      expressionAttributeNames['#league'] = 'league';
      filterExpression += ' AND #league = :leagueExact';
      expressionAttributeValues[':leagueExact'] = league.toUpperCase();
    }

    const command = new ScanCommand({
      TableName: TABLES.teams,
      FilterExpression: filterExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    });
    const result = await client.send(command);
    return result.Items || [];
  }
  
  // Scan all teams if no filter
  const command = new ScanCommand({ TableName: TABLES.teams });
  const result = await client.send(command);
  return result.Items || [];
};

export const getTeam = async (id) => {
  const client = await getDynamoDBClient();
  const command = new GetCommand({
    TableName: TABLES.teams,
    Key: { id }
  });
  const result = await client.send(command);
  return result.Item || null;
};

export const updateTeam = async (id, updateData) => {
  const client = await getDynamoDBClient();
  
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  Object.keys(updateData).forEach((key, index) => {
    if (updateData[key] !== undefined) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    }
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
  
  const result = await client.send(command);
  return result.Attributes;
};

// Payout operations
export const getPayoutRows = async (league, season) => {
  const client = await getDynamoDBClient();
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
  const result = await client.send(command);
  return result.Items || [];
};

export const createPayoutRow = async (payoutData) => {
  const client = await getDynamoDBClient();
  const item = {
    id: payoutData.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
    league: payoutData.league,
    season: payoutData.season,
    level: payoutData.level,
    teams: payoutData.teams,
    percentage: payoutData.percentage,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const command = new PutCommand({
    TableName: TABLES.payouts,
    Item: item
  });
  await client.send(command);
  return item;
};

export const updatePayoutRow = async (id, updateData) => {
  const client = await getDynamoDBClient();
  
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  Object.keys(updateData).forEach((key, index) => {
    if (updateData[key] !== undefined) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    }
  });
  
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  updateExpressions.push('#updatedAt = :updatedAt');
  
  const command = new UpdateCommand({
    TableName: TABLES.payouts,
    Key: { id },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  });
  
  const result = await client.send(command);
  return result.Attributes;
};

export const deletePayoutRow = async (id) => {
  const client = await getDynamoDBClient();
  const command = new DeleteCommand({
    TableName: TABLES.payouts,
    Key: { id }
  });
  await client.send(command);
  return true;
};

// Achievement operations
export const getAchievements = async (league, season, teamId) => {
  const client = await getDynamoDBClient();
  
  if (teamId) {
    const command = new QueryCommand({
      TableName: TABLES.achievements,
      IndexName: 'teamId-index',
      KeyConditionExpression: 'teamId = :teamId',
      ExpressionAttributeValues: {
        ':teamId': teamId
      }
    });
    const result = await client.send(command);
    return result.Items || [];
  }
  
  // Scan and filter by league/season
  const command = new ScanCommand({
    TableName: TABLES.achievements,
    FilterExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: {
      '#league': 'league',
      '#season': 'season'
    },
    ExpressionAttributeValues: {
      ':league': league,
      ':season': season
    }
  });
  const result = await client.send(command);
  return result.Items || [];
};

export const createAchievement = async (achievementData) => {
  const client = await getDynamoDBClient();
  const item = {
    id: achievementData.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
    teamId: achievementData.teamId,
    achievementType: achievementData.achievementType,
    achieved: achievementData.achieved || false,
    league: achievementData.league,
    season: achievementData.season,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const command = new PutCommand({
    TableName: TABLES.achievements,
    Item: item
  });
  await client.send(command);
  return item;
};

export const updateAchievement = async (id, updateData) => {
  const client = await getDynamoDBClient();
  
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  Object.keys(updateData).forEach((key, index) => {
    if (updateData[key] !== undefined) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    }
  });
  
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  updateExpressions.push('#updatedAt = :updatedAt');
  
  const command = new UpdateCommand({
    TableName: TABLES.achievements,
    Key: { id },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  });
  
  const result = await client.send(command);
  return result.Attributes;
};

// Draft Pick operations
export const getDraftPicks = async (league, season) => {
  const client = await getDynamoDBClient();
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
  const result = await client.send(command);
  const picks = result.Items || [];
  return picks.sort((a, b) => a.pickNumber - b.pickNumber);
};

export const createDraftPick = async (pickData) => {
  const client = await getDynamoDBClient();
  const item = {
    id: pickData.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`),
    league: pickData.league,
    season: pickData.season,
    round: pickData.round,
    pickNumber: pickData.pickNumber,
    owner: pickData.owner,
    teamId: pickData.teamId || null,
    teamName: pickData.teamName || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const command = new PutCommand({
    TableName: TABLES.draftPicks,
    Item: item
  });
  await client.send(command);
  return item;
};

export const updateDraftPick = async (id, updateData) => {
  const client = await getDynamoDBClient();
  
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  Object.keys(updateData).forEach((key, index) => {
    if (updateData[key] !== undefined) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    }
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
  
  const result = await client.send(command);
  return result.Attributes;
};

/**
 * Atomic draft pick function that prevents race conditions
 * Uses DynamoDB conditional writes to ensure:
 * 1. The team hasn't already been drafted by someone else
 * 2. The pick slot hasn't already been used
 * 
 * @param {string} pickId - The draft pick ID
 * @param {string} teamId - The team ID being drafted
 * @param {string} teamName - The team name
 * @param {string} owner - The owner making the pick
 * @returns {Object} - { success: boolean, pick: Object, team: Object, error: string }
 */
export const makeDraftPickAtomic = async (pickId, teamId, teamName, owner) => {
  const client = await getDynamoDBClient();
  const now = new Date().toISOString();
  
  try {
    // Step 1: Update the team with a condition that it's not already owned
    // This prevents two users from drafting the same team
    const updateTeamCommand = new UpdateCommand({
      TableName: TABLES.teams,
      Key: { id: teamId },
      UpdateExpression: 'SET #owner = :owner, #updatedAt = :updatedAt',
      ConditionExpression: 'attribute_not_exists(#owner) OR #owner = :nullValue OR #owner = :emptyString',
      ExpressionAttributeNames: {
        '#owner': 'owner',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':owner': owner,
        ':updatedAt': now,
        ':nullValue': null,
        ':emptyString': ''
      },
      ReturnValues: 'ALL_NEW'
    });
    
    let updatedTeam;
    try {
      const teamResult = await client.send(updateTeamCommand);
      updatedTeam = teamResult.Attributes;
    } catch (teamError) {
      if (teamError.name === 'ConditionalCheckFailedException') {
        // Team was already drafted by someone else
        return {
          success: false,
          error: `${teamName} has already been drafted by another owner.`,
          errorCode: 'TEAM_ALREADY_DRAFTED'
        };
      }
      throw teamError;
    }
    
    // Step 2: Update the draft pick with a condition that it doesn't already have a team
    // This prevents the same pick slot from being used twice
    const updatePickCommand = new UpdateCommand({
      TableName: TABLES.draftPicks,
      Key: { id: pickId },
      UpdateExpression: 'SET #teamId = :teamId, #teamName = :teamName, #updatedAt = :updatedAt',
      ConditionExpression: 'attribute_not_exists(#teamId) OR #teamId = :nullValue',
      ExpressionAttributeNames: {
        '#teamId': 'teamId',
        '#teamName': 'teamName',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':teamId': teamId,
        ':teamName': teamName,
        ':updatedAt': now,
        ':nullValue': null
      },
      ReturnValues: 'ALL_NEW'
    });
    
    let updatedPick;
    try {
      const pickResult = await client.send(updatePickCommand);
      updatedPick = pickResult.Attributes;
    } catch (pickError) {
      if (pickError.name === 'ConditionalCheckFailedException') {
        // Pick slot was already used - need to rollback team ownership
        // Clear the owner we just set on the team
        try {
          await client.send(new UpdateCommand({
            TableName: TABLES.teams,
            Key: { id: teamId },
            UpdateExpression: 'REMOVE #owner SET #updatedAt = :updatedAt',
            ExpressionAttributeNames: {
              '#owner': 'owner',
              '#updatedAt': 'updatedAt'
            },
            ExpressionAttributeValues: {
              ':updatedAt': now
            }
          }));
        } catch (rollbackError) {
          console.error('Failed to rollback team ownership:', rollbackError);
        }
        
        return {
          success: false,
          error: 'This pick has already been made. Please refresh to see the latest picks.',
          errorCode: 'PICK_ALREADY_MADE'
        };
      }
      throw pickError;
    }
    
    return {
      success: true,
      pick: updatedPick,
      team: updatedTeam
    };
    
  } catch (error) {
    console.error('Error in makeDraftPickAtomic:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred while making the draft pick.',
      errorCode: 'UNKNOWN_ERROR'
    };
  }
};

export const deleteDraftPick = async (id) => {
  const client = await getDynamoDBClient();
  
  // First, get the pick details before deleting (for logging)
  const getCommand = new GetCommand({
    TableName: TABLES.draftPicks,
    Key: { id }
  });
  const pickData = await client.send(getCommand);
  
  if (!pickData.Item) {
    throw new Error(`Draft pick with id ${id} not found`);
  }
  
  // Delete the pick
  const deleteCommand = new DeleteCommand({
    TableName: TABLES.draftPicks,
    Key: { id }
  });
  await client.send(deleteCommand);
  
  // Log the deletion
  try {
    await logDraftPickDeletion(pickData.Item);
  } catch (logError) {
    console.error('Error logging draft pick deletion:', logError);
    // Don't throw - deletion succeeded, logging is secondary
  }
  
  return true;
};

export const logDraftPickDeletion = async (pickData) => {
  const client = await getDynamoDBClient();
  
  // Get current user info for logging
  let deletedBy = 'unknown';
  try {
    const { getCurrentUser } = await import('./authService.js');
    const user = await getCurrentUser();
    if (user && user.username) {
      deletedBy = user.username;
    }
  } catch (err) {
    console.warn('Could not get current user for deletion log:', err);
  }
  
  const logEntry = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
  
  await client.send(command);
  return logEntry;
};

export const initializeDraft = async (league, season, owners) => {
   // Delete existing picks
   const existingPicks = await getDraftPicks(league, season);
  for (const pick of existingPicks) {
    await deleteDraftPick(pick.id);
  }
  
  // Create new picks
  const picks = [];
  let totalRounds = 8; // Default for NFL/MLB
  
  if (league === 'nfl') {
    totalRounds = 8; // 32 teams ÷ 4 owners = 8 rounds
  } else if (league === 'mlb') {
    totalRounds = 8; // 30 teams ÷ 4 owners = 7.5, round up to 8
  } else if (league === 'ncaa') {
    totalRounds = 12;
  }
  
  for (let round = 1; round <= totalRounds; round++) {
    const isReverseRound = round % 2 === 0;
    const roundOwners = isReverseRound ? [...owners].reverse() : [...owners];
    
    for (const owner of roundOwners) {
      const pickNumber = picks.length + 1;
      const pick = await createDraftPick({
        league,
        season,
        round,
        pickNumber,
        owner,
        teamId: null,
        teamName: null
      });
      picks.push(pick);
    }
  }
  
  return picks;
};

export const reorderDraftPicks = async (league, season, owners) => {
  // Get existing draft picks
  const existingPicks = await getDraftPicks(league, season);
  
  if (existingPicks.length === 0) {
    // If no picks exist, initialize the draft
    return await initializeDraft(league, season, owners);
  }
  
  // Calculate total rounds based on number of picks
  const totalRounds = Math.ceil(existingPicks.length / owners.length);
  
  // Reorder picks based on new owner order
  const updatedPicks = [];
  let pickIndex = 0;
  
  for (let round = 1; round <= totalRounds; round++) {
    const isReverseRound = round % 2 === 0;
    const roundOwners = isReverseRound ? [...owners].reverse() : [...owners];
    
    for (const owner of roundOwners) {
      if (pickIndex < existingPicks.length) {
        const existingPick = existingPicks[pickIndex];
        // Update the owner and pick number, but preserve teamId and teamName if already set
        const updatedPick = await updateDraftPick(existingPick.id, {
          owner: owner,
          pickNumber: pickIndex + 1,
          round: round
        });
        updatedPicks.push(updatedPick);
        pickIndex++;
      }
    }
  }
  
  return updatedPicks.sort((a, b) => a.pickNumber - b.pickNumber);
};

// League Settings operations
export const getLeagueSettings = async (league, season) => {
  const client = await getDynamoDBClient();
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
  const result = await client.send(command);
  return result.Items?.[0] || null;
};

export const createLeagueSettings = async (settingsData) => {
  const client = await getDynamoDBClient();
    // Use browser crypto API (available in modern browsers) or fallback
    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  const item = {
    id,
    league: settingsData.league,
    season: settingsData.season,
    buyInPerTeam: settingsData.buyInPerTeam || 500,
    numTeams: settingsData.numTeams || 4,
    totalPool: settingsData.totalPool || 2000,
    createdAt: now,
    updatedAt: now
  };
  
  const command = new PutCommand({
    TableName: TABLES.leagueSettings,
    Item: item
  });
  
  await client.send(command);
  return item;
};

export const updateLeagueSettings = async (id, updateData) => {
  const client = await getDynamoDBClient();
  
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  if (updateData.buyInPerTeam !== undefined) {
    expressionAttributeNames['#buyInPerTeam'] = 'buyInPerTeam';
    expressionAttributeValues[':buyInPerTeam'] = updateData.buyInPerTeam;
    updateExpressions.push('#buyInPerTeam = :buyInPerTeam');
  }
  
  if (updateData.numTeams !== undefined) {
    expressionAttributeNames['#numTeams'] = 'numTeams';
    expressionAttributeValues[':numTeams'] = updateData.numTeams;
    updateExpressions.push('#numTeams = :numTeams');
  }
  
  if (updateData.totalPool !== undefined) {
    expressionAttributeNames['#totalPool'] = 'totalPool';
    expressionAttributeValues[':totalPool'] = updateData.totalPool;
    updateExpressions.push('#totalPool = :totalPool');
  }
  
  if (updateData.draftOrder !== undefined) {
    expressionAttributeNames['#draftOrder'] = 'draftOrder';
    expressionAttributeValues[':draftOrder'] = updateData.draftOrder;
    updateExpressions.push('#draftOrder = :draftOrder');
  }
  
  if (updateData.numberOfOwners !== undefined) {
    expressionAttributeNames['#numberOfOwners'] = 'numberOfOwners';
    expressionAttributeValues[':numberOfOwners'] = updateData.numberOfOwners;
    updateExpressions.push('#numberOfOwners = :numberOfOwners');
  }
  
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  updateExpressions.push('#updatedAt = :updatedAt');
  
  const command = new UpdateCommand({
    TableName: TABLES.leagueSettings,
    Key: { id },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  });
  
  const result = await client.send(command);
  return result.Attributes;
};

// Owner operations
export const getOwners = async () => {
  const client = await getDynamoDBClient();
  const command = new ScanCommand({ TableName: TABLES.owners });
  const result = await client.send(command);
  return result.Items || [];
};

// Activity Log operations
export const createActivityLog = async (logData) => {
  const client = await getDynamoDBClient();
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const logEntry = {
    id,
    timestamp: new Date().toISOString(),
    timestampNumber: Date.now(), // For sorting
    action: logData.action,
    message: logData.message || logData.action,
    status: logData.status || 'info',
    data: logData.data || {},
    user: logData.user || 'System',
    createdAt: new Date().toISOString()
  };

  const command = new PutCommand({
    TableName: TABLES.activityLogs,
    Item: logEntry
  });

  await client.send(command);
  return logEntry;
};

export const getActivityLogs = async (limit = 100) => {
  const client = await getDynamoDBClient();
  
  // Scan and sort by timestamp descending, limit results
  const command = new ScanCommand({
    TableName: TABLES.activityLogs,
    Limit: limit * 2 // Scan more than needed to account for any filtering
  });
  
  const result = await client.send(command);
  const logs = (result.Items || [])
    .sort((a, b) => {
      // Sort by timestampNumber descending (newest first)
      const timeA = a.timestampNumber || new Date(a.timestamp || 0).getTime();
      const timeB = b.timestampNumber || new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    })
    .slice(0, limit); // Limit to requested number

  return logs;
};

export const clearActivityLogs = async () => {
  const client = await getDynamoDBClient();
  
  // Get all logs first
  let allLogs = [];
  let lastEvaluatedKey = null;
  
  do {
    const scanCommand = new ScanCommand({
      TableName: TABLES.activityLogs,
      ...(lastEvaluatedKey ? { ExclusiveStartKey: lastEvaluatedKey } : {})
    });
    
    const scanResult = await client.send(scanCommand);
    allLogs = [...allLogs, ...(scanResult.Items || [])];
    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  // Delete in batches of 25 (DynamoDB batch limit)
  const batchSize = 25;
  let totalDeleted = 0;
  
  for (let i = 0; i < allLogs.length; i += batchSize) {
    const batch = allLogs.slice(i, i + batchSize);
    const deleteRequests = batch.map(log => ({
      DeleteRequest: {
        Key: { id: log.id }
      }
    }));
    
    const batchCommand = new BatchWriteCommand({
      RequestItems: {
        [TABLES.activityLogs]: deleteRequests
      }
    });
    
    await client.send(batchCommand);
    totalDeleted += batch.length;
  }
  
  return { deleted: totalDeleted };
};

// Draft Status operations - Direct DynamoDB access (faster than GraphQL)
export const getDraftStatus = async (league, season) => {
  const client = await getDynamoDBClient();
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
  const result = await client.send(command);
  return result.Items?.[0] || null;
};

export const getAllDraftStatuses = async () => {
  const client = await getDynamoDBClient();
  const command = new ScanCommand({
    TableName: TABLES.draftStatuses
  });
  const result = await client.send(command);
  return result.Items || [];
};

// Batch get all draft picks for multiple leagues at once (optimized for home page)
export const getAllDraftPicksBatch = async (leagueSeasons) => {
  const client = await getDynamoDBClient();
  
  // Execute all queries in parallel
  const results = await Promise.all(
    leagueSeasons.map(async ({ league, season }) => {
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
      const result = await client.send(command);
      const picks = (result.Items || []).sort((a, b) => a.pickNumber - b.pickNumber);
      return { league, season, picks };
    })
  );
  
  // Return as a map for easy access
  const picksMap = {};
  results.forEach(({ league, season, picks }) => {
    picksMap[`${league}-${season}`] = picks;
  });
  return picksMap;
};

export const updateDraftStatus = async (league, season, status) => {
  const client = await getDynamoDBClient();
  
  // First, check if a status record exists
  const existingStatus = await getDraftStatus(league, season);
  
  if (existingStatus) {
    // Update existing record
    const command = new UpdateCommand({
      TableName: TABLES.draftStatuses,
      Key: { id: existingStatus.id },
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
    const result = await client.send(command);
    return result.Attributes;
  } else {
    // Create new record
    const id = typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const item = {
      id,
      league,
      season,
      status,
      createdAt: now,
      updatedAt: now
    };
    
    const command = new PutCommand({
      TableName: TABLES.draftStatuses,
      Item: item
    });
    await client.send(command);
    return item;
  }
};

// Draft Access Control operations
export const getDraftAccess = async (league, season) => {
  const client = await getDynamoDBClient();
  const command = new QueryCommand({
    TableName: TABLES.draftAccess,
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
  const result = await client.send(command);
  return result.Items?.[0] || null;
};

export const getAllDraftAccess = async () => {
  const client = await getDynamoDBClient();
  const command = new ScanCommand({
    TableName: TABLES.draftAccess
  });
  const result = await client.send(command);
  return result.Items || [];
};

export const setDraftAccess = async (league, season, userEmails) => {
  const client = await getDynamoDBClient();
  const existingAccess = await getDraftAccess(league, season);
  const now = new Date().toISOString();
  
  if (existingAccess) {
    // Update existing access
    const command = new UpdateCommand({
      TableName: TABLES.draftAccess,
      Key: { id: existingAccess.id },
      UpdateExpression: 'SET #users = :users, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#users': 'userEmails',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':users': userEmails,
        ':updatedAt': now
      },
      ReturnValues: 'ALL_NEW'
    });
    const result = await client.send(command);
    return result.Attributes;
  } else {
    // Create new access record
    const id = `${league}-${season}-${Date.now()}`;
    const item = {
      id,
      league,
      season,
      userEmails,
      createdAt: now,
      updatedAt: now
    };
    
    const command = new PutCommand({
      TableName: TABLES.draftAccess,
      Item: item
    });
    await client.send(command);
    return item;
  }
};

export const setDraftAdminAccess = async (league, season, adminEmails) => {
  const client = await getDynamoDBClient();
  const existingAccess = await getDraftAccess(league, season);
  const now = new Date().toISOString();

  if (existingAccess) {
    const command = new UpdateCommand({
      TableName: TABLES.draftAccess,
      Key: { id: existingAccess.id },
      UpdateExpression: 'SET #admins = :admins, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#admins': 'adminEmails',
        '#updatedAt': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':admins': adminEmails,
        ':updatedAt': now
      },
      ReturnValues: 'ALL_NEW'
    });
    const result = await client.send(command);
    return result.Attributes;
  } else {
    const id = `${league}-${season}-${Date.now()}`;
    const item = {
      id,
      league,
      season,
      userEmails: [],
      adminEmails,
      createdAt: now,
      updatedAt: now
    };
    const command = new PutCommand({
      TableName: TABLES.draftAccess,
      Item: item
    });
    await client.send(command);
    return item;
  }
};

export const checkUserDraftAccess = async (userEmail, league, season) => {
  const accessRecord = await getDraftAccess(league, season);
  // If no access record exists, grant access to everyone (default open)
  if (!accessRecord || !accessRecord.userEmails || accessRecord.userEmails.length === 0) {
    return true;
  }
  // Check if user email is in the list (case-insensitive)
  return accessRecord.userEmails.some(email => 
    email.toLowerCase() === userEmail.toLowerCase()
  );
};

export const getUserAccessibleDrafts = async (userEmail) => {
  const allAccess = await getAllDraftAccess();
  const accessibleDrafts = [];
  
  // If no access records exist at all, return empty (will show all by default)
  if (!allAccess || allAccess.length === 0) {
    return null; // null means show all (no restrictions)
  }
  
  for (const access of allAccess) {
    if (!access.userEmails || access.userEmails.length === 0) {
      // No restrictions for this draft
      accessibleDrafts.push(`${access.league}-${access.season}`);
    } else if (access.userEmails.some(email => email.toLowerCase() === userEmail.toLowerCase())) {
      accessibleDrafts.push(`${access.league}-${access.season}`);
    }
  }
  
  return accessibleDrafts;
};

// ============================================
// NCAA Tournament Game Operations
// ============================================

// Point values per round
const NCAA_TOURNEY_POINTS = {
  1: 3,   // Round of 64
  2: 6,   // Round of 32
  3: 9,   // Sweet 16
  4: 12,  // Elite 8
  5: 15,  // Final Four
  6: 18   // Championship
};

export const getNcaaTourneyGames = async (league, season) => {
  const client = await getDynamoDBClient();
  const command = new QueryCommand({
    TableName: TABLES.ncaaTourneyGames,
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
  const result = await client.send(command);
  return (result.Items || []).sort((a, b) => {
    // Sort by round, then game number
    if (a.round !== b.round) return a.round - b.round;
    return a.gameNum - b.gameNum;
  });
};

export const getNcaaTourneyGame = async (id) => {
  const client = await getDynamoDBClient();
  const command = new GetCommand({
    TableName: TABLES.ncaaTourneyGames,
    Key: { id }
  });
  const result = await client.send(command);
  return result.Item || null;
};

export const createNcaaTourneyGame = async (gameData) => {
  const client = await getDynamoDBClient();
  const now = new Date().toISOString();
  
  const item = {
    id: gameData.id || `${gameData.league}-${gameData.season}-${gameData.round}-${gameData.gameNum}`,
    league: gameData.league,
    season: gameData.season,
    round: gameData.round,
    gameNum: gameData.gameNum,
    region: gameData.region,
    team1Id: gameData.team1Id || null,
    team1Seed: gameData.team1Seed || null,
    team2Id: gameData.team2Id || null,
    team2Seed: gameData.team2Seed || null,
    winnerId: gameData.winnerId || null,
    score1: gameData.score1 || null,
    score2: gameData.score2 || null,
    status: gameData.status || 'scheduled',
    createdAt: now,
    updatedAt: now
  };
  
  const command = new PutCommand({
    TableName: TABLES.ncaaTourneyGames,
    Item: item
  });
  await client.send(command);
  return item;
};

export const updateNcaaTourneyGame = async (id, updateData) => {
  const client = await getDynamoDBClient();
  
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  
  Object.keys(updateData).forEach((key, index) => {
    if (updateData[key] !== undefined) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    }
  });
  
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  updateExpressions.push('#updatedAt = :updatedAt');
  
  const command = new UpdateCommand({
    TableName: TABLES.ncaaTourneyGames,
    Key: { id },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  });
  
  const result = await client.send(command);
  return result.Attributes;
};

// Synchronous point calculation - used when games and team data are already available
function calculatePointsForTeam(teamId, team, games, allTeams) {
  if (!team) return { total: 0, breakdown: {} };
  
  const teamSeed = team.seed;
  let totalPoints = 0;
  const breakdown = {};
  
  for (const game of games) {
    if (game.winnerId === teamId && game.status === 'completed') {
      const round = game.round;
      const basePoints = NCAA_TOURNEY_POINTS[round] || 0;
      
      const opponentId = game.team1Id === teamId ? game.team2Id : game.team1Id;
      const opponentTeam = allTeams ? allTeams.find(t => t.id === opponentId) : null;
      const opponentSeed = opponentTeam?.seed;
      
      // Upset bonus only when a lower seed (higher number) beats a higher seed (lower number)
      let upsetBonus = 0;
      if (teamSeed && opponentSeed && teamSeed > opponentSeed) {
        upsetBonus = teamSeed - opponentSeed;
      }
      
      const roundPoints = basePoints + upsetBonus;
      const roundName = getRoundName(round);
      breakdown[roundName] = {
        base: basePoints,
        bonus: upsetBonus,
        total: roundPoints,
        opponent: opponentSeed ? `#${opponentSeed} seed` : 'Unknown'
      };
      
      totalPoints += roundPoints;
    }
  }
  
  return { total: totalPoints, breakdown };
}

// Calculate points for a team based on their tournament wins
// Can optionally accept pre-fetched games and team data to avoid redundant queries
export const calculateNcaaTourneyPoints = async (teamId, league, season, prefetchedGames = null, prefetchedTeam = null) => {
  const [games, team, allTeams] = await Promise.all([
    prefetchedGames || getNcaaTourneyGames(league, season),
    prefetchedTeam || getTeam(teamId),
    getTeams(league, season)
  ]);
  return calculatePointsForTeam(teamId, team, games, allTeams);
};

// Helper function to get round name
function getRoundName(round) {
  const names = {
    1: 'Round of 64',
    2: 'Round of 32',
    3: 'Sweet 16',
    4: 'Elite 8',
    5: 'Final Four',
    6: 'Championship'
  };
  return names[round] || `Round ${round}`;
}

// Get point breakdown for tooltip display
export const getTeamPointBreakdown = async (teamId, league, season) => {
  const result = await calculateNcaaTourneyPoints(teamId, league, season);
  return result;
};

// Batch update team points after game results are loaded
// Uses synchronous calculation + BatchWriteCommand for minimal DB round-trips
export const updateAllTeamPoints = async (league, season) => {
  console.time('updateAllTeamPoints');
  
  const [teams, games] = await Promise.all([
    getTeams(league, season),
    getNcaaTourneyGames(league, season)
  ]);
  
  console.log(`Calculating points for ${teams.length} teams using ${games.length} games`);
  
  const now = new Date().toISOString();
  const updatedTeams = [];
  
  for (const team of teams) {
    const { total, breakdown } = calculatePointsForTeam(team.id, team, games, teams);
    
    if (team.totalPoints !== total) {
      updatedTeams.push({
        ...team,
        totalPoints: total,
        pointBreakdown: JSON.stringify(breakdown),
        updatedAt: now
      });
    }
  }
  
  console.log(`${updatedTeams.length} teams need point updates`);
  
  if (updatedTeams.length === 0) {
    console.timeEnd('updateAllTeamPoints');
    return [];
  }
  
  // BatchWriteCommand handles 25 items per request (vs 1 per UpdateCommand)
  const client = await getDynamoDBClient();
  const BATCH_SIZE = 25;
  
  for (let i = 0; i < updatedTeams.length; i += BATCH_SIZE) {
    const batch = updatedTeams.slice(i, i + BATCH_SIZE);
    const command = new BatchWriteCommand({
      RequestItems: {
        [TABLES.teams]: batch.map(item => ({
          PutRequest: { Item: item }
        }))
      }
    });
    
    let result = await client.send(command);
    
    // Retry any unprocessed items (DynamoDB throttling)
    for (let retry = 1; retry <= 3; retry++) {
      const unprocessed = result.UnprocessedItems?.[TABLES.teams];
      if (!unprocessed || unprocessed.length === 0) break;
      await new Promise(r => setTimeout(r, 100 * retry));
      result = await client.send(new BatchWriteCommand({
        RequestItems: { [TABLES.teams]: unprocessed }
      }));
    }
  }
  
  console.timeEnd('updateAllTeamPoints');
  return updatedTeams;
};

// User Preferences Operations
export const getUserPreferences = async (userId, leagueId) => {
  const client = await getDynamoDBClient();
  const id = `${userId}-${leagueId}`;
  
  const command = new GetCommand({
    TableName: TABLES.userPreferences,
    Key: { id }
  });
  
  try {
    const result = await client.send(command);
    return result.Item || null;
  } catch (error) {
    // Table might not exist yet, return null
    console.warn('Error fetching user preferences:', error.message);
    return null;
  }
};

export const saveUserPreferences = async (userId, leagueId, preferences) => {
  const client = await getDynamoDBClient();
  const now = new Date().toISOString();
  const id = `${userId}-${leagueId}`;
  
  const item = {
    id,
    odUserId: userId,
    leagueId,
    ...preferences,
    updatedAt: now
  };
  
  const command = new PutCommand({
    TableName: TABLES.userPreferences,
    Item: item
  });
  
  try {
    await client.send(command);
    return item;
  } catch (error) {
    console.error('Error saving user preferences:', error);
    throw error;
  }
};

// User Profile Operations (global, not league-specific)
export const getUserProfile = async (userId) => {
  const client = await getDynamoDBClient();
  const id = `profile-${userId}`;
  
  const command = new GetCommand({
    TableName: TABLES.userPreferences,
    Key: { id }
  });
  
  try {
    const result = await client.send(command);
    return result.Item || null;
  } catch (error) {
    console.warn('Error fetching user profile:', error.message);
    return null;
  }
};

export const saveUserProfile = async (userId, profileData) => {
  const client = await getDynamoDBClient();
  const now = new Date().toISOString();
  const id = `profile-${userId}`;
  
  // First, get existing profile to merge data
  let existingProfile = {};
  try {
    const existing = await getUserProfile(userId);
    if (existing) {
      existingProfile = existing;
    }
  } catch (e) {
    // Ignore errors fetching existing profile
  }
  
  const item = {
    ...existingProfile,
    id,
    userId,
    ...profileData,
    updatedAt: now
  };
  
  const command = new PutCommand({
    TableName: TABLES.userPreferences,
    Item: item
  });
  
  try {
    await client.send(command);
    return item;
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw error;
  }
};

// Get user profile by initials (for looking up display names)
export const getUserProfileByInitials = async (initials) => {
  const client = await getDynamoDBClient();
  
  const command = new ScanCommand({
    TableName: TABLES.userPreferences,
    FilterExpression: 'begins_with(id, :prefix) AND displayInitials = :initials',
    ExpressionAttributeValues: {
      ':prefix': 'profile-',
      ':initials': initials
    }
  });
  
  try {
    const result = await client.send(command);
    return result.Items?.[0] || null;
  } catch (error) {
    console.warn('Error fetching user profile by initials:', error.message);
    return null;
  }
};

// Get all user profiles (for admin/settings)
export const getAllUserProfiles = async () => {
  const client = await getDynamoDBClient();
  
  const command = new ScanCommand({
    TableName: TABLES.userPreferences,
    FilterExpression: 'begins_with(id, :prefix)',
    ExpressionAttributeValues: {
      ':prefix': 'profile-'
    }
  });
  
  try {
    const result = await client.send(command);
    return result.Items || [];
  } catch (error) {
    console.warn('Error fetching all user profiles:', error.message);
    return [];
  }
};

// ============================================
// NCAA Survivor Pool Operations
// ============================================

const SURVIVOR_TABLES = {
  entries: 'sports-hub-survivor-entries',
  picks: 'sports-hub-survivor-picks',
  schedule: 'sports-hub-survivor-schedule'
};

// --- Survivor Entries ---

export const getSurvivorEntries = async (league, season) => {
  const client = await getDynamoDBClient();
  const command = new QueryCommand({
    TableName: SURVIVOR_TABLES.entries,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': league, ':season': season }
  });
  const result = await client.send(command);
  return (result.Items || []).sort((a, b) => {
    if (a.playerName !== b.playerName) return a.playerName.localeCompare(b.playerName);
    return (a.entryNumber || 1) - (b.entryNumber || 1);
  });
};

export const getSurvivorEntry = async (id) => {
  const client = await getDynamoDBClient();
  const command = new GetCommand({
    TableName: SURVIVOR_TABLES.entries,
    Key: { id }
  });
  const result = await client.send(command);
  return result.Item || null;
};

export const createSurvivorEntry = async (entryData) => {
  const client = await getDynamoDBClient();
  const now = new Date().toISOString();
  const item = {
    id: entryData.id || `${entryData.league}-${entryData.season}-${entryData.playerName}-${entryData.entryNumber || 1}`,
    league: entryData.league,
    season: entryData.season,
    playerName: entryData.playerName,
    entryNumber: entryData.entryNumber || 1,
    email: entryData.email || null,
    status: entryData.status || 'alive',
    buyBackCount: entryData.buyBackCount || 0,
    totalCost: entryData.totalCost || 10,
    usedTeams: entryData.usedTeams || [],
    eliminatedOnDay: entryData.eliminatedOnDay || null,
    lastBuyBackDay: entryData.lastBuyBackDay || null,
    createdAt: now,
    updatedAt: now
  };
  await client.send(new PutCommand({ TableName: SURVIVOR_TABLES.entries, Item: item }));
  return item;
};

export const updateSurvivorEntry = async (id, updateData) => {
  const client = await getDynamoDBClient();
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  Object.keys(updateData).forEach((key, index) => {
    if (updateData[key] !== undefined) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    }
  });

  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  updateExpressions.push('#updatedAt = :updatedAt');

  const command = new UpdateCommand({
    TableName: SURVIVOR_TABLES.entries,
    Key: { id },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  });
  const result = await client.send(command);
  return result.Attributes;
};

// --- Survivor Picks ---

export const getSurvivorPicks = async (league, season, gameDay) => {
  const client = await getDynamoDBClient();
  if (gameDay) {
    const command = new QueryCommand({
      TableName: SURVIVOR_TABLES.picks,
      IndexName: 'league-day-index',
      KeyConditionExpression: '#league = :league AND #gameDay = :gameDay',
      ExpressionAttributeNames: { '#league': 'league', '#gameDay': 'gameDay' },
      ExpressionAttributeValues: { ':league': league, ':gameDay': gameDay }
    });
    const result = await client.send(command);
    return result.Items || [];
  }
  const command = new QueryCommand({
    TableName: SURVIVOR_TABLES.picks,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': league, ':season': season }
  });
  const result = await client.send(command);
  return result.Items || [];
};

export const getSurvivorPicksByEntry = async (entryId) => {
  const client = await getDynamoDBClient();
  const command = new ScanCommand({
    TableName: SURVIVOR_TABLES.picks,
    FilterExpression: '#entryId = :entryId',
    ExpressionAttributeNames: { '#entryId': 'entryId' },
    ExpressionAttributeValues: { ':entryId': entryId }
  });
  const result = await client.send(command);
  return (result.Items || []).sort((a, b) => a.gameDay.localeCompare(b.gameDay));
};

export const createSurvivorPick = async (pickData) => {
  const client = await getDynamoDBClient();
  const now = new Date().toISOString();
  const item = {
    id: pickData.id || `${pickData.entryId}-${pickData.gameDay}`,
    entryId: pickData.entryId,
    league: pickData.league,
    season: pickData.season,
    playerName: pickData.playerName,
    gameDay: pickData.gameDay,
    teamNames: pickData.teamNames || [],
    requiredPicks: pickData.requiredPicks || 2,
    results: pickData.results || {},
    passed: pickData.passed !== undefined ? pickData.passed : null,
    submittedAt: pickData.submittedAt || now,
    updatedAt: now
  };
  await client.send(new PutCommand({ TableName: SURVIVOR_TABLES.picks, Item: item }));
  return item;
};

export const updateSurvivorPick = async (id, updateData) => {
  const client = await getDynamoDBClient();
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  Object.keys(updateData).forEach((key, index) => {
    if (updateData[key] !== undefined) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    }
  });

  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  updateExpressions.push('#updatedAt = :updatedAt');

  const command = new UpdateCommand({
    TableName: SURVIVOR_TABLES.picks,
    Key: { id },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  });
  const result = await client.send(command);
  return result.Attributes;
};

// --- Survivor Schedule ---

export const getSurvivorSchedule = async (league, season) => {
  const client = await getDynamoDBClient();
  const command = new QueryCommand({
    TableName: SURVIVOR_TABLES.schedule,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': league, ':season': season }
  });
  const result = await client.send(command);
  return (result.Items || []).sort((a, b) => a.dayIndex - b.dayIndex);
};

export const getSurvivorScheduleDay = async (league, season, gameDay) => {
  const client = await getDynamoDBClient();
  const id = `${league}-${season}-${gameDay}`;
  const command = new GetCommand({
    TableName: SURVIVOR_TABLES.schedule,
    Key: { id }
  });
  const result = await client.send(command);
  return result.Item || null;
};

export const createSurvivorScheduleDay = async (scheduleData) => {
  const client = await getDynamoDBClient();
  const now = new Date().toISOString();
  const item = {
    id: scheduleData.id || `${scheduleData.league}-${scheduleData.season}-${scheduleData.gameDay}`,
    league: scheduleData.league,
    season: scheduleData.season,
    gameDay: scheduleData.gameDay,
    tournamentDay: scheduleData.tournamentDay,
    dayIndex: scheduleData.dayIndex,
    games: scheduleData.games || [],
    lockedAt: scheduleData.lockedAt || null,
    updatedAt: now
  };
  await client.send(new PutCommand({ TableName: SURVIVOR_TABLES.schedule, Item: item }));
  return item;
};

export const updateSurvivorScheduleDay = async (id, updateData) => {
  const client = await getDynamoDBClient();
  const updateExpressions = [];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};

  Object.keys(updateData).forEach((key, index) => {
    if (updateData[key] !== undefined) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = updateData[key];
    }
  });

  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();
  updateExpressions.push('#updatedAt = :updatedAt');

  const command = new UpdateCommand({
    TableName: SURVIVOR_TABLES.schedule,
    Key: { id },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  });
  const result = await client.send(command);
  return result.Attributes;
};

// ============================================
// WC 2026 Corner Model Operations
// ============================================

const WC_CORNERS_TABLE = 'sports-hub-wc-corners';
const WC_LEAGUE = 'wc-corners';

function wcSeasonId(season = '2026') {
  return `${WC_LEAGUE}-${season}`;
}

export const getWcCornersItems = async (season = '2026') => {
  const client = await getDynamoDBClient();
  const command = new QueryCommand({
    TableName: WC_CORNERS_TABLE,
    IndexName: 'league-season-index',
    KeyConditionExpression: '#league = :league AND #season = :season',
    ExpressionAttributeNames: { '#league': 'league', '#season': 'season' },
    ExpressionAttributeValues: { ':league': WC_LEAGUE, ':season': season },
  });
  const result = await client.send(command);
  return result.Items || [];
};

export const getWcCornersModel = async (season = '2026') => {
  const items = await getWcCornersItems(season);
  const parameters = {};
  let trackerSummary = null;
  let accuracySummary = null;
  let meta = null;
  const dashboard = [];
  const teams = {};
  const bets = [];
  const accuracyLog = [];
  const fixtures = [];
  let eloRatings = [];

  items.forEach((item) => {
    switch (item.entityType) {
      case 'parameters':
        Object.assign(parameters, item.data || {});
        break;
      case 'elo-ratings':
        eloRatings = item.ratings || [];
        break;
      case 'team':
        dashboard.push(item.dashboard);
        teams[item.team] = {
          games: item.games || [],
          summary: item.summary || {},
        };
        break;
      case 'bet':
        bets.push({ ...item.bet, _betId: item.id });
        break;
      case 'accuracy':
        accuracyLog.push({ ...item.entry, _entryId: item.id });
        break;
      case 'fixture':
        fixtures.push(item.fixture);
        break;
      case 'tracker-summary':
        trackerSummary = item.summary;
        break;
      case 'accuracy-summary':
        accuracySummary = item.summary;
        break;
      case 'meta':
        meta = item;
        break;
      default:
        break;
    }
  });

  dashboard.sort((a, b) => a.team.localeCompare(b.team));
  bets.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  accuracyLog.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  fixtures.sort((a, b) => String(a.commenceTime).localeCompare(String(b.commenceTime)));

  return {
    meta: meta || { title: 'WC 2026 — Corner Kick Model' },
    readme: meta?.readme || [],
    parameters,
    dashboard,
    teams,
    tracker: { summary: trackerSummary || {}, bets },
    accuracy: { summary: accuracySummary || {}, log: accuracyLog },
    fixtures,
    eloRatings,
    lastOddsSync: meta?.lastOddsSync || null,
  };
};

export const saveWcCornersParameters = async (season, valueUpdates, { recalc = true } = {}) => {
  const items = await getWcCornersItems(season);
  const paramsItem = items.find((i) => i.entityType === 'parameters');
  const data = { ...(paramsItem?.data || {}) };

  Object.entries(valueUpdates || {}).forEach(([name, rawVal]) => {
    if (!data[name]) return;
    const n = Number(rawVal);
    const value = Number.isFinite(n) ? n : rawVal;
    data[name] = { ...data[name], value };
  });

  await putWcCornersItem({
    id: `${wcSeasonId(season)}-parameters`,
    season,
    entityType: 'parameters',
    data,
    createdAt: paramsItem?.createdAt,
  });

  if (recalc) {
    await recalcAndSaveWcCornersModel(season);
  }

  return data;
};

export const putWcCornersItem = async (item) => {
  const client = await getDynamoDBClient();
  const now = new Date().toISOString();
  const record = {
    ...item,
    league: WC_LEAGUE,
    updatedAt: now,
    createdAt: item.createdAt || now,
  };
  await client.send(new PutCommand({ TableName: WC_CORNERS_TABLE, Item: record }));
  return record;
};

export const saveWcCornersFixtures = async (season, fixtures, syncMeta = {}) => {
  const writes = fixtures.map((fixture) => ({
    PutRequest: {
      Item: {
        id: `${wcSeasonId(season)}-fixture-${fixture.eventId}`,
        league: WC_LEAGUE,
        season,
        entityType: 'fixture',
        fixture,
        updatedAt: new Date().toISOString(),
      },
    },
  }));

  const client = await getDynamoDBClient();
  for (let i = 0; i < writes.length; i += 25) {
    const chunk = writes.slice(i, i + 25);
    await client.send(new BatchWriteCommand({
      RequestItems: { [WC_CORNERS_TABLE]: chunk },
    }));
  }

  const existing = await getWcCornersItems(season);
  const metaItem = existing.find((i) => i.entityType === 'meta');
  await putWcCornersItem({
    id: `${wcSeasonId(season)}-meta`,
    season,
    entityType: 'meta',
    title: metaItem?.title || 'WC 2026 — Corner Kick Model',
    readme: metaItem?.readme || [],
    lastOddsSync: syncMeta.fetchedAt || new Date().toISOString(),
    oddsEventCount: syncMeta.eventCount || fixtures.length,
    createdAt: metaItem?.createdAt,
  });
};

export const refreshWcCornersOddsFromApi = async (season = '2026') => {
  const { fetchAllWcCornerOdds } = await import('./wcCornersOddsApi.js');
  const payload = await fetchAllWcCornerOdds();
  await saveWcCornersFixtures(season, payload.fixtures, {
    fetchedAt: payload.fetchedAt,
    eventCount: payload.eventCount,
  });
  return payload;
};

async function loadWcModelForRecalc(season = '2026') {
  const items = await getWcCornersItems(season);
  const parameters = {};
  let trackerSummary = null;
  let accuracySummary = null;
  const dashboard = [];
  const teams = {};
  const eloRatings = [];

  items.forEach((item) => {
    switch (item.entityType) {
      case 'parameters':
        Object.assign(parameters, item.data || {});
        break;
      case 'team':
        dashboard.push(item.dashboard);
        teams[item.team] = { games: item.games || [], summary: item.summary || {} };
        break;
      case 'elo-ratings':
        eloRatings.push(...(item.ratings || []));
        break;
      case 'tracker-summary':
        trackerSummary = item.summary;
        break;
      case 'accuracy-summary':
        accuracySummary = item.summary;
        break;
      default:
        break;
    }
  });

  dashboard.sort((a, b) => a.team.localeCompare(b.team));
  return { items, parameters, dashboard, teams, eloRatings, trackerSummary, accuracySummary };
}

export const recalcAndSaveWcCornersModel = async (season = '2026') => {
  const { recalcWcModel } = await import('../utils/wc2026RecalcEngine.js');
  const loaded = await loadWcModelForRecalc(season);
  const recalced = recalcWcModel({
    teams: loaded.teams,
    dashboard: loaded.dashboard,
    parameters: loaded.parameters,
    eloRatings: loaded.eloRatings,
  });

  const now = new Date().toISOString();
  const teamItems = loaded.items.filter((i) => i.entityType === 'team');

  for (const item of teamItems) {
    const teamName = item.team;
    if (!teamName || teamName.includes('PRIOR')) continue;
    const teamData = recalced.teams[teamName];
    const dashRow = recalced.dashboard.find((r) => r.team === teamName);
    if (!teamData || !dashRow) continue;

    await putWcCornersItem({
      ...item,
      season,
      games: teamData.games,
      summary: teamData.summary,
      dashboard: { ...item.dashboard, ...dashRow },
      updatedAt: now,
    });
  }

  const paramsItem = loaded.items.find((i) => i.entityType === 'parameters');
  await putWcCornersItem({
    id: `${wcSeasonId(season)}-parameters`,
    season,
    entityType: 'parameters',
    data: recalced.parameters,
    createdAt: paramsItem?.createdAt,
  });

  const metaItem = loaded.items.find((i) => i.entityType === 'meta');
  await putWcCornersItem({
    id: `${wcSeasonId(season)}-meta`,
    season,
    entityType: 'meta',
    title: metaItem?.title,
    readme: metaItem?.readme || [],
    lastOddsSync: metaItem?.lastOddsSync,
    oddsEventCount: metaItem?.oddsEventCount,
    lastEloSync: metaItem?.lastEloSync,
    lastCornerStatsSync: metaItem?.lastCornerStatsSync,
    lastModelRecalc: now,
    winsorCap: recalced.winsorCap,
    createdAt: metaItem?.createdAt,
  });

  return recalced;
};

export const saveWcCornersBet = async (season, betInput) => {
  const { enrichBet, computeTrackerSummary } = await import('../utils/wc2026Tracker.js');
  const items = await getWcCornersItems(season);
  const existingBets = items.filter((i) => i.entityType === 'bet');
  const nextIndex = existingBets.length + 1;
  const bet = enrichBet(betInput);
  const id = `${wcSeasonId(season)}-bet-${String(nextIndex).padStart(3, '0')}`;

  await putWcCornersItem({
    id,
    season,
    entityType: 'bet',
    bet,
  });

  const allBets = [...existingBets.map((i) => i.bet), bet];
  const summary = computeTrackerSummary(allBets.map(enrichBet));
  const summaryItem = items.find((i) => i.entityType === 'tracker-summary');
  await putWcCornersItem({
    id: `${wcSeasonId(season)}-tracker-summary`,
    season,
    entityType: 'tracker-summary',
    summary,
    createdAt: summaryItem?.createdAt,
  });

  return { id, bet, summary };
};

export const updateWcCornersBet = async (season, betId, updates) => {
  const { enrichBet, computeTrackerSummary } = await import('../utils/wc2026Tracker.js');
  const items = await getWcCornersItems(season);
  const item = items.find((i) => i.id === betId && i.entityType === 'bet');
  if (!item) throw new Error(`Bet not found: ${betId}`);

  const bet = enrichBet({ ...item.bet, ...updates });
  await putWcCornersItem({ ...item, bet });

  const allBets = items
    .filter((i) => i.entityType === 'bet')
    .map((i) => (i.id === betId ? bet : enrichBet(i.bet)));
  const summary = computeTrackerSummary(allBets);
  const summaryItem = items.find((i) => i.entityType === 'tracker-summary');
  await putWcCornersItem({
    id: `${wcSeasonId(season)}-tracker-summary`,
    season,
    entityType: 'tracker-summary',
    summary,
    createdAt: summaryItem?.createdAt,
  });

  return { bet, summary };
};

async function refreshWcAccuracySummary(season, logEntries) {
  const { computeAccuracySummary } = await import('../utils/wc2026Accuracy.js');
  const summary = computeAccuracySummary(logEntries);
  const items = await getWcCornersItems(season);
  const summaryItem = items.find((i) => i.entityType === 'accuracy-summary');
  await putWcCornersItem({
    id: `${wcSeasonId(season)}-accuracy-summary`,
    season,
    entityType: 'accuracy-summary',
    summary,
    createdAt: summaryItem?.createdAt,
  });
  return summary;
}

export const addWcCornersMatchGames = async (season, input) => {
  const {
    buildProjectionSnapshot,
    buildAccuracyEntryFromProjection,
    buildGameRecord,
    hasGame,
    mirrorVenue,
    nextGameNum,
    normalizeGameDate,
  } = await import('../utils/wc2026GameEntry.js');

  const {
    teamA,
    teamB,
    date,
    cornersA,
    cornersB,
    comp = 'WC',
    venue = 'N',
    included = true,
    lockAccuracy = true,
  } = input;

  if (!teamA || !teamB || teamA === teamB) {
    throw new Error('Select two different teams');
  }
  if (!Number.isFinite(Number(cornersA)) || !Number.isFinite(Number(cornersB))) {
    throw new Error('Corner counts must be numbers');
  }

  const items = await getWcCornersItems(season);
  const teamItemA = items.find((i) => i.entityType === 'team' && i.team === teamA);
  const teamItemB = items.find((i) => i.entityType === 'team' && i.team === teamB);
  if (!teamItemA || !teamItemB) {
    throw new Error(`Team not in model: ${!teamItemA ? teamA : teamB}`);
  }

  const parameters = {};
  items.filter((i) => i.entityType === 'parameters').forEach((i) => Object.assign(parameters, i.data || {}));
  const dashboard = items.filter((i) => i.entityType === 'team').map((i) => i.dashboard).sort((a, b) => a.team.localeCompare(b.team));

  const normDate = normalizeGameDate(date);
  if (hasGame(teamItemA.games, normDate, teamB)) {
    throw new Error(`Game already logged: ${teamA} vs ${teamB} on ${normDate}`);
  }

  let accuracyEntry = null;
  if (lockAccuracy) {
    const projection = buildProjectionSnapshot(dashboard, parameters, teamA, teamB);
    if (projection) {
      accuracyEntry = buildAccuracyEntryFromProjection(normDate, projection, {
        actA: Number(cornersA),
        actB: Number(cornersB),
      });
    }
  }

  const oppEloA = teamItemB.dashboard?.elo ?? null;
  const oppEloB = teamItemA.dashboard?.elo ?? null;
  const gamesA = [...(teamItemA.games || [])];
  const gamesB = [...(teamItemB.games || [])];

  gamesA.push(buildGameRecord({
    num: nextGameNum(gamesA),
    date: normDate,
    opponent: teamB,
    cf: cornersA,
    ca: cornersB,
    comp,
    venue,
    oppElo: oppEloA,
    included,
  }));

  gamesB.push(buildGameRecord({
    num: nextGameNum(gamesB),
    date: normDate,
    opponent: teamA,
    cf: cornersB,
    ca: cornersA,
    comp,
    venue: mirrorVenue(venue),
    oppElo: oppEloB,
    included,
  }));

  const now = new Date().toISOString();
  await putWcCornersItem({ ...teamItemA, games: gamesA, updatedAt: now });
  await putWcCornersItem({ ...teamItemB, games: gamesB, updatedAt: now });

  await recalcAndSaveWcCornersModel(season);

  if (accuracyEntry) {
    await saveWcCornersAccuracyEntry(season, accuracyEntry);
  }

  return { teamA, teamB, date: normDate, accuracyEntry };
};

export const saveWcCornersAccuracyEntry = async (season, entryInput) => {
  const { buildProjectionSnapshot, buildAccuracyEntryFromProjection, normalizeGameDate } = await import('../utils/wc2026GameEntry.js');

  const items = await getWcCornersItems(season);
  const existing = items.filter((i) => i.entityType === 'accuracy');

  let entry = { ...entryInput };
  const normDate = normalizeGameDate(entry.date);

  if (entry.lockProjection && !entry.projectionLocked) {
    const parameters = {};
    items.filter((i) => i.entityType === 'parameters').forEach((i) => Object.assign(parameters, i.data || {}));
    const dashboard = items.filter((i) => i.entityType === 'team').map((i) => i.dashboard);
    const projection = buildProjectionSnapshot(dashboard, parameters, entry.teamA, entry.teamB);
    if (!projection) throw new Error('Could not lock projection — team missing from dashboard');
    entry = buildAccuracyEntryFromProjection(normDate, projection, entry.actA != null ? {
      actA: entry.actA,
      actB: entry.actB,
    } : null);
    entry.date = normDate;
  }

  if (entry.actA != null && entry.actB != null && entry.projTotal != null) {
    const actA = Number(entry.actA);
    const actB = Number(entry.actB);
    entry.actA = actA;
    entry.actB = actB;
    entry.actTotal = actA + actB;
    entry.error = Number((entry.projTotal - entry.actTotal).toFixed(2));
    entry.absError = Math.abs(entry.error);
    entry.gradedAt = entry.gradedAt || new Date().toISOString();
  }

  const dup = existing.find(
    (i) => i.entry?.teamA === entry.teamA
      && i.entry?.teamB === entry.teamB
      && normalizeGameDate(i.entry?.date) === normDate
  );
  if (dup) {
    await putWcCornersItem({ ...dup, entry: { ...dup.entry, ...entry } });
    const allEntries = existing.map((i) => (i.id === dup.id ? { ...dup.entry, ...entry } : i.entry));
    const summary = await refreshWcAccuracySummary(season, allEntries);
    return { id: dup.id, entry: { ...dup.entry, ...entry }, summary };
  }

  const nextIndex = existing.length + 1;
  const id = `${wcSeasonId(season)}-accuracy-${String(nextIndex).padStart(3, '0')}`;
  await putWcCornersItem({ id, season, entityType: 'accuracy', entry });

  const allEntries = [...existing.map((i) => i.entry), entry];
  const summary = await refreshWcAccuracySummary(season, allEntries);
  return { id, entry, summary };
};

export const gradeWcCornersAccuracyEntry = async (season, entryId, { actA, actB }) => {
  const items = await getWcCornersItems(season);
  const item = items.find((i) => i.id === entryId && i.entityType === 'accuracy');
  if (!item) throw new Error(`Accuracy entry not found: ${entryId}`);

  const entry = { ...item.entry };
  if (entry.projTotal == null) {
    throw new Error('Grade requires locked projection — lock projection before the game is added to team logs');
  }

  const a = Number(actA);
  const b = Number(actB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('Actual corner counts must be numbers');
  }

  entry.actA = a;
  entry.actB = b;
  entry.actTotal = a + b;
  entry.error = Number((entry.projTotal - entry.actTotal).toFixed(2));
  entry.absError = Math.abs(entry.error);
  entry.gradedAt = new Date().toISOString();
  entry.projectionLocked = true;

  await putWcCornersItem({ ...item, entry });

  const allEntries = items
    .filter((i) => i.entityType === 'accuracy')
    .map((i) => (i.id === entryId ? entry : i.entry));
  const summary = await refreshWcAccuracySummary(season, allEntries);
  return { entry, summary };
};

export const updateWcCornersGameIncluded = async (season, teamName, gameKey, included) => {
  const items = await getWcCornersItems(season);
  const teamItem = items.find((i) => i.entityType === 'team' && i.team === teamName);
  if (!teamItem) throw new Error(`Team not found: ${teamName}`);

  const [date, opponent] = gameKey.split('|');
  const inc = included !== false;

  const patchGames = (games) => (games || []).map((g) => {
    if (g.date === date && g.opponent === opponent) return { ...g, included: inc };
    return g;
  });

  const gamesA = patchGames(teamItem.games);
  await putWcCornersItem({ ...teamItem, games: gamesA });

  const oppItem = items.find((i) => i.entityType === 'team' && i.team === opponent);
  if (oppItem) {
    const gamesB = patchGames(oppItem.games);
    await putWcCornersItem({ ...oppItem, games: gamesB });
  }

  await recalcAndSaveWcCornersModel(season);
  return gamesA;
};
