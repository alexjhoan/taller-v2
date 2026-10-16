// Generador de UIDs cortos para repuestos
// Usa timestamp (base36) + random (base36) = ~10-11 chars
// Para 8 chars: timestamp(6) + random(2) en base36

export function generateShortUid(): string {
  const timestamp = Date.now().toString(36); // ~6-7 chars en base36
  const random = Math.random().toString(36).substring(2, 4); // 2 chars
  return `${timestamp}${random}`.toUpperCase();
}

// Versión más corta si se necesita exactamente 8 chars
export function generateUid8(): string {
  const timestamp = (Date.now() % 1000000).toString(36).padStart(5, '0'); // 5 chars
  const random = Math.random().toString(36).substring(2, 4); // 2 chars
  const counter = Math.floor(Math.random() * 36).toString(36); // 1 char
  return `${timestamp}${random}${counter}`.toUpperCase();
}

// Export default
export default generateShortUid;