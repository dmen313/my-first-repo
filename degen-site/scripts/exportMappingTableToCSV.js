#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// GraphQL endpoint
const GRAPHQL_ENDPOINT = process.env.REACT_APP_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

// Simple GraphQL client using fetch
async function graphqlRequest(query, variables = {}) {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(`GraphQL Error: ${result.errors[0].message}`);
    }
    
    return result.data;
  } catch (error) {
    console.error('GraphQL request failed:', error.message);
    throw error;
  }
}

// Get all team mappings
async function getTeamMappings() {
  const data = await graphqlRequest(`
    query {
      getTeamMappings {
        id
        cfbdId
        cfbdName
        cfbdMascot
        cfbdConference
        cfbdAbbreviation
        oddsApiName
        oddsApiOdds
        league
        season
        matchType
        createdAt
        updatedAt
      }
    }
  `);
  return data.getTeamMappings;
}

// Convert array of objects to CSV
function arrayToCSV(data) {
  if (data.length === 0) {
    return '';
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV header row
  const csvHeader = headers.join(',');
  
  // Create CSV data rows
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      // Handle values that need quotes (contain commas, quotes, or newlines)
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });
  
  return [csvHeader, ...csvRows].join('\n');
}

// Generate filename with timestamp
function generateFilename() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
  return `team_mappings_${timestamp}.csv`;
}

async function main() {
  try {
    console.log('📊 Exporting team mapping table to CSV...\n');

    // Get all team mappings
    const mappings = await getTeamMappings();
    
    if (mappings.length === 0) {
      console.log('❌ No team mappings found in the database.');
      return;
    }

    console.log(`📈 Found ${mappings.length} team mappings`);

    // Sort mappings by conference, then by team name
    const sortedMappings = mappings.sort((a, b) => {
      if (a.cfbdConference !== b.cfbdConference) {
        return a.cfbdConference.localeCompare(b.cfbdConference);
      }
      return a.cfbdName.localeCompare(b.cfbdName);
    });

    // Convert to CSV
    const csvContent = arrayToCSV(sortedMappings);

    // Generate filename
    const filename = generateFilename();
    const filepath = path.join(process.cwd(), filename);

    // Write to file
    fs.writeFileSync(filepath, csvContent, 'utf8');

    console.log(`✅ Successfully exported ${mappings.length} team mappings to: ${filename}`);

    // Show summary by conference
    console.log('\n📋 Summary by Conference:');
    const conferenceGroups = sortedMappings.reduce((acc, mapping) => {
      const conference = mapping.cfbdConference || 'Unknown';
      if (!acc[conference]) acc[conference] = [];
      acc[conference].push(mapping);
      return acc;
    }, {});

    Object.entries(conferenceGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([conference, teams]) => {
        console.log(`  ${conference}: ${teams.length} teams`);
      });

    // Show sample of the data
    console.log('\n📄 CSV Preview (first 5 rows):');
    const lines = csvContent.split('\n');
    lines.slice(0, 6).forEach((line, index) => {
      if (index === 0) {
        console.log(`  Header: ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
      } else {
        console.log(`  Row ${index}: ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
      }
    });

    console.log(`\n💾 File saved to: ${filepath}`);
    console.log(`📏 File size: ${(csvContent.length / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ Error exporting mapping table:', error.message);
    process.exit(1);
  }
}

// Run the script
main();

