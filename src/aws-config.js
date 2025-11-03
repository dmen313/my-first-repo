// AWS Configuration for AppSync GraphQL
// This file is prepared for future AWS AppSync integration

import { Amplify } from 'aws-amplify';

// AWS AppSync Configuration
// Replace these values with your actual AWS AppSync configuration
const awsConfig = {
  aws_appsync_graphqlEndpoint: process.env.REACT_APP_APPSYNC_GRAPHQL_ENDPOINT || 'YOUR_APPSYNC_ENDPOINT',
  aws_appsync_region: process.env.REACT_APP_APPSYNC_REGION || 'us-east-1',
  aws_appsync_authenticationType: process.env.REACT_APP_APPSYNC_AUTH_TYPE || 'API_KEY',
  aws_appsync_apiKey: process.env.REACT_APP_APPSYNC_API_KEY || 'YOUR_API_KEY',
};

// Initialize Amplify with AppSync configuration
export const configureAmplify = () => {
  Amplify.configure({
    API: {
      graphql_endpoint: awsConfig.aws_appsync_graphqlEndpoint,
      graphql_region: awsConfig.aws_appsync_region,
      graphql_authenticationType: awsConfig.aws_appsync_authenticationType,
      graphql_apiKey: awsConfig.aws_appsync_apiKey,
    },
  });
};

// Example GraphQL queries for MLB data
export const MLB_QUERIES = {
  // Get all teams
  GET_TEAMS: `
    query GetTeams {
      listTeams {
        items {
          id
          name
          league
          division
          venue {
            name
            city
          }
          wins
          losses
          winPercentage
          gamesBack
        }
      }
    }
  `,
  
  // Get team by ID
  GET_TEAM: `
    query GetTeam($id: ID!) {
      getTeam(id: $id) {
        id
        name
        league
        division
        venue {
          name
          city
        }
        wins
        losses
        winPercentage
        gamesBack
        standing {
          divisionRank
          leagueRank
          leagueRecord {
            wins
            losses
            pct
          }
        }
      }
    }
  `,
  
  // Get standings
  GET_STANDINGS: `
    query GetStandings($division: String) {
      listStandings(filter: { division: { eq: $division } }) {
        items {
          id
          division
          teamId
          wins
          losses
          winPercentage
          gamesBack
          divisionRank
          leagueRank
        }
      }
    }
  `,
};

// Example GraphQL mutations for updating team data
export const MLB_MUTATIONS = {
  // Update team record
  UPDATE_TEAM_RECORD: `
    mutation UpdateTeamRecord($id: ID!, $wins: Int!, $losses: Int!) {
      updateTeam(input: {
        id: $id
        wins: $wins
        losses: $losses
        winPercentage: $winPercentage
      }) {
        id
        name
        wins
        losses
        winPercentage
      }
    }
  `,
  
  // Create new team
  CREATE_TEAM: `
    mutation CreateTeam($input: CreateTeamInput!) {
      createTeam(input: $input) {
        id
        name
        league
        division
        venue {
          name
          city
        }
      }
    }
  `,
};

// Example subscription for real-time updates
export const MLB_SUBSCRIPTIONS = {
  // Subscribe to team updates
  ON_UPDATE_TEAM: `
    subscription OnUpdateTeam($id: ID!) {
      onUpdateTeam(id: $id) {
        id
        name
        wins
        losses
        winPercentage
        gamesBack
      }
    }
  `,
  
  // Subscribe to standings updates
  ON_UPDATE_STANDINGS: `
    subscription OnUpdateStandings($division: String!) {
      onUpdateStandings(division: $division) {
        id
        division
        teamId
        wins
        losses
        winPercentage
        gamesBack
        divisionRank
      }
    }
  `,
};

export default awsConfig;
