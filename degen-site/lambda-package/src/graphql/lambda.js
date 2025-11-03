/**
 * Lambda handler for GraphQL server
 * Uses apollo-server-lambda for serverless deployment
 */

import { ApolloServer } from 'apollo-server-lambda';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ event, context }) => {
    // Extract user from Cognito if using API Gateway authorizer
    const user = event.requestContext?.authorizer?.claims || null;
    return {
      user,
      event,
      context
    };
  },
  introspection: true,
  playground: true,
});

// Create Lambda handler with CORS
export const handler = server.createHandler({
  cors: {
    origin: '*',
    credentials: true,
  },
});

// Wrap handler for better error handling
export const wrappedHandler = async (event, context) => {
  try {
    return await handler(event, context);
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  }
};

// Export for compatibility
export { server };

