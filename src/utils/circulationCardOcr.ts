// Parser posicional del certificado de circulación (INTT, Venezuela).
// El certificado NO etiqueta la mayoría de campos; la información es POSICIONAL:
//
//   fila serial+placa  → único campo etiquetado ("Placa: XXX")
//   fila siguiente     → nombre del propietario (solo letras, sin dígitos)
//   fila de la cédula  → cédula (V/J/E/G + 6-10 dígitos) + marca a la derecha
//   fila siguiente     → modelo (+ año impreso a la derecha; el OCR a veces lo
//                        lee pegado o duplicado: "2013/2013" → "0132013")
//   filas tipo         → AUTOMOVIL PARTICULAR / SEDAN (se ignoran para modelo)
//   fila de specs      → peso (KGS) + ejes + COLOR (última palabra tras EJES)
//
// Tesseract.js entrega cada línea con su bounding box (x, y): las usamos como
// "filas" del certificado para reconstruir esa estructura.
// Comentarios en español; nombres técnicos en inglés.

export interface OcrLine {
  text: string; // texto en mayúsculas con espacios normalizados
  y: number; // posición vertical (px) de la línea en la imagen
  x: number; // posición horizontal (px) donde inicia la línea
}

export interface RegistrationCardData {
  plate?: string;
  make?: string;
  model?: string;
  year?: string;
  color?: string;
  ownerName?: string;
  ownerId?: string;
}

export interface ParsedCard {
  data: RegistrationCardData;
  found: string[]; // etiquetas de campos detectados
  missing: string[]; // etiquetas de campos NO detectados
}

const YEAR_MIN = 1950;
const YEAR_MAX = 2035;

const CAR_BRANDS = [
  "MITSUBISHI", "TOYOTA", "FORD", "CHEVROLET", "NISSAN", "HYUNDAI", "KIA", "MAZDA",
  "VOLKSWAGEN", "RENAULT", "FIAT", "JEEP", "DODGE", "CHRYSLER", "BMW",
  "MERCEDES BENZ", "AUDI", "HONDA", "SUZUKI", "ISUZU", "DAIHATSU", "PEUGEOT",
  "CITROEN", "SEAT", "SKODA", "VOLVO", "LAND ROVER", "SSANGYONG", "GREAT WALL",
  "CHERY", "JAC", "DFSK", "BAIC", "TATA", "MAHINDRA", "PORSCHE", "SUBARU",
];

const COLOR_WORDS = [
  "PLATA", "BLANCO", "NEGRO", "ROJO", "AZUL", "GRIS", "VERDE", "AMARILLO",
  "BEIGE", "DORADO", "CAFE", "CAFÉ", "MARRON", "MARRÓN", "CELESTE", "NARANJA",
  "VINOTINTO", "PERLA", "TURQUESA", "GUINDA", "CREMA", "BRONCE",
];

const VEHICLE_TYPE_WORDS = [
  "AUTOMOVIL", "PARTICULAR", "CAMIONETA", "CAMION", "SEDAN", "PICK", "SUV",
  "MOTOCICLETA", "CARGO", "PASAJEROS", "CABINA", "VAGON",
];

export const toTitleCase = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
    // Los tokens con dígitos (cilindrada "1.3L", tracción "4X4") conservan mayúsculas
    .replace(/\S*\d\S*/g, (token) => token.toUpperCase());

/** Limpia una línea OCR: mayúsculas y solo caracteres útiles (quita §, |, —, comillas, etc.). */
function cleanLine(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-ZÁÉÍÓÚÑÜ0-9\s.\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Año a partir del ÚLTIMO token numérico de la fila.
 * El año va impreso a la derecha de la fila del modelo y el OCR a veces lo lee
 * pegado o duplicado ("2013/2013" → "0132013"): tomamos los ÚLTIMOS 4 dígitos
 * del token y validamos el rango. Devuelve también la fila sin ese token para
 * usarla como modelo.
 */
function yearFromTrailingToken(text: string): { year: string | null; rest: string } {
  const tokens = text.split(" ").filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    // Token puramente numérico (el OCR puede meter / . - separadores)
    if (/^\d+([/.\-]\d+)*$/.test(token)) {
      const digits = token.replace(/\D/g, "");
      if (digits.length >= 4) {
        const candidate = digits.slice(-4);
        const n = parseInt(candidate, 10);
        if (n >= YEAR_MIN && n <= YEAR_MAX) {
          const rest = tokens.filter((_, idx) => idx !== i).join(" ").trim();
          return { year: candidate, rest };
        }
      }
      // Era numérico pero no parece año: no buscar más atrás
      return { year: null, rest: text };
    }
    if (/[A-ZÁÉÍÓÚÑÜ]/.test(token)) {
      // Llegamos a una palabra con letras: los años van al final de la fila
      return { year: null, rest: text };
    }
  }
  return { year: null, rest: text };
}

export function parseCirculationCard(rawLines: OcrLine[]): ParsedCard {
  const data: RegistrationCardData = {};
  const found: string[] = [];
  const missing: string[] = [];

  const cleaned = rawLines
    .map((l) => ({ ...l, text: cleanLine(l.text) }))
    .filter((l) => l.text.length > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x); // orden de lectura: arriba→abajo, izq→der

  console.log("[OCR-PARSE] Líneas limpias y ordenadas por posición (fila y → columna x):");
  console.table(cleaned.map((l) => ({ fila_y: l.y, col_x: l.x, texto: l.text })));

  // ── 1) PLACA ── único campo etiquetado ("Placa: XXX")
  let placa: string | null = null;
  const placaLine = cleaned.find((l) => l.text.includes("PLACA"));
  if (placaLine) {
    const afterLabel = placaLine.text.split("PLACA").slice(1).join(" ");
    // Token de 5-8 caracteres con AL MENOS una letra y un dígito (descarta el serial)
    const m = afterLabel.match(/\b(?=[A-Z0-9]{5,8}\b)(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]+\b/);
    if (m) placa = m[0];
    console.log(
      "[OCR-PARSE] · PLACA (etiquetada):",
      placa ? `✓ "${placa}" (fila y=${placaLine.y}: "${placaLine.text}")` : "✗ etiqueta hallada pero sin código válido",
    );
  }
  if (!placa) {
    // Fallback: buscar token con formato de placa venezolana en cualquier fila
    for (const l of cleaned) {
      const token = l.text.split(" ").find((t) => /^[A-Z]{2,3}\d{2,3}[A-Z]{0,2}$/.test(t) && t.length >= 5);
      if (token) {
        placa = token;
        console.log(`[OCR-PARSE] · PLACA (fallback por formato): ✓ "${token}"`);
        break;
      }
    }
  }
  if (placa) {
    data.plate = placa;
    found.push("placa");
  } else {
    missing.push("placa");
  }

  // ── 2) CÉDULA (fila ancla) ── formato venezolano: V/J/E/G + 6-10 dígitos
  let cedLineIdx = -1;
  let cedula: string | null = null;
  for (let i = 0; i < cleaned.length; i++) {
    const m = cleaned[i].text.match(/\b([VJEG])\s?-?(\d{6,10})\b/);
    if (m) {
      cedula = `${m[1]}${m[2]}`;
      cedLineIdx = i;
      break;
    }
  }
  console.log(
    "[OCR-PARSE] · CÉDULA:",
    cedula
      ? `✓ "${cedula}" (fila ancla y=${cleaned[cedLineIdx].y}: "${cleaned[cedLineIdx].text}")`
      : "✗ no encontrada",
  );

  // ── 3) MARCA ── misma fila que la cédula, texto después de ella
  let marca: string | null = null;
  let modelo: string | null = null;
  let modeloLineY: number | null = null;
  if (cedLineIdx >= 0) {
    const lineText = cleaned[cedLineIdx].text;
    const cedMatch = lineText.match(/\b([VJEG])\s?-?(\d{6,10})\b/);
    const afterCed = cedMatch ? lineText.slice((cedMatch.index ?? 0) + cedMatch[0].length).trim() : "";

    const brandHit = CAR_BRANDS.find((b) => afterCed.includes(b));
    if (brandHit) {
      marca = brandHit;
      console.log(`[OCR-PARSE] · MARCA: ✓ "${brandHit}" (marca conocida en la fila de la cédula)`);
    } else if (afterCed) {
      marca = afterCed.split(" ")[0];
      console.log(`[OCR-PARSE] · MARCA: ✓ "${marca}" (primera palabra tras la cédula)`);
    } else {
      console.log("[OCR-PARSE] · MARCA: ✗ fila de la cédula sin texto adicional");
    }

    // ── 4) MODELO ── resto de la fila de la cédula (tras la marca), o la fila siguiente
    // Si el resto tras la marca es muy corto (≤2 chars, ej: "EA"), se descarta y se usa la fila siguiente
    if (brandHit) {
      const rest = afterCed.split(brandHit).slice(1).join(" ").trim();
      if (rest && rest.length > 2) {
        modelo = rest;
        modeloLineY = cleaned[cedLineIdx].y;
        console.log(`[OCR-PARSE] · MODELO: ✓ "${modelo}" (resto de la fila de la cédula)`);
      } else {
        console.log(`[OCR-PARSE] · MODELO: resto muy corto ("${rest}"), se ignorará y buscará en fila siguiente`);
      }
    }
    if (!modelo && cedLineIdx + 1 < cleaned.length) {
      const nextLine = cleaned[cedLineIdx + 1];
      const isTypeLine = VEHICLE_TYPE_WORDS.some((w) => nextLine.text.startsWith(w));
      if (isTypeLine) {
        console.log(`[OCR-PARSE] · MODELO: fila siguiente (${nextLine.text}) es tipo de vehículo, se ignora`);
      } else {
        const { year, rest } = yearFromTrailingToken(nextLine.text);
        if (year) data.year = year;
        // Limpia puntuación inicial (• . , ; :) y espacios
        const cleanModelo = rest.replace(/^[.\s•,;:]+/, "").trim();
        if (cleanModelo && cleanModelo.length >= 2) {
          modelo = cleanModelo;
          modeloLineY = nextLine.y;
          console.log(
            `[OCR-PARSE] · MODELO: ✓ "${modelo}" (fila siguiente a la cédula, y=${nextLine.y})`,
            year ? `· año de la misma fila: "${year}"` : "",
          );
        }
      }
    }
  }
  if (cedula) {
    data.ownerId = cedula;
    found.push("cédula");
  } else {
    missing.push("cédula");
  }
  if (marca) {
    data.make = toTitleCase(marca);
    found.push("marca");
  } else {
    missing.push("marca");
  }

  // ── 5) AÑO ── ya capturado de la fila del modelo; si no, buscar en otras filas
  if (!data.year) {
    for (const l of cleaned) {
      // Token numérico independiente de 4+ dígitos cuyo final sea un año válido
      const tokens = l.text.split(" ");
      for (const t of tokens) {
        if (/^\d{4,10}$/.test(t)) {
          const candidate = t.slice(-4);
          const n = parseInt(candidate, 10);
          if (n >= YEAR_MIN && n <= YEAR_MAX) {
            data.year = candidate;
            break;
          }
        }
      }
      if (data.year) {
        found.push("año");
        console.log(`[OCR-PARSE] · AÑO: ✓ "${data.year}" (encontrado en otra fila, y=${l.y})`);
        break;
      }
    }
  } else {
    found.push("año");
    console.log(`[OCR-PARSE] · AÑO: ✓ "${data.year}" (misma fila que el modelo)`);
  }
  if (!data.year) {
    missing.push("año");
    console.log("[OCR-PARSE] · AÑO: ✗ no encontrado");
  }
  if (modelo) {
    data.model = toTitleCase(modelo);
    found.push("modelo");
  } else {
    missing.push("modelo");
  }

  // ── 6) NOMBRE ── fila solo-letras inmediatamente ANTES de la fila de la cédula
  // Filtra ruido OCR común: "IB", "Y", "VR", "MY", "EO", "DE", etc. (1-2 letras sueltas al inicio)
  const NAME_NOISE_PREFIXES = [
    "IB ",
    "Y ",
    "VR ",
    "MY ",
    "EO ",
    "DE ",
    "EN ",
    "LA ",
    "EL ",
    "LOS ",
    "LAS ",
    "UN ",
    "UNA ",
  ];
  function cleanNameCandidate(t: string): string {
    let s = t;
    for (const p of NAME_NOISE_PREFIXES) {
      if (s.startsWith(p)) s = s.slice(p.length);
    }
    return s;
  }
  function looksLikeName(t: string): boolean {
    // Debe tener al menos 2 palabras de 3+ letras (nombres reales), no siglas sueltas
    const words = t.split(" ").filter((w) => w.length >= 3);
    return words.length >= 2;
  }

  let nombre: string | null = null;
  if (cedLineIdx >= 1) {
    for (let i = cedLineIdx - 1; i >= Math.max(0, cedLineIdx - 2); i--) {
      const t = cleaned[i].text;
      console.log(`[OCR-PARSE] · NOMBRE: evaluando fila y=${cleaned[i].y} → "${t}"`);
      if (/PLACA|CERTIFICADO|CIRCULAC|INTT|NITT|RNT/.test(t)) break;
      if (/^[A-ZÁÉÍÓÚÑÜ\s.]{5,60}$/.test(t)) {
        const cleanedCandidate = cleanNameCandidate(t);
        if (looksLikeName(cleanedCandidate)) {
          nombre = cleanedCandidate;
          break;
        }
      }
    }
  }
  if (nombre) {
    data.ownerName = toTitleCase(nombre);
    found.push("nombre del propietario");
    console.log(`[OCR-PARSE] · NOMBRE: ✓ "${nombre}" (fila solo-letras sobre la cédula)`);
  } else {
    missing.push("nombre del propietario");
    console.log("[OCR-PARSE] · NOMBRE: ✗ no encontrado");
  }

  // ── 7) COLOR ── fila de especificaciones ("400 KGS 2 EJES PLATA") → texto tras EJES
  let color: string | null = null;
  const specsLine = cleaned.find((l) => /\bEJES?\b|\bKGS?\b/.test(l.text));
  if (specsLine) {
    const parts = specsLine.text.split(/\b(?:EJES?|KGS?)\b/);
    const tail = parts[parts.length - 1].replace(/\d+/g, "").trim();
    if (tail.length >= 3) color = tail;
    console.log(
      "[OCR-PARSE] · COLOR (fila de specs):",
      color ? `✓ "${color}" (tras EJES/KGS, y=${specsLine.y})` : "✗ sin texto útil tras EJES/KGS",
    );
  }
  if (!color) {
    // Fallback: buscar un color conocido en cualquier fila
    for (const l of cleaned) {
      const hit = COLOR_WORDS.find((w) => new RegExp(`\\b${w}\\b`).test(l.text));
      if (hit) {
        color = hit;
        console.log(`[OCR-PARSE] · COLOR (fallback por lista): ✓ "${hit}"`);
        break;
      }
    }
  }
  if (color) {
    data.color = toTitleCase(color);
    found.push("color");
  } else {
    missing.push("color");
    console.log("[OCR-PARSE] · COLOR: ✗ no encontrado (la fila KGS/EJES no fue leída por el OCR)");
  }

  console.log("[OCR-PARSE] ── RESULTADO DEL PARSER ──", { found, missing, data });
  return { data, found, missing };
}
