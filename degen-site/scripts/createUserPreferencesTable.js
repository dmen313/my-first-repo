#!/usr/bin/env node
/**
 * Create user preferences table in DynamoDB
 */

import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const TABLE_NAME = 'sports-hub-user-preferences';

const client = new DynamoDBClient({ region: 'us-east-1' });

async function tableExists() {
  try {
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
}

async function createTable() {
  console.log(`Creating table: ${TABLE_NAME}`);
  
  const command = new CreateTableCommand({
    TableName: TABLE_NAME,
    KeySchema: [
      { AttributeName: 'id', KeyType: 'HASH' }  // id = "{userId}-{leagueId}"
    ],
    AttributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST'
  });
  
  await client.send(command);
  console.log(`✅ Table ${TABLE_NAME} created successfully`);
}

async function main() {
  try {
    const exists = await tableExists();
    
    if (exists) {
      console.log(`Table ${TABLE_NAME} already exists`);
      return;
    }
    
    await createTable();
    
    // Wait for table to be active
    console.log('Waiting for table to become active...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ Table is ready');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
