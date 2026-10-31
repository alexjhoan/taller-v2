const fs = require('fs');
let content = fs.readFileSync('src/components/ReceptionCheckinWizard.tsx', 'utf-8');
// Remove the extra ')}' at line 1506 (index 1505)
const lines = content.split('\n');
// Line 1506 is index 1505, which should be empty or just ')}'
// Remove it if it matches
if (lines[1505]?.trim() === ')}') {
  lines.splice(1505, 1);
  fs.writeFileSync('src/components/ReceptionCheckinWizard.tsx', lines.join('\n'));
  console.log('Fixed - removed extra line');
} else {
  console.log('Line 1506:', JSON.stringify(lines[1505]));
}