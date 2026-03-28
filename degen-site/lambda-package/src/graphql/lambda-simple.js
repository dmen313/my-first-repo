/**
 * Simplified Lambda handler for testing
 */

export const handler = async (event, context) => {
  console.log('Handler called', JSON.stringify(event, null, 2));
  
  try {
    // Try to import and initialize
    const { ApolloServer } = await import('apollo-server-lambda');
    const { typeDefs } = await import('./schema.js');
    const { resolvers } = await import('./resolvers.js');
    
    console.log('✅ Imports successful');
    
    const server = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ event, context }) => {
        return {
          user: event.requestContext?.authorizer?.claims || null,
        };
      },
      introspection: true,
    });
    
    const apolloHandler = server.createHandler({
      cors: {
        origin: '*',
        credentials: true,
      },
    });
    
    console.log('✅ Server created, calling handler');
    const result = await apolloHandler(event, context);
    console.log('✅ Handler result:', result?.statusCode);
    
    return result;
  } catch (error) {
    console.error('❌ Error in handler:', error);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 10).join('\n')
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    };
  }
};

