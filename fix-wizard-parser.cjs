// Script temporal: mueve el parser inline del wizard al util (una sola fuente de verdad)
const fs = require('fs');
const p = 'src/components/ReceptionCheckinWizard.tsx';
let lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);

// A) Remover el bloque inline del parser (banner ───── + parseCirculationCard completo)
const start = lines.findIndex((l) => l.includes('PARSER POSICIONAL'));
const bannerStart = start - 1; // línea del banner ─────...
const end = lines.findIndex((l, i) => i > start && l.trim() === 'return { data, found, missing };');
const closeIdx = end + 1; // línea '}'
lines.splice(bannerStart, closeIdx - bannerStart + 2); // banner + bloque + línea en blanco

// B) Remover la interfaz local RegistrationCardData (ahora vive en el util)
const idx = lines.findIndex((l) => l.trim() === 'interface RegistrationCardData {');
if (idx >= 0) lines.splice(idx, 10);

// C) Agregar el import del util después del import de EvidenceUploader
const impIdx = lines.findIndex((l) => l.includes('from "@/components/EvidenceUploader"'));
lines.splice(impIdx + 1, 0, 'import { parseCirculationCard, type OcrLine } from "@/utils/circulationCardOcr";');

fs.writeFileSync(p, lines.join('\n'));
console.log('Bloque removido: líneas', bannerStart + 1, 'a', closeIdx + 1, '| interfaz en:', idx + 1, '| import insertado en:', impIdx + 2);
