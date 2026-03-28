/**
 * Test Lambda handler to isolate the issue
 */

console.log('🔧 Lambda test handler loading...');

let server;
let handler;

try {
  console.log('📦 Importing dependencies...');
  const { ApolloServer } = await import('apollo-server-lambda');
  const { typeDefs } = await import('./schema.js');
  const { resolvers } = await import('./resolvers.js');
  
  console.log('✅ Dependencies imported successfully');
  
  server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ event, context }) => {
      return {
        user: event.requestContext?.authorizer?.claims || null,
        event,
        context
      };
    },
    introspection: true,
    playground: true,
  });
  
  handler = server.createHandler({
    cors: {
      origin: '*',
      credentials: true,
    },
  });
  
  console.log('✅ Apollo Server created');
} catch (error) {
  console.error('❌ Error initializing server:', error);
  handler = async (event, context) => {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Initialization error',
        message: error.message,
        stack: error.stack
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  };
}

export const handler2 = async (event, context) => {
  console.log('Lambda handler called');
  try {
    const result = await handler(event, context);
    return result;
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Handler error',
        message: error.message,
        stack: error.stack
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  }
};

