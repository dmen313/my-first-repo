#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function resizeLogo(logoName, scale = 0.5) {
  console.log(`🏟️ Resizing ${logoName} logo to ${scale * 100}%...`);
  
  const logoPath = path.join(__dirname, `../public/logos/${logoName}.svg`);
  const backupPath = path.join(__dirname, `../public/logos/${logoName}_backup.svg`);
  
  try {
    // Check if logo exists
    if (!fs.existsSync(logoPath)) {
      console.log(`❌ Logo file not found: ${logoPath}`);
      return;
    }
    
    // Read the current logo
    const svgContent = fs.readFileSync(logoPath, 'utf8');
    
    // Create backup
    fs.writeFileSync(backupPath, svgContent);
    console.log(`✅ Backup created: ${logoName}_backup.svg`);
    
    // Find width, height, and viewBox
    const widthMatch = svgContent.match(/width="([^"]+)"/);
    const heightMatch = svgContent.match(/height="([^"]+)"/);
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
    
    let newSvgContent = svgContent;
    
    if (widthMatch) {
      const currentWidth = parseFloat(widthMatch[1]);
      const newWidth = currentWidth * scale;
      newSvgContent = newSvgContent.replace(
        /width="[^"]*"/,
        `width="${newWidth}"`
      );
      console.log(`📏 Width: ${currentWidth} → ${newWidth}`);
    }
    
    if (heightMatch) {
      const currentHeight = parseFloat(heightMatch[1]);
      const newHeight = currentHeight * scale;
      newSvgContent = newSvgContent.replace(
        /height="[^"]*"/,
        `height="${newHeight}"`
      );
      console.log(`📏 Height: ${currentHeight} → ${newHeight}`);
    }
    
    if (viewBoxMatch) {
      const viewBox = viewBoxMatch[1];
      const [x, y, width, height] = viewBox.split(' ').map(Number);
      const newWidth = width * scale;
      const newHeight = height * scale;
      const newViewBox = `${x} ${y} ${newWidth} ${newHeight}`;
      
      newSvgContent = newSvgContent.replace(
        /viewBox="[^"]*"/,
        `viewBox="${newViewBox}"`
      );
      console.log(`📏 ViewBox: ${viewBox} → ${newViewBox}`);
    }
    
    // Write the resized logo
    fs.writeFileSync(logoPath, newSvgContent);
    
    // Show file sizes
    const originalSize = fs.statSync(backupPath).size;
    const newSize = fs.statSync(logoPath).size;
    console.log(`📁 Original size: ${originalSize} bytes`);
    console.log(`📁 New size: ${newSize} bytes`);
    console.log(`✅ ${logoName} logo resized successfully!`);
    
  } catch (error) {
    console.error(`❌ Error resizing ${logoName} logo:`, error.message);
    
    // Restore from backup if it exists
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, logoPath);
      console.log(`🔄 Restored original ${logoName} logo from backup`);
    }
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const logoName = args[0];
const scale = parseFloat(args[1]) || 0.5;

if (!logoName) {
  console.log('Usage: node resizeLogo.js <logo-name> [scale]');
  console.log('Example: node resizeLogo.js mlb 0.5');
  console.log('Available logos: mlb, nba, nfl, ncaa');
  process.exit(1);
}

resizeLogo(logoName, scale);






