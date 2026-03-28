/**
 * Data source configuration
 * Determines whether to use GraphQL (via Lambda) or direct DynamoDB access
 */

export const USE_DIRECT_DYNAMODB = process.env.REACT_APP_USE_DIRECT_DYNAMODB === 'true';

