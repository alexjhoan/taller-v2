// src/utils/pushUtils.ts
// Utilidades puras para Web Push — sin dependencias de React, 100% testeable con node --test

/**
 * Clave en localStorage para el flag de opt-out explícito.
 * - 'true'  = usuario activó explícitamente (legacy, se trata como opt-in)
 * - 'false' = usuario desactivó explícitamente (opt-out)
 * - null/ausente = primera visita → comportamiento por defecto ON
 */
export const PUSH_STORAGE_KEY = 'pushNotificationsEnabled';

/**
 * Verifica si el navegador soporta Web Push (Notification + ServiceWorker + PushManager).
 * Debe llamarse solo en cliente (typeof window !== 'undefined').
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Detecta si la PWA está en modo standalone en iOS (instalada en pantalla de inicio).
 * iOS 16.4+ requiere standalone para Web Push.
 */
export function isIOSStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

/**
 * Obtiene el estado de permiso actual de Notification API.
 */
export function getPermissionState(): NotificationPermission {
  if (typeof window === 'undefined') return 'default';
  return Notification.permission;
}

/**
 * Convierte una clave VAPID base64url (la que viene del backend) a Uint8Array
 * para pasársela a `pushManager.subscribe({ applicationServerKey })`.
 * 
 * El backend devuelve la clave en base64url (RFC 4648 §5): alfabeto URL-safe,
 * sin padding. El navegador espera base64 estándar con padding.
 */
export function urlBase64ToUint8Array(base64url: string): Uint8Array {
  // 1. Añadir padding base64url necesario (múltiplo de 4)
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  // 2. Convertir alfabeto URL-safe → base64 estándar
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  // 3. Decodificar base64 → string binario
  const rawData = atob(base64);
  // 4. String binario → Uint8Array
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

/**
 * Extrae la versión mayor de iOS del userAgent (ej. "OS 17_4" → 17).
 * Retorna null si no es iOS o no se puede parsear.
 */
export function getIOSVersion(): number | null {
  if (typeof window === 'undefined') return null;
  const match = navigator.userAgent.match(/OS (\d+)_/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Determina si se debe mostrar el toggle de notificaciones push.
 * Reglas:
 * - Navegador sin soporte → false
 * - iOS Safari (pestaña normal, NO standalone) → false (requiere instalación)
 * - iOS < 16.4 → false (Web Push no soportado)
 * - Resto (desktop Chrome/Edge/Firefox, Android Chrome, iOS standalone 16.4+) → true
 */
export function shouldShowToggle(): boolean {
  if (!isPushSupported()) return false;

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  if (isIOS) {
    // iOS: solo si está instalada (standalone) Y versión >= 16.4
    if (!isIOSStandalone()) return false;
    const version = getIOSVersion();
    if (version !== null && version < 16) return false;
    return true;
  }

  // Desktop Android, etc.
  return true;
}

/**
 * Genera el objeto de opciones para `pushManager.subscribe()` a partir de la
 * clave VAPID pública (ya convertida a Uint8Array).
 */
export function makeSubscribeOptions(applicationServerKey: Uint8Array): PushSubscriptionOptionsInit {
  return {
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey as BufferSource,
  };
}

/**
 * Serializa un PushSubscription a formato plano para enviar al backend.
 * El backend espera: { endpoint, keys: { p256dh, auth }, user_agent? }
 */
export function serializeSubscription(sub: PushSubscription, userAgent?: string): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent?: string;
} {
  const p256dh = sub.getKey('p256dh');
  const auth = sub.getKey('auth');
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: p256dh ? btoa(String.fromCharCode(...Array.from(new Uint8Array(p256dh)))) : '',
      auth: auth ? btoa(String.fromCharCode(...Array.from(new Uint8Array(auth)))) : '',
    },
    user_agent: userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
  };
}

/**
 * Lee el flag de opt-out desde localStorage.
 * - 'false' → usuario desactivó explícitamente
 * - cualquier otro valor (incl. null, 'true', 'whatever') → default ON
 */
export function getPushOptOut(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PUSH_STORAGE_KEY) === 'false';
}

/**
 * Guarda el flag de opt-out en localStorage.
 * @param optedOut true = usuario desactivó (guardar 'false'); false = activó (borrar flag o 'true')
 */
export function setPushOptOut(optedOut: boolean): void {
  if (typeof window === 'undefined') return;
  if (optedOut) {
    localStorage.setItem(PUSH_STORAGE_KEY, 'false');
  } else {
    // Borrar el flag para volver al comportamiento por defecto ON
    // (o guardar 'true' si se prefiere mantener registro explícito de opt-in)
    localStorage.removeItem(PUSH_STORAGE_KEY);
  }
}

/**
 * Ruta del Service Worker según el entorno:
 * - desarrollo: '/sw-dev.js' (sin precache; el public/sw.js de prod queda
 *   desincronizado con los chunks de dev y su install puede no terminar).
 * - producción: '/sw.js' (generado por el build + handlers inyectados).
 */
export function getServiceWorkerPath(): string {
  return (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV === 'development'
      ? '/sw-dev.js'
      : '/sw.js'
  );
}

/**
 * Registra el Service Worker si aún no hay ninguno en el scope raíz.
 * Idempotente: si ya existe un registro lo devuelve tal cual.
 * Falla en SSR o si el navegador no soporta Service Workers.
 */
export async function ensureServiceWorkerRegistered(
  swPath = getServiceWorkerPath(),
): Promise<ServiceWorkerRegistration> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Service Worker no soportado');
  }
  const existing = await navigator.serviceWorker.getRegistration();
  // Un registro previo sin worker activo (install encallado) no sirve:
  // registrar la ruta deseada en el mismo scope reemplaza esa instalación.
  if (existing?.active) return existing;
  const reg = navigator.serviceWorker.register(swPath);
  await navigator.serviceWorker.ready; // espera hasta worker activo
  return reg;
}

/**
 * Verifica si hay una suscripción push existente y válida en el navegador.
 */
export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}