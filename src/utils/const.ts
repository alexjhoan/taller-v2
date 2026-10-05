// ============================================================
// Mecaflow Workshop OS — Constantes globales
// ============================================================

/**
 * Nombre ofuscado de la cookie de autenticación JWT.
 * No cambiar sin actualizar el backend.
 */
export const AUTH_COOKIE_NAME = 'bkBtM0NvMGsmMw';

/**
 * Clave en localStorage para versión de la app.
 * Se usa para detectar cambios y forzar recarga.
 */
export const VERSION_APP_KEY = 'versionsApp';

/**
 * IVA Colombia (19%)
 */
export const IVA_RATE = 0.19;

/**
 * Niveles de combustible válidos
 */
export const FUEL_LEVELS = ['E', '1/4', '1/2', '3/4', 'F'] as const;

/**
 * Estados válidos de orden de trabajo
 */
export const ORDER_STATUSES = [
  'received',
  'diagnosing',
  'awaiting_approval',
  'approved',
  'in_progress',
  'ready',
  'delivered',
  'cancelled',
] as const;

/**
 * Roles de usuario
 */
export const USER_ROLES = ['admin', 'mechanic'] as const;
