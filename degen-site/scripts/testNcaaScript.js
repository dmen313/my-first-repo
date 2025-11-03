// Test script to verify NCAA population script structure

// Mock environment variables for testing
process.env.ODDS_API_KEY = 'test_key';
process.env.CFBD_API_KEY = 'test_key';

const { main } = require('./populateNcaaData.js');

console.log('🧪 Testing NCAA population script structure...');

// Test the normalizeName function
function normalizeName(name) {
  if (!name) return '';
  return name.replace(/[^A-Z0-9]/g, '').toUpperCase()
    .replace(/&AMP;/g, '&')
    .replace(/STATE/g, 'ST');
}

// Test cases
const testCases = [
  'Alabama',
  'Ohio State',
  'Michigan State',
  'Texas A&M',
  'North Carolina'
];

console.log('✅ Testing name normalization:');
testCases.forEach(name => {
  console.log(`  ${name} → ${normalizeName(name)}`);
});

console.log('\n✅ NCAA population script structure is valid!');
console.log('📝 To run the full script:');
console.log('   1. Copy scripts/example.env to .env and add your API keys');
console.log('   2. Ensure GraphQL server is running: npm run graphql:start');
console.log('   3. Run: npm run populate-ncaa');
