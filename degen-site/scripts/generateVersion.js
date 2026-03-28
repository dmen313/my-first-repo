#!/usr/bin/env node

/**
 * Generates a version.json file with build information
 * This runs during the build process to embed version info in the app
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Generate in public folder so it gets copied to build during build process
const publicDir = path.join(__dirname, '..', 'public');
const versionFile = path.join(publicDir, 'version.json');

// Get git commit hash (if available)
let gitCommit = 'unknown';
let gitBranch = 'unknown';
try {
  gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
} catch (error) {
  // Not a git repo or git not available
}

// Get package version
const packageJson = require(path.join(__dirname, '..', 'package.json'));
const packageVersion = packageJson.version || '0.1.0';

// Build timestamp
const buildTime = new Date().toISOString();
const buildDate = new Date().toLocaleString('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

const versionInfo = {
  version: packageVersion,
  buildTime,
  buildDate,
  gitCommit,
  gitBranch,
  environment: process.env.NODE_ENV || 'production'
};

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write version file to public directory (will be copied during build)
fs.writeFileSync(versionFile, JSON.stringify(versionInfo, null, 2));

// Also write to build directory if it exists (post-build scenario)
const buildDir = path.join(__dirname, '..', 'build');
const buildVersionFile = path.join(buildDir, 'version.json');
if (fs.existsSync(buildDir)) {
  fs.writeFileSync(buildVersionFile, JSON.stringify(versionInfo, null, 2));
}

console.log('✅ Version info generated:');
console.log(`   Version: ${packageVersion}`);
console.log(`   Build Date: ${buildDate}`);
console.log(`   Git Commit: ${gitCommit}`);
console.log(`   Git Branch: ${gitBranch}`);

