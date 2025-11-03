import { startGraphQLServer } from '../src/graphql/server.js';

const PORT = process.env.GRAPHQL_PORT || 4000;

async function main() {
  try {
    console.log('🚀 Starting GraphQL Server...');
    const server = await startGraphQLServer(PORT);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down GraphQL Server...');
      server.close(() => {
        console.log('✅ GraphQL Server stopped');
        process.exit(0);
      });
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down GraphQL Server...');
      server.close(() => {
        console.log('✅ GraphQL Server stopped');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to start GraphQL Server:', error);
    process.exit(1);
  }
}

main();

