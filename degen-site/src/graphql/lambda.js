/**
 * Lambda handler for GraphQL server
 * Uses apollo-server-lambda for serverless deployment
 */

// Ensure environment variables are set BEFORE any imports
if (!process.env.USE_DYNAMODB) {
  process.env.USE_DYNAMODB = 'true';
}

if (!process.env.AWS_REGION && process.env.REGION) {
  process.env.AWS_REGION = process.env.REGION;
}

if (!process.env.AWS_REGION) {
  process.env.AWS_REGION = 'us-east-1';
}

console.log('🔧 Lambda environment:', {
  USE_DYNAMODB: process.env.USE_DYNAMODB,
  AWS_REGION: process.env.AWS_REGION,
  NODE_ENV: process.env.NODE_ENV
});

// Lazy load Apollo Server to catch initialization errors
let apolloHandler = null;

async function initializeHandler() {
  if (apolloHandler) return apolloHandler;
  
  try {
    console.log('📦 Loading Apollo Server...');
    const { ApolloServer } = await import('apollo-server-lambda');
    const { typeDefs } = await import('./schema.js');
    const { resolvers } = await import('./resolvers.js');
    
    console.log('✅ Modules loaded');
    
    const server = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ event, context }) => {
        return {
          user: event.requestContext?.authorizer?.claims || null,
        };
      },
      introspection: true,
      formatError: (err) => {
        console.error('GraphQL Error:', err);
        return {
          message: err.message,
          locations: err.locations,
          path: err.path,
        };
      },
    });
    
    // apollo-server-lambda doesn't require start() - it's handled by createHandler
    // Don't set CORS here - we'll handle it in the wrapper to avoid duplicates
    apolloHandler = server.createHandler();
    
    console.log('✅ Apollo handler created');
    return apolloHandler;
  } catch (error) {
    console.error('❌ Error initializing Apollo Server:', error);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Lambda handler
export const handler = async (event, context) => {
  try {
    console.log('🔵 Lambda handler invoked', {
      httpMethod: event.httpMethod,
      path: event.path
    });
    
    // Handle OPTIONS preflight request
    if (event.httpMethod === 'OPTIONS') {
      console.log('🔄 Handling OPTIONS preflight request');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        },
        body: ''
      };
    }
    
    const handlerFn = await initializeHandler();
    const result = await handlerFn(event, context);
    
    // Fix CORS headers - Apollo may use multiValueHeaders which can cause duplicates
    if (result) {
      // Flatten multiValueHeaders to regular headers to avoid duplicates
      const headers = {};
      
      // Process multiValueHeaders first (Apollo uses this)
      if (result.multiValueHeaders) {
        Object.keys(result.multiValueHeaders).forEach(key => {
          const values = result.multiValueHeaders[key];
          // Take the first value only to avoid duplicates
          headers[key.toLowerCase()] = Array.isArray(values) ? values[0] : values;
        });
        delete result.multiValueHeaders;
      }
      
      // Then add any existing single headers
      if (result.headers) {
        Object.keys(result.headers).forEach(key => {
          headers[key.toLowerCase()] = result.headers[key];
        });
      }
      
      // Set our CORS headers (these will override any duplicates)
      headers['access-control-allow-origin'] = '*';
      headers['access-control-allow-methods'] = 'GET, POST, OPTIONS';
      headers['access-control-allow-headers'] = 'Content-Type, Authorization';
      
      result.headers = headers;
    }
    
    console.log('✅ Handler completed');
    return result;
  } catch (error) {
    console.error('❌ Lambda handler error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack?.split('\n').slice(0, 20).join('\n'));
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        errors: [{
          message: error.message || 'Internal server error',
          extensions: {
            code: 'INTERNAL_SERVER_ERROR'
          }
        }]
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    };
  }
};


