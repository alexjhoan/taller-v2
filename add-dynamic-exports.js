const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'pages');

function addDynamicExport(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Skip if already has dynamic export
  if (content.includes('export const dynamic')) {
    return false;
  }
  
  // Skip API routes
  if (filePath.includes('/api/')) {
    return false;
  }
  
  // Skip _app.tsx, _document.tsx, _error.tsx
  const fileName = path.basename(filePath);
  if (fileName.startsWith('_')) {
    return false;
  }
  
  // Add dynamic export after imports
  const lines = content.split('\n');
  let insertIndex = -1;
  
  // Find the last import line
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('import(')) {
      insertIndex = i;
    }
  }
  
  if (insertIndex === -1) {
    // No imports found, add at the beginning
    lines.unshift("export const dynamic = 'force-dynamic';");
  } else {
    lines.splice(insertIndex + 1, 0, "\nexport const dynamic = 'force-dynamic';");
  }
  
  fs.writeFileSync(filePath, lines.join('\n'));
  return true;
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const fullPath = path.join(dir, file);
      // Skip _app.tsx, _document.tsx, _error.tsx, _middleware.ts
      const fileName = path.basename(filePath);
      if (!fileName.startsWith('_')) {
        const modified = addDynamicExport(fullPath);
        if (modified) {
          console.log(`Added dynamic export to: ${path.relative(__dirname, filePath)}`);
        }
      }
    }
  }
}

processDirectory(pagesDir);
console.log('Done adding dynamic exports to all pages.');