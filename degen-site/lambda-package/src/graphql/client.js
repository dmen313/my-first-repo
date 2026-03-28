import { ApolloClient, InMemoryCache, createHttpLink, gql } from '@apollo/client';
import { USE_DIRECT_DYNAMODB } from '../config/dataSource';

// Create Apollo Client - always created, but configured differently based on data source
let client = null;

if (!USE_DIRECT_DYNAMODB) {
  // Create HTTP link to GraphQL server
  const httpLink = createHttpLink({
    uri: process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
  });

  // Create Apollo Client
  client = new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            getPayoutRows: {
              merge: false, // Don't merge, always replace
            },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'all',
      },
      query: {
        errorPolicy: 'all',
      },
    },
  });
} else {
  // Create a minimal Apollo Client that works but doesn't make network requests
  // This is needed because hooks still need an Apollo Client instance in context
  // The hooks will be skipped via the skip option, but the client must exist
  const noOpLink = createHttpLink({
    uri: 'data:,', // Data URI to prevent actual network requests
    fetch: () => Promise.resolve(new Response(JSON.stringify({ data: {} }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
  });

  client = new ApolloClient({
    link: noOpLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'ignore',
      },
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'ignore',
      },
    },
  });
}

export { client };

// GraphQL Queries
export const GET_TEAMS = gql`
  query GetTeams($league: String, $season: String) {
    getTeams(league: $league, season: $season) {
      id
      name
      record
      league
      division
      sportsLeague
      wins
      losses
      gamesBack
      wildCardGamesBack
      owner
      odds
      season
      createdAt
      updatedAt
    }
  }
`;

export const GET_TEAM_WITH_ACHIEVEMENTS = gql`
  query GetTeamWithAchievements($id: ID!) {
    getTeam(id: $id) {
      id
      name
      record
      league
      division
      wins
      losses
      gamesBack
      wildCardGamesBack
      owner
      odds
      achievements {
        id
        achievementType
        achieved
        season
        league
        createdAt
        updatedAt
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_TEAMS_BY_OWNER = gql`
  query GetTeamsByOwner($owner: String!) {
    getTeamsByOwner(owner: $owner) {
      id
      name
      record
      league
      division
      wins
      losses
      gamesBack
      wildCardGamesBack
      owner
      odds
      achievements {
        id
        achievementType
        achieved
      }
    }
  }
`;

export const GET_PAYOUT_ROWS = gql`
  query GetPayoutRows($league: String!, $season: String!) {
    getPayoutRows(league: $league, season: $season) {
      id
      league
      season
      level
      teams
      percentage
      createdAt
      updatedAt
    }
  }
`;

export const GET_OWNERS = gql`
  query GetOwners {
    getOwners {
      id
      name
      abbreviation
      totalAchievements
      teams {
        id
        name
        league
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_ACHIEVEMENTS = gql`
  query GetAchievements($league: String, $season: String, $teamId: ID) {
    getAchievements(league: $league, season: $season, teamId: $teamId) {
      id
      teamId
      achievementType
      achieved
      season
      league
      createdAt
      updatedAt
    }
  }
`;

// GraphQL Mutations
export const CREATE_TEAM = gql`
  mutation CreateTeam($input: TeamInput!) {
    createTeam(input: $input) {
      id
      name
      record
      league
      division
      wins
      losses
      gamesBack
      wildCardGamesBack
      owner
      odds
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_TEAM = gql`
  mutation UpdateTeam($input: UpdateTeamInput!) {
    updateTeam(input: $input) {
      id
      name
      record
      league
      division
      wins
      losses
      gamesBack
      wildCardGamesBack
      owner
      odds
      updatedAt
    }
  }
`;

export const UPDATE_TEAM_API_DATA = gql`
  mutation UpdateTeamApiData($id: ID!, $input: TeamApiDataInput!) {
    updateTeamApiData(id: $id, input: $input) {
      id
      name
      record
      wins
      losses
      gamesBack
      wildCardGamesBack
      odds
      updatedAt
    }
  }
`;

export const CREATE_ACHIEVEMENT = gql`
  mutation CreateAchievement($input: AchievementInput!) {
    createAchievement(input: $input) {
      id
      teamId
      achievementType
      achieved
      season
      league
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_ACHIEVEMENT = gql`
  mutation UpdateAchievement($input: UpdateAchievementInput!) {
    updateAchievement(input: $input) {
      id
      teamId
      achievementType
      achieved
      updatedAt
    }
  }
`;

export const UPDATE_TEAM_ACHIEVEMENTS = gql`
  mutation UpdateTeamAchievements($teamId: ID!, $achievements: [AchievementInput!]!) {
    updateTeamAchievements(teamId: $teamId, achievements: $achievements) {
      id
      teamId
      achievementType
      achieved
      season
      league
      updatedAt
    }
  }
`;

export const CREATE_PAYOUT_ROW = gql`
  mutation CreatePayoutRow($input: PayoutRowInput!) {
    createPayoutRow(input: $input) {
      id
      league
      season
      level
      teams
      percentage
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_PAYOUT_ROW = gql`
  mutation UpdatePayoutRow($id: ID!, $input: PayoutRowInput!) {
    updatePayoutRow(id: $id, input: $input) {
      id
      league
      season
      level
      teams
      percentage
      updatedAt
    }
  }
`;

export const DELETE_PAYOUT_ROW = gql`
  mutation DeletePayoutRow($id: ID!) {
    deletePayoutRow(id: $id)
  }
`;

export const GET_LEAGUE_SETTINGS = gql`
  query GetLeagueSettings($league: String!, $season: String!) {
    getLeagueSettings(league: $league, season: $season) {
      id
      league
      season
      buyInPerTeam
      numTeams
      totalPool
      createdAt
      updatedAt
    }
  }
`;

// Draft Queries
export const GET_DRAFT_PICKS = gql`
  query GetDraftPicks($league: String!, $season: String!) {
    getDraftPicks(league: $league, season: $season) {
      id
      league
      season
      round
      pickNumber
      owner
      teamId
      teamName
      createdAt
      updatedAt
    }
  }
`;

export const GET_DRAFT_PICK = gql`
  query GetDraftPick($id: ID!) {
    getDraftPick(id: $id) {
      id
      league
      season
      round
      pickNumber
      owner
      teamId
      teamName
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_LEAGUE_SETTINGS = gql`
  mutation CreateLeagueSettings($input: LeagueSettingsInput!) {
    createLeagueSettings(input: $input) {
      id
      league
      season
      buyInPerTeam
      numTeams
      totalPool
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_LEAGUE_SETTINGS = gql`
  mutation UpdateLeagueSettings($input: UpdateLeagueSettingsInput!) {
    updateLeagueSettings(input: $input) {
      id
      league
      season
      buyInPerTeam
      numTeams
      totalPool
      updatedAt
    }
  }
`;

export const DELETE_LEAGUE_SETTINGS = gql`
  mutation DeleteLeagueSettings($id: ID!) {
    deleteLeagueSettings(id: $id)
  }
`;

// Team Mapping queries
export const GET_TEAM_MAPPINGS = gql`
  query GetTeamMappings($league: String, $season: String) {
    getTeamMappings(league: $league, season: $season) {
      id
      cfbdId
      cfbdName
      cfbdMascot
      cfbdConference
      cfbdAbbreviation
      oddsApiName
      oddsApiOdds
      league
      season
      matchType
      createdAt
      updatedAt
    }
  }
`;

export const GET_TEAM_MAPPING = gql`
  query GetTeamMapping($id: ID!) {
    getTeamMapping(id: $id) {
      id
      cfbdId
      cfbdName
      cfbdMascot
      cfbdConference
      cfbdAbbreviation
      oddsApiName
      oddsApiOdds
      league
      season
      matchType
      createdAt
      updatedAt
    }
  }
`;

export const GET_TEAM_MAPPING_BY_CFBD_ID = gql`
  query GetTeamMappingByCfbdId($cfbdId: Int!) {
    getTeamMappingByCfbdId(cfbdId: $cfbdId) {
      id
      cfbdId
      cfbdName
      cfbdMascot
      cfbdConference
      cfbdAbbreviation
      oddsApiName
      oddsApiOdds
      league
      season
      matchType
      createdAt
      updatedAt
    }
  }
`;

export const GET_TEAM_MAPPING_BY_ODDS_API_NAME = gql`
  query GetTeamMappingByOddsApiName($oddsApiName: String!) {
    getTeamMappingByOddsApiName(oddsApiName: $oddsApiName) {
      id
      cfbdId
      cfbdName
      cfbdMascot
      cfbdConference
      cfbdAbbreviation
      oddsApiName
      oddsApiOdds
      league
      season
      matchType
      createdAt
      updatedAt
    }
  }
`;

// Team Mapping mutations
export const CREATE_TEAM_MAPPING = gql`
  mutation CreateTeamMapping($input: TeamMappingInput!) {
    createTeamMapping(input: $input) {
      id
      cfbdId
      cfbdName
      cfbdMascot
      cfbdConference
      cfbdAbbreviation
      oddsApiName
      oddsApiOdds
      league
      season
      matchType
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_TEAM_MAPPING = gql`
  mutation UpdateTeamMapping($input: UpdateTeamMappingInput!) {
    updateTeamMapping(input: $input) {
      id
      cfbdId
      cfbdName
      cfbdMascot
      cfbdConference
      cfbdAbbreviation
      oddsApiName
      oddsApiOdds
      league
      season
      matchType
      updatedAt
    }
  }
`;

export const DELETE_TEAM_MAPPING = gql`
  mutation DeleteTeamMapping($id: ID!) {
    deleteTeamMapping(id: $id)
  }
`;

// Draft mutations
export const CREATE_DRAFT_PICK = gql`
  mutation CreateDraftPick($input: DraftPickInput!) {
    createDraftPick(input: $input) {
      id
      league
      season
      round
      pickNumber
      owner
      teamId
      teamName
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_DRAFT_PICK = gql`
  mutation UpdateDraftPick($input: UpdateDraftPickInput!) {
    updateDraftPick(input: $input) {
      id
      league
      season
      round
      pickNumber
      owner
      teamId
      teamName
      updatedAt
    }
  }
`;

export const DELETE_DRAFT_PICK = gql`
  mutation DeleteDraftPick($id: ID!) {
    deleteDraftPick(id: $id)
  }
`;

export const INITIALIZE_DRAFT = gql`
  mutation InitializeDraft($league: String!, $season: String!, $owners: [String!]!) {
    initializeDraft(league: $league, season: $season, owners: $owners) {
      id
      league
      season
      round
      pickNumber
      owner
      teamId
      teamName
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_NBA_TEAMS_FROM_API = gql`
  mutation UpdateNbaTeamsFromApi($league: String!, $season: String!) {
    updateNbaTeamsFromApi(league: $league, season: $season) {
      success
      teamsUpdated
      oddsUpdated
      recordsUpdated
      totalTeams
      error
      message
    }
  }
`;

export const REORDER_DRAFT_PICKS = gql`
  mutation ReorderDraftPicks($league: String!, $season: String!, $owners: [String!]!) {
    reorderDraftPicks(league: $league, season: $season, owners: $owners) {
      id
      league
      season
      round
      pickNumber
      owner
      teamId
      teamName
      createdAt
      updatedAt
    }
  }
`;

// Helper functions for common operations
export const fetchTeamsByLeague = async (league, season) => {
  try {
    const { data } = await client.query({
      query: GET_TEAMS,
      variables: { league, season },
      fetchPolicy: 'cache-first',
    });
    return data.getTeams;
  } catch (error) {
    console.error('Error fetching teams:', error);
    throw error;
  }
};

export const fetchPayoutStructure = async (league, season) => {
  try {
    const { data } = await client.query({
      query: GET_PAYOUT_ROWS,
      variables: { league, season },
      fetchPolicy: 'cache-first',
    });
    return data.getPayoutRows;
  } catch (error) {
    console.error('Error fetching payout structure:', error);
    throw error;
  }
};

export const updateTeamAchievements = async (teamId, achievements) => {
  try {
    const { data } = await client.mutate({
      mutation: UPDATE_TEAM_ACHIEVEMENTS,
      variables: { teamId, achievements },
    });
    return data.updateTeamAchievements;
  } catch (error) {
    console.error('Error updating team achievements:', error);
    throw error;
  }
};

export const updatePayoutRow = async (id, payoutData) => {
  try {
    const { data } = await client.mutate({
      mutation: UPDATE_PAYOUT_ROW,
      variables: { id, input: payoutData },
    });
    return data.updatePayoutRow;
  } catch (error) {
    console.error('Error updating payout row:', error);
    throw error;
  }
};

export const createPayoutRow = async (payoutData) => {
  try {
    const { data } = await client.mutate({
      mutation: CREATE_PAYOUT_ROW,
      variables: { input: payoutData },
    });
    return data.createPayoutRow;
  } catch (error) {
    console.error('Error creating payout row:', error);
    throw error;
  }
};

export const deletePayoutRow = async (id) => {
  try {
    const { data } = await client.mutate({
      mutation: DELETE_PAYOUT_ROW,
      variables: { id },
    });
    return data.deletePayoutRow;
  } catch (error) {
    console.error('Error deleting payout row:', error);
    throw error;
  }
};

export const fetchLeagueSettings = async (league, season) => {
  try {
    const { data } = await client.query({
      query: GET_LEAGUE_SETTINGS,
      variables: { league, season },
      fetchPolicy: 'cache-first',
    });
    return data.getLeagueSettings;
  } catch (error) {
    console.error('Error fetching league settings:', error);
    throw error;
  }
};

export const createLeagueSettings = async (settingsData) => {
  try {
    const { data } = await client.mutate({
      mutation: CREATE_LEAGUE_SETTINGS,
      variables: { input: settingsData },
    });
    return data.createLeagueSettings;
  } catch (error) {
    console.error('Error creating league settings:', error);
    throw error;
  }
};

export const updateLeagueSettings = async (id, settingsData) => {
  try {
    const { data } = await client.mutate({
      mutation: UPDATE_LEAGUE_SETTINGS,
      variables: { id, input: settingsData },
    });
    return data.updateLeagueSettings;
  } catch (error) {
    console.error('Error updating league settings:', error);
    throw error;
  }
};

export const deleteLeagueSettings = async (id) => {
  try {
    const { data } = await client.mutate({
      mutation: DELETE_LEAGUE_SETTINGS,
      variables: { id },
    });
    return data.deleteLeagueSettings;
  } catch (error) {
    console.error('Error deleting league settings:', error);
    throw error;
  }
};

// Team Mapping helper functions
export const fetchTeamMappings = async (league, season) => {
  try {
    const { data } = await client.query({
      query: GET_TEAM_MAPPINGS,
      variables: { league, season },
      fetchPolicy: 'cache-first',
    });
    return data.getTeamMappings;
  } catch (error) {
    console.error('Error fetching team mappings:', error);
    throw error;
  }
};

export const fetchTeamMappingByCfbdId = async (cfbdId) => {
  try {
    const { data } = await client.query({
      query: GET_TEAM_MAPPING_BY_CFBD_ID,
      variables: { cfbdId },
      fetchPolicy: 'cache-first',
    });
    return data.getTeamMappingByCfbdId;
  } catch (error) {
    console.error('Error fetching team mapping by CFBD ID:', error);
    throw error;
  }
};

export const fetchTeamMappingByOddsApiName = async (oddsApiName) => {
  try {
    const { data } = await client.query({
      query: GET_TEAM_MAPPING_BY_ODDS_API_NAME,
      variables: { oddsApiName },
      fetchPolicy: 'cache-first',
    });
    return data.getTeamMappingByOddsApiName;
  } catch (error) {
    console.error('Error fetching team mapping by Odds API name:', error);
    throw error;
  }
};

export const createTeamMapping = async (mappingData) => {
  try {
    const { data } = await client.mutate({
      mutation: CREATE_TEAM_MAPPING,
      variables: { input: mappingData },
    });
    return data.createTeamMapping;
  } catch (error) {
    console.error('Error creating team mapping:', error);
    throw error;
  }
};

export const updateTeamMapping = async (id, mappingData) => {
  try {
    const { data } = await client.mutate({
      mutation: UPDATE_TEAM_MAPPING,
      variables: { id, input: mappingData },
    });
    return data.updateTeamMapping;
  } catch (error) {
    console.error('Error updating team mapping:', error);
    throw error;
  }
};

export const deleteTeamMapping = async (id) => {
  try {
    const { data } = await client.mutate({
      mutation: DELETE_TEAM_MAPPING,
      variables: { id },
    });
    return data.deleteTeamMapping;
  } catch (error) {
    console.error('Error deleting team mapping:', error);
    throw error;
  }
};

// Draft helper functions
export const fetchDraftPicks = async (league, season) => {
  try {
    const { data } = await client.query({
      query: GET_DRAFT_PICKS,
      variables: { league, season },
      fetchPolicy: 'cache-first',
    });
    return data.getDraftPicks;
  } catch (error) {
    console.error('Error fetching draft picks:', error);
    throw error;
  }
};

export const fetchDraftPick = async (id) => {
  try {
    const { data } = await client.query({
      query: GET_DRAFT_PICK,
      variables: { id },
      fetchPolicy: 'cache-first',
    });
    return data.getDraftPick;
  } catch (error) {
    console.error('Error fetching draft pick:', error);
    throw error;
  }
};

export const createDraftPick = async (pickData) => {
  try {
    const { data } = await client.mutate({
      mutation: CREATE_DRAFT_PICK,
      variables: { input: pickData },
    });
    return data.createDraftPick;
  } catch (error) {
    console.error('Error creating draft pick:', error);
    throw error;
  }
};

export const updateDraftPick = async (id, pickData) => {
  try {
    const { data } = await client.mutate({
      mutation: UPDATE_DRAFT_PICK,
      variables: { id, input: pickData },
    });
    return data.updateDraftPick;
  } catch (error) {
    console.error('Error updating draft pick:', error);
    throw error;
  }
};

export const deleteDraftPick = async (id) => {
  try {
    const { data } = await client.mutate({
      mutation: DELETE_DRAFT_PICK,
      variables: { id },
    });
    return data.deleteDraftPick;
  } catch (error) {
    console.error('Error deleting draft pick:', error);
    throw error;
  }
};

export const initializeDraft = async (league, season, owners) => {
  try {
    const { data } = await client.mutate({
      mutation: INITIALIZE_DRAFT,
      variables: { league, season, owners },
    });
    return data.initializeDraft;
  } catch (error) {
    console.error('Error initializing draft:', error);
    throw error;
  }
};

export const updateTeamApiData = async (teamId, apiData) => {
  try {
    // Check if using direct DynamoDB
    const { USE_DIRECT_DYNAMODB } = await import('../config/dataSource.js');
    
    if (USE_DIRECT_DYNAMODB) {
      // Use DynamoDB service directly
      const { updateTeam } = await import('../services/dynamoDBService.js');
      return await updateTeam(teamId, apiData);
    } else {
      // Use GraphQL mutation
      const { data } = await client.mutate({
        mutation: UPDATE_TEAM_API_DATA,
        variables: { id: teamId, input: apiData },
      });
      return data.updateTeamApiData;
    }
  } catch (error) {
    console.error('Error updating team API data:', error);
    throw error;
  }
};

export default client;
