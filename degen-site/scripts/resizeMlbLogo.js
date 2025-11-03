const fs = require('fs');
const path = require('path');

function resizeMlbLogo() {
  console.log('🏟️ Resizing MLB logo to 50%...');
  
  const logoPath = path.join(__dirname, '../public/logos/mlb.svg');
  const backupPath = path.join(__dirname, '../public/logos/mlb_backup.svg');
  
  try {
    // Read the current MLB logo
    const svgContent = fs.readFileSync(logoPath, 'utf8');
    
    // Create backup
    fs.writeFileSync(backupPath, svgContent);
    console.log('✅ Backup created: mlb_backup.svg');
    
    // Parse the SVG to find viewBox and dimensions
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
    const widthMatch = svgContent.match(/width="([^"]+)"/);
    const heightMatch = svgContent.match(/height="([^"]+)"/);
    
    if (viewBoxMatch) {
      const viewBox = viewBoxMatch[1];
      const [x, y, width, height] = viewBox.split(' ').map(Number);
      
      // Calculate 50% dimensions
      const newWidth = width * 0.5;
      const newHeight = height * 0.5;
      const newViewBox = `${x} ${y} ${newWidth} ${newHeight}`;
      
      // Replace viewBox
      let newSvgContent = svgContent.replace(
        /viewBox="[^"]*"/,
        `viewBox="${newViewBox}"`
      );
      
      // Replace width and height if they exist
      if (widthMatch) {
        const currentWidth = parseFloat(widthMatch[1]);
        const newWidthStr = currentWidth * 0.5;
        newSvgContent = newSvgContent.replace(
          /width="[^"]*"/,
          `width="${newWidthStr}"`
        );
      }
      
      if (heightMatch) {
        const currentHeight = parseFloat(heightMatch[1]);
        const newHeightStr = currentHeight * 0.5;
        newSvgContent = newSvgContent.replace(
          /height="[^"]*"/,
          `height="${newHeightStr}"`
        );
      }
      
      // Write the resized logo
      fs.writeFileSync(logoPath, newSvgContent);
      
      console.log('✅ MLB logo resized to 50%');
      console.log(`📏 Original viewBox: ${viewBox}`);
      console.log(`📏 New viewBox: ${newViewBox}`);
      
      // Show file sizes
      const originalSize = fs.statSync(backupPath).size;
      const newSize = fs.statSync(logoPath).size;
      console.log(`📁 Original size: ${originalSize} bytes`);
      console.log(`📁 New size: ${newSize} bytes`);
      
    } else {
      console.log('❌ Could not find viewBox in SVG');
      console.log('💡 Creating a simple resized version...');
      
      // Simple approach: wrap in a scaled group
      const resizedSvg = svgContent.replace(
        /<svg([^>]*)>/,
        '<svg$1><g transform="scale(0.5)">'
      ).replace(
        /<\/svg>/,
        '</g></svg>'
      );
      
      fs.writeFileSync(logoPath, resizedSvg);
      console.log('✅ MLB logo resized using transform scale(0.5)');
    }
    
  } catch (error) {
    console.error('❌ Error resizing MLB logo:', error.message);
    
    // Restore from backup if it exists
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, logoPath);
      console.log('🔄 Restored original logo from backup');
    }
  }
}

// Run the script
resizeMlbLogo();




