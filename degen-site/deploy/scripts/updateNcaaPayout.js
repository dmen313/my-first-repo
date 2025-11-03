require('dotenv').config();

// GraphQL client for Node.js
async function graphqlRequest(query, variables = {}) {
  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result.data;
}

// Fetch existing payout rows
async function fetchPayoutRows() {
  const data = await graphqlRequest(`
    query GetPayoutRows($league: String!, $season: String!) {
      getPayoutRows(league: $league, season: $season) {
        id
        level
        teams
        percentage
      }
    }
  `, { league: 'ncaa', season: '2025' });

  return data.getPayoutRows || [];
}

// Delete payout row
async function deletePayoutRow(id) {
  const result = await graphqlRequest(`
    mutation DeletePayoutRow($id: ID!) {
      deletePayoutRow(id: $id)
    }
  `, { id });

  return result.deletePayoutRow;
}

// Create payout row
async function createPayoutRow(payoutData) {
  const result = await graphqlRequest(`
    mutation CreatePayoutRow($input: PayoutRowInput!) {
      createPayoutRow(input: $input) {
        id
        level
        teams
        percentage
      }
    }
  `, { input: payoutData });

  return result.createPayoutRow;
}

// Main function to update NCAA payout structure
async function main() {
  try {
    console.log('🏈 Updating NCAA Football 2025 payout structure...');
    
    // Fetch existing payout rows
    console.log('📊 Fetching existing payout structure...');
    const existingPayouts = await fetchPayoutRows();
    console.log(`✅ Found ${existingPayouts.length} existing payout levels`);
    
    // Delete existing payout rows
    console.log('🗑️  Deleting existing payout structure...');
    for (const payout of existingPayouts) {
      console.log(`🗑️  Deleting: ${payout.level}`);
      await deletePayoutRow(payout.id);
    }
    
    // New payout structure based on $6,000 prize pool
    const newPayoutStructure = [
      {
        level: "First seed in playoffs",
        teams: 1,
        percentage: 20.83 // $1,250 / $6,000 = 20.83%
      },
      {
        level: "2nd seed in playoffs",
        teams: 1,
        percentage: 12.5 // $750 / $6,000 = 12.5%
      },
      {
        level: "3rd seed in playoffs",
        teams: 1,
        percentage: 10.0 // $600 / $6,000 = 10.0%
      },
      {
        level: "4th seed in playoffs",
        teams: 1,
        percentage: 6.67 // $400 / $6,000 = 6.67%
      },
      {
        level: "5th seed in playoffs",
        teams: 1,
        percentage: 5.0 // $300 / $6,000 = 5.0%
      },
      {
        level: "Made CFP - 12 teams",
        teams: 7,
        percentage: 23.33 // $1,400 / $6,000 = 23.33%
      },
      {
        level: "Made Top 25 not in playoff",
        teams: 13,
        percentage: 21.67 // $1,300 / $6,000 = 21.67%
      }
    ];
    
    // Create new payout rows
    console.log('\n🔄 Creating new payout structure...');
    let createdCount = 0;
    
    for (const payout of newPayoutStructure) {
      try {
        const payoutData = {
          league: 'ncaa',
          season: '2025',
          level: payout.level,
          teams: payout.teams,
          percentage: payout.percentage
        };
        
        console.log(`✅ Creating: ${payout.level} (${payout.teams} teams, ${payout.percentage}%)`);
        await createPayoutRow(payoutData);
        createdCount++;
        
      } catch (error) {
        console.error(`❌ Error creating ${payout.level}:`, error.message);
      }
    }
    
    console.log('\n✅ NCAA Football 2025 payout structure updated!');
    console.log(`📈 Created ${createdCount} payout levels`);
    console.log(`💰 Total Prize Pool: $6,000.00`);
    console.log('\n📊 New Payout Structure:');
    console.log('Level | Teams | Percentage | Payout');
    console.log('------|-------|------------|-------');
    console.log('First seed in playoffs | 1 | 20.83% | $1,250.00');
    console.log('2nd seed in playoffs | 1 | 12.5% | $750.00');
    console.log('3rd seed in playoffs | 1 | 10.0% | $600.00');
    console.log('4th seed in playoffs | 1 | 6.67% | $400.00');
    console.log('5th seed in playoffs | 1 | 5.0% | $300.00');
    console.log('Made CFP - 12 teams | 7 | 23.33% | $1,400.00');
    console.log('Made Top 25 not in playoff | 13 | 21.67% | $1,300.00');
    console.log(`🕒 Completed at: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

