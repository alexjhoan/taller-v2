const fs = require('fs');
let content = fs.readFileSync('src/components/ReceptionCheckinWizard.tsx', 'utf-8');

// Undo the fragment changes - restore original
content = content.replace(
  '{filteredUsers && filteredUsers.length === 0 ? (\n                <p className="text-center text-slate-500 py-4">No hay usuarios disponibles con este filtro</p>\n              ) : (\n                <>\n                  filteredUsers?.map((user) => {',
  '{filteredUsers && filteredUsers.length === 0 ? (\n                <p className="text-center text-slate-500 py-4">No hay usuarios disponibles con este filtro</p>\n              ) : (\n                filteredUsers?.map((user) => {'
);

content = content.replace(
  '                )}\n                </>\n              </div>',
  '                )}\n              </div>'
);

fs.writeFileSync('src/components/ReceptionCheckinWizard.tsx', content);
console.log('Restored');