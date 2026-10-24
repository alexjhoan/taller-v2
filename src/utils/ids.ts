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

/**
 * Normaliza assigned_user_id a number[].
 * Acepta: array [3,5], string JSON "[3,5]", número/string legacy "3",
 * null/undefined/"" → [].
 *
 * El backend puede devolver el campo como JSON string (misma convención
 * que parts/service_items), como array, o como FK escalar legacy; en el
 * frontend siempre se trabaja con number[] (inclusión en el filtro del
 * técnico, usersMap.get() en OrderCard).
 */
export function toNumericIdArray(value: unknown): number[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'number') return Number.isFinite(value) ? [value] : [];

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return [];
    // String JSON de array ("[3,5]"): si JSON.parse falla → [] (nunca lanzar).
    if (trimmed.startsWith('[')) {
      try {
        return toNumericIdArray(JSON.parse(trimmed));
      } catch {
        return [];
      }
    }
    // Legacy "3" → [3]
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? [parsed] : [];
  }

  if (Array.isArray(value)) {
    // Filtrar nulls/strings inválidos con type guard (toNumericId ya normaliza).
    return value
      .map((item) => toNumericId(item))
      .filter((id): id is number => id !== null);
  }

  return [];
}
