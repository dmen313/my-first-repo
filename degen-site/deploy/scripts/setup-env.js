#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up .env file for NCAA data population...\n');

const exampleEnvPath = path.join(__dirname, 'example.env');
const envPath = path.join(__dirname, '..', '.env');

// Check if .env already exists
if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists!');
  console.log('📝 Please edit the existing .env file with your API keys:');
  console.log(`   ${envPath}`);
  console.log('\n🔑 Required keys:');
  console.log('   - ODDS_API_KEY (from https://the-odds-api.com/)');
  console.log('   - CFBD_API_KEY (from https://collegefootballdata.com/)');
  process.exit(0);
}

// Copy example.env to .env
try {
  const exampleContent = fs.readFileSync(exampleEnvPath, 'utf8');
  fs.writeFileSync(envPath, exampleContent);
  
  console.log('✅ Created .env file from example');
  console.log(`📁 Location: ${envPath}`);
  console.log('\n📝 Next steps:');
  console.log('   1. Edit .env file with your actual API keys');
  console.log('   2. Get API keys from:');
  console.log('      • ODDS_API_KEY: https://the-odds-api.com/');
  console.log('      • CFBD_API_KEY: https://collegefootballdata.com/');
  console.log('   3. Run: npm run populate-ncaa');
  
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
  console.log('\n🔧 Manual setup:');
  console.log('   1. Copy scripts/example.env to .env');
  console.log('   2. Edit .env with your API keys');
  process.exit(1);
}

