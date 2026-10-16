// ============================================================
// Mecaflow Workshop OS — Restauración de sesión de usuario
// ============================================================
// Funciones puras: reciben el JWT y la cookie de usuario como
// argumentos y solo usan `import type`, de modo que se pueden
// probar con `node --test` (tests/session.test.mjs) sin resolver
// aliases de TS ni montar React.
// ============================================================

import type { User, UserRole } from '@/context/UserContext';

/** Vigencia de las cookies de sesión (JWT + datos de usuario): 7 días. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const VALID_ROLES: readonly string[] = ['admin', 'mechanic'];

type Claims = Record<string, unknown>;

function isRecord(value: unknown): value is Claims {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Acepta solo los roles conocidos: nunca se infiere un rol por defecto. */
export function normalizeRole(value: unknown): UserRole | null {
  if (typeof value !== 'string') return null;
  return VALID_ROLES.includes(value) ? (value as UserRole) : null;
}

/** Primer valor definido y no vacío entre las fuentes (en orden de prioridad). */
function pick(sources: Claims[], keys: string[]): unknown {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (value === undefined || value === null || value === '') continue;
      return value;
    }
  }
  return undefined;
}

function toText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function toId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return undefined;
}

/**
 * Decodifica el payload (segmento central, base64url) de un JWT.
 * Devuelve null si el token no es un JWT o si el payload no es JSON válido.
 */
export function decodeJwtPayload(token: string): Claims | null {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;

  const segment = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = segment + '='.repeat((4 - (segment.length % 4)) % 4);

  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Convierte los claims del JWT en datos de usuario (parciales). */
function claimsToUser(payload: Claims | null): Partial<User> | null {
  if (!payload) return null;

  // Algunos backends anidan el usuario en `user` o `data`; el nivel superior
  // tiene prioridad sobre lo anidado.
  const sources: Claims[] = [payload];
  for (const key of ['user', 'data']) {
    if (isRecord(payload[key])) sources.push(payload[key] as Claims);
  }

  const user: Partial<User> = {};
  const id = toId(pick(sources, ['id', 'user_id', 'sub', 'uid']));
  const firstName = toText(pick(sources, ['first_name', 'firstName', 'name']));
  const lastName = toText(pick(sources, ['last_name', 'lastName']));
  const role = normalizeRole(pick(sources, ['role', 'rol']));

  if (id !== undefined) user.id = id;
  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (role !== null) user.role = role;

  return user.firstName !== undefined || user.lastName !== undefined || user.role !== undefined || user.id !== undefined
    ? user
    : null;
}

/**
 * Lee los datos de usuario persistidos en la cookie de sesión.
 * react-cookie devuelve el objeto ya parseado, pero se acepta también el
 * string JSON por si se lee desde `document.cookie`.
 */
export function parseStoredUser(raw: unknown): User | null {
  let candidate: unknown = raw;

  if (typeof raw === 'string') {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!isRecord(candidate)) return null;

  const firstName = toText(pick([candidate], ['firstName', 'first_name', 'name']));
  const role = normalizeRole(candidate.role);
  // Sin nombre o sin rol no hay sesión restaurable (no se inventa "Usuario"/admin)
  if (firstName === undefined || role === null) return null;

  const user: User = { firstName, role };
  const id = toId(pick([candidate], ['id', 'user_id']));
  const lastName = toText(pick([candidate], ['lastName', 'last_name']));
  if (id !== undefined) user.id = id;
  if (lastName !== undefined) user.lastName = lastName;

  return user;
}

/**
 * Restaura el usuario de la sesión a partir del JWT y de los datos
 * persistidos en la cookie al hacer login.
 *
 * Prioridad: el JWT (firmado por el backend) manda en identidad (`id`) y
 * autorización (`role`); la cookie escrita en el login manda en el nombre que
 * se muestra, y rellena los huecos cuando el payload del JWT no trae datos
 * (sesiones antiguas).
 *
 * Devuelve null cuando no hay token o no hay datos recuperables: en ese caso
 * no se fabrica un usuario y la sesión se considera inválida.
 */
export function restoreSessionUser(token: unknown, storedRaw?: unknown): User | null {
  const rawToken = toText(token);
  if (rawToken === undefined) return null;

  const stored = parseStoredUser(storedRaw);
  const claims = claimsToUser(decodeJwtPayload(rawToken));

  const id = claims?.id ?? stored?.id;
  const role = claims?.role ?? stored?.role ?? null;
  const firstName = stored?.firstName ?? claims?.firstName ?? null;
  const lastName = stored?.lastName ?? claims?.lastName ?? null;

  if (firstName === null || role === null) return null;

  const user: User = { firstName, role };
  if (id !== undefined) user.id = id;
  if (lastName !== null) user.lastName = lastName;

  return user;
}
