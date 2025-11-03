import dotenv from 'dotenv';
import { ApolloServer } from 'apollo-server-express';
import express from 'express';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';

dotenv.config();

const app = express();

// Add CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'graphql-server'
  });
});

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    // Add authentication context here if needed
    return {
      user: req.user || null,
    };
  },
  // Enable GraphQL Playground in development
  introspection: true,
  playground: true,
});

const startGraphQLServer = async (port = 4000) => {
  await server.start();
  server.applyMiddleware({ app, path: '/graphql' });

  return new Promise((resolve) => {
    const httpServer = app.listen(port, () => {
      console.log(`🚀 GraphQL Server ready at http://localhost:${port}${server.graphqlPath}`);
      resolve(httpServer);
    });
  });
};

export { startGraphQLServer, server, app };
