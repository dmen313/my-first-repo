#!/usr/bin/env node
/**
 * Update MLB 2024 payout structure
 */

require('dotenv').config();
const http = require('http');
const https = require('https');

const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
const USE_DYNAMODB = process.env.USE_DYNAMODB === 'true';

// Simple fetch-like function using http/https
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data)
        });
      });
    });
    
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// New MLB 2024 payout structure
const newPayouts = [
  { level: 'Wild Card', teams: 4, percentage: 5.00 },
  { level: 'Division', teams: 8, percentage: 20.00 },
  { level: 'League', teams: 4, percentage: 24.00 },
  { level: 'World Series', teams: 2, percentage: 24.00 },
  { level: 'Winner', teams: 1, percentage: 27.00 } // Adjusted to total 100%
];

async function updatePayouts() {
  console.log('💰 Updating MLB 2024 payout structure...\n');

  try {
    // First, get existing payouts for MLB 2024
    const query = `
      query {
        getPayoutRows(league: "mlb", season: "2024") {
          id
          level
          teams
          percentage
        }
      }
    `;

    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const { data } = await response.json();
    const existingPayouts = data?.getPayoutRows || [];

    console.log(`Found ${existingPayouts.length} existing payouts for MLB 2024`);

    // Delete existing payouts
    for (const payout of existingPayouts) {
      const deleteMutation = `
        mutation {
          deletePayoutRow(id: "${payout.id}")
        }
      `;

      await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: deleteMutation })
      });
    }

    console.log(`✅ Deleted ${existingPayouts.length} existing payouts\n`);

    // Create new payouts
    for (const payout of newPayouts) {
      const createMutation = `
        mutation {
          createPayoutRow(input: {
            league: "mlb"
            season: "2024"
            level: "${payout.level}"
            teams: ${payout.teams}
            percentage: ${payout.percentage}
          }) {
            id
            level
            teams
            percentage
          }
        }
      `;

      const createResponse = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: createMutation })
      });

      const createResult = await createResponse.json();
      if (createResult.errors) {
        console.error(`❌ Error creating ${payout.level}:`, createResult.errors);
      } else if (createResult.data?.createPayoutRow) {
        console.log(`✅ Created: ${payout.level} (${payout.teams} teams, ${payout.percentage}%)`);
      } else {
        console.error(`❌ Failed to create: ${payout.level}`, createResult);
      }
    }

    console.log('\n✅ MLB 2024 payout structure updated successfully!');
    console.log('\nNew structure:');
    newPayouts.forEach(p => {
      console.log(`  - ${p.level}: ${p.teams} teams, ${p.percentage}%`);
    });
    console.log(`\nTotal: ${newPayouts.reduce((sum, p) => sum + p.percentage, 0)}%`);

  } catch (error) {
    console.error('❌ Error updating payouts:', error.message);
    process.exit(1);
  }
}

updatePayouts();

