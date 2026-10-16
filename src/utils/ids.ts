/**
 * Normaliza ids que llegan desde la API.
 *
 * El backend MySQL devuelve algunos FK como string (p.ej.
 * `"assigned_user_id": "3"`), pero en el frontend se comparan contra
 * claves number (usersMap.get(), assigned_user_id === user.id), donde
 * `"3" !== 3`. Convertir en el punto de entrada evita ese fallo silencioso.
 */
export function toNumericId(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
