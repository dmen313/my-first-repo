#!/bin/bash

# World Series Odds Update Script
# This script runs the odds updater and handles dependencies

echo "🚀 World Series Odds Updater"
echo "=============================="

# Check if GraphQL server is running
echo "🔍 Checking GraphQL server..."
if ! curl -s http://localhost:4000/graphql > /dev/null; then
    echo "❌ GraphQL server is not running at http://localhost:4000"
    echo "💡 Please start the GraphQL server first:"
    echo "   npm run graphql:start"
    exit 1
fi

echo "✅ GraphQL server is running"

# Try Node.js version first
echo ""
echo "🔄 Running Node.js version..."
if command -v node &> /dev/null; then
    # Check if required packages are installed
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing Node.js dependencies..."
        npm install
    fi
    
    # Check for specific packages
    if ! npm list @apollo/client > /dev/null 2>&1; then
        echo "📦 Installing Apollo Client..."
        npm install @apollo/client graphql node-fetch
    fi
    
    echo "🚀 Executing Node.js odds updater..."
    node scripts/updateWorldSeriesOdds.js
    
    if [ $? -eq 0 ]; then
        echo "✅ Node.js version completed successfully!"
        exit 0
    else
        echo "❌ Node.js version failed, trying Python..."
    fi
else
    echo "⚠️ Node.js not found, trying Python..."
fi

# Try Python version as fallback
echo ""
echo "🔄 Running Python version..."
if command -v python3 &> /dev/null; then
    # Check if required packages are installed
    echo "📦 Checking Python dependencies..."
    python3 -c "import requests, gql, aiohttp" 2>/dev/null
    
    if [ $? -ne 0 ]; then
        echo "📦 Installing Python dependencies..."
        echo "💡 Run: pip3 install requests python-dotenv gql aiohttp"
        echo "❌ Please install Python dependencies and try again"
        exit 1
    fi
    
    echo "🚀 Executing Python odds updater..."
    python3 scripts/updateWorldSeriesOdds.py
    
    if [ $? -eq 0 ]; then
        echo "✅ Python version completed successfully!"
        exit 0
    else
        echo "❌ Python version also failed"
        exit 1
    fi
else
    echo "❌ Neither Node.js nor Python3 found"
    echo "💡 Please install Node.js or Python3 to run the odds updater"
    exit 1
fi




