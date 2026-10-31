const fs = require('fs');
let content = fs.readFileSync('src/components/ReceptionCheckinWizard.tsx', 'utf-8');

// Fix 1: Wrap the map in a fragment to satisfy JSX single parent requirement
content = content.replace(
  '{filteredUsers && filteredUsers.length === 0 ? (\n                <p className="text-center text-slate-500 py-4">No hay usuarios disponibles con este filtro</p>\n              ) : (\n                filteredUsers?.map((user) => {',
  '{filteredUsers && filteredUsers.length === 0 ? (\n                <p className="text-center text-slate-500 py-4">No hay usuarios disponibles con este filtro</p>\n              ) : (\n                <>\n                  filteredUsers?.map((user) => {'
);

// Fix 2: Close the fragment
content = content.replace(
  '                )}\n              </div>',
  '                )}\n                </>\n              </div>'
);

fs.writeFileSync('src/components/ReceptionCheckinWizard.tsx', content);
console.log('Fixed ternary fragment');