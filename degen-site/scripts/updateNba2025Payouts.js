#!/usr/bin/env node

/**
 * Update NBA 2025 Payout Structure
 * Deletes existing payouts and creates new ones based on the provided values
 */

require('dotenv').config();
const { 
  getPayoutRows, 
  deletePayoutRow, 
  createPayoutRow 
} = require('../src/services/dynamoDBService');

async function updateNba2025Payouts() {
  console.log('🏀 Updating NBA 2025 Payout Structure\n');

  try {
    // Step 1: Delete existing NBA 2025 payouts
    console.log('🗑️  Deleting existing NBA 2025 payouts...');
    const existingPayouts = await getPayoutRows('nba', '2025');
    console.log(`   Found ${existingPayouts.length} existing payouts`);
    
    for (const payout of existingPayouts) {
      await deletePayoutRow(payout.id);
      console.log(`   ✓ Deleted: ${payout.level}`);
    }
    console.log('✅ Existing payouts deleted\n');

    // Step 2: Create new NBA 2025 payouts based on screenshot
    console.log('📝 Creating new NBA 2025 payouts...');
    
    const newPayouts = [
      { level: 'Round 1', teams: 16, percentage: 16.00 },
      { level: 'Round 2', teams: 8, percentage: 16.00 },
      { level: 'Conference', teams: 4, percentage: 18.00 },
      { level: 'Finals', teams: 2, percentage: 17.50 },
      { level: 'Winner', teams: 1, percentage: 18.50 },
      { level: 'Worst Team', teams: 1, percentage: 2.50 },
      { level: '1st place in west and east conf', teams: 2, percentage: 7.50 },
      { level: '2nd place in west and east conf', teams: 2, percentage: 4.00 }
    ];

    for (const payout of newPayouts) {
      const created = await createPayoutRow({
        league: 'nba',
        season: '2025',
        ...payout
      });
      console.log(`   ✓ Created: ${payout.level} - ${payout.teams} teams - ${payout.percentage}%`);
    }

    console.log('\n✅ NBA 2025 Payout Structure Updated Successfully!');
    console.log('\n📊 Summary:');
    console.log('   Total Pool: $2,000');
    console.log('   Payout Levels: 8');
    console.log('   Total Percentage: 100.00%\n');

    // Verify the new structure
    console.log('🔍 Verifying new structure...');
    const verifyPayouts = await getPayoutRows('nba', '2025');
    console.log(`   Found ${verifyPayouts.length} payouts after update`);
    
    const totalPercentage = verifyPayouts.reduce((sum, p) => sum + p.percentage, 0);
    console.log(`   Total percentage: ${totalPercentage.toFixed(2)}%`);
    
    if (Math.abs(totalPercentage - 100) < 0.01) {
      console.log('   ✅ Percentage total is correct!');
    } else {
      console.warn(`   ⚠️  Warning: Total percentage is ${totalPercentage}%, expected 100%`);
    }

  } catch (error) {
    console.error('❌ Error updating NBA 2025 payouts:', error);
    process.exit(1);
  }
}

updateNba2025Payouts();

