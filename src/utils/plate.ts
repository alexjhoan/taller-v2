/**
 * Valida una placa colombiana.
 * Formatos válidos: ABC123 (carro) o ABC1234 (moto)
 */
export function isValidColombianPlate(plate: string): boolean {
  const cleanPlate = plate.toUpperCase().trim();
  // Carro: 3 letras + 3 dígitos
  const carPattern = /^[A-Z]{3}\d{3}$/;
  // Moto: 3 letras + 2 dígitos + 1 letra
  const motoPattern = /^[A-Z]{3}\d{2}[A-Z]$/;
  return carPattern.test(cleanPlate) || motoPattern.test(cleanPlate);
}

/**
 * Normaliza una placa colombiana a mayúsculas sin espacios.
 */
export function normalizePlate(plate: string): string {
  return plate.toUpperCase().replace(/\s/g, '');
}

/**
 * Formatea una placa para mostrar con guion.
 * Ej: ABC123 -> ABC-123
 */
export function formatPlate(plate: string): string {
  const clean = normalizePlate(plate);
  if (clean.length === 6) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return clean;
}
