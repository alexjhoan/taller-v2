const fs = require('fs');
let content = fs.readFileSync('src/components/ReceptionCheckinWizard.tsx', 'utf-8');
const lines = content.split('\n');

// Find the line with 'setIsSubmitting(true);' which is the first line of handleSubmit body
const submitStart = lines.findIndex(l => l.trim() === 'setIsSubmitting(true);');
console.log('setIsSubmitting at line:', submitStart + 1);

// Insert the useCallback wrapper before this line
const wrapper = [
  '  const handleSubmit = useCallback(',
  '    async (e: React.FormEvent) => {',
  '      e.preventDefault();',
  '',
  '      if (formData.checklist.length === 0) {',
  '        enqueueSnackbar("Debe agregar al menos un item al checklist", { variant: "error" });',
  '        return;',
  '      }',
  ''
];

// Insert at submitStart (0-indexed)
lines.splice(submitStart, 0, ...wrapper);

fs.writeFileSync('src/components/ReceptionCheckinWizard.tsx', lines.join('\n'));
console.log('Inserted handleSubmit wrapper at line', submitStart + 1);