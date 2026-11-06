# Plan de Implementación — Spec 010: Notificaciones Push Web en la PWA

## Resumen
Implementar notificaciones push nativas en la PWA Mecaflow para admins y mecánicos: detección de soporte, suscripción/desuscripción con gesto del usuario, handlers en el Service Worker (push + notificationclick), restauración de estado y flujo iOS. Solo frontend; backend ya congelado en `backend-prompt.md`.

---

## Decisiones Tomadas (OP-1 a OP-4 resueltas con recomendaciones)

| ID | Decisión | Justificación |
|----|----------|---------------|
| **OP-1** | Toggle en **`/pages/notifications/index.tsx`** (página de centro de alertas, spec 009), componente independiente `PushNotificationsToggle`. | Centro natural de configuración de notificaciones; componente portable para moverlo a "Ajustes" futuro cambiando 1 import. |
| **OP-2** | **No** añadir toggle en `/technician/order` por ahora. | El técnico ve notificaciones al abrir la orden; complejidad innecesaria. |
| **OP-3** | **Sí, mostrar notificación** aunque la app esté en foreground (comportamiento nativo del SW). | Consistencia UX; silenciar es cambio de 1 línea si luego se decide. |
| **OP-4** | Copy snackbar denied: *"Las notificaciones están bloqueadas. Habilítalas en los ajustes del navegador para recibirlas."* Botón: *"Abrir ajustes"* (solo Chrome). | Texto claro y accionable. |

---

## Decisión Arquitectónica: Handlers del Service Worker (RF-5, RF-6)

**Opción elegida: Script post-build que anexa handlers al `public/sw.js` generado por next-pwa.**

**Justificación (1 línea):** next-pwa no expone `customWorker` de forma estable en Pages Router; el script post-build es determinista, no rompe builds futuros y permite mantener `register: true, skipWaiting: true` sin cambios en `next.config.mjs`.

**Implementación:**
- Crear `scripts/append-sw-handlers.mjs` que lee `public/sw.js` (generado en `npm run build`), le anexa los handlers `push` y `notificationclick`, y lo reescribe.
- Añadir en `package.json`: `"postbuild": "node scripts/append-sw-handlers.mjs"`.
- En dev, el SW está deshabilitado (`disable: process.env.NODE_ENV === 'development'`), así que no hay conflicto.

---

## Arquitectura y Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│                        COMPONENTES                              │
├─────────────────────────────────────────────────────────────────┤
│  pages/index.tsx                                                │
│    └── PushNotificationsToggle.tsx (RF-1, RF-2, RF-3, RF-4)    │
│         ├── src/utils/pushUtils.ts                              │
│         │    ├── isPushSupported()                              │
│         │    ├── getPermissionState()                           │
│         │    ├── urlBase64ToUint8Array()                        │
│         │    └── SUPPORTED_KEY                                  │
│         └── src/services/api.ts (nuevos métodos)                │
│              ├── pushPublicKey()  → GET /api/push/public-key    │
│              ├── pushSubscribe()  → POST /api/push/subscribe    │
│              └── pushUnsubscribe()→ POST /api/push/unsubscribe  │
├─────────────────────────────────────────────────────────────────┤
│  SERVICE WORKER (public/sw.js generado + handlers anexados)     │
│    ├── event 'push'           → RF-5 (showNotification)         │
│    └── event 'notificationclick' → RF-6 (focus/openWindow)      │
└─────────────────────────────────────────────────────────────────┘
```

### Responsabilidades por Archivo

| Archivo | Responsabilidad | RFs |
|---------|-----------------|-----|
| `src/utils/pushUtils.ts` | Utilidades puras: detección soporte, permiso, conversión VAPID, clave localStorage, **lógica opt-out default** | RF-1, RF-2, RF-3, RF-4 |
| `src/services/api.ts` | Métodos tipados para endpoints push (reusando `api.get/post`) | RF-2, RF-3, RF-4 |
| `src/components/PushNotificationsToggle.tsx` | Componente UI + lógica de activación/desactivación/restauración **opt-out** | RF-1, RF-2, RF-3, RF-4, RF-7, RF-8 |
| `pages/notifications/index.tsx` | Montaje del toggle en página de alertas (OP-1) | RF-1, OP-1 |
| `scripts/append-sw-handlers.mjs` | Post-build: inyecta handlers push/notificationclick en SW | RF-5, RF-6 |
| `public/sw.js` (generado) | SW base de next-pwa + handlers anexados | RF-5, RF-6 |

---

## Funciones Puras (pushUtils.ts)

```typescript
// pushUtils.ts — todas exportadas, testables con node --test
export const SUPPORTED_KEY = 'pushNotificationsEnabled';

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'pushManager' in navigator.serviceWorker
  );
}

export function isIOSStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

export function getPermissionState(): NotificationPermission {
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0));
}

export function shouldShowToggle(): boolean {
  if (!isPushSupported()) return false;
  // iOS: solo si standalone
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return isIOSStandalone();
  }
  return true;
}

export function getIOSVersion(): number | null {
  const match = navigator.userAgent.match(/OS (\d+)_/i);
  return match ? parseInt(match[1], 10) : null;
}
```

---

## Estrategia de Tests (node --test)

| Qué testear | Tipo | Comando | Cobertura RF |
|-------------|------|---------|--------------|
| `isPushSupported()` con mocks de window/navigator | Unitario | `node --test tests/pushUtils.test.ts` | RF-1 |
| `shouldShowToggle()` matrix: desktop Chrome, Android, iOS tab, iOS standalone | Unitario | `node --test tests/pushUtils.test.ts` | RF-1, RF-8 |
| `urlBase64ToUint8Array()` vectores conocidos | Unitario | `node --test tests/pushUtils.test.ts` | RF-2 |
| `pushPublicKey/subscribe/unsubscribe` llaman a `api.get/post` con payload correcto | Unitario (mock api) | `node --test tests/apiPush.test.ts` | RF-2, RF-3, RF-4 |
| Toggle: render OFF/ON, click flujo happy path, click denied, red 503 | Integración (React Testing Library) | `node --test tests/PushNotificationsToggle.test.tsx` | RF-1..RF-4, RF-7 |
| Handler SW `push`: parsea data, llama showNotification con opciones | Unitario (mock SW) | `node --test tests/swPushHandler.test.ts` | RF-5 |
| Handler SW `notificationclick`: cierra notificación, focus/openWindow | Unitario (mock SW) | `node --test tests/swClickHandler.test.ts` | RF-6 |

> **Nota:** Tests de integración contra backend real **bloqueados** hasta confirmación del usuario ("backend listo"). Tests unitarios usan mocks.

---

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| next-pwa regenera SW y borra handlers en build posterior | Alto | Script post-build idempotente; validar en CI que `public/sw.js` contiene handlers |
| iOS Safari < 16.4 no soporta Web Push | Medio | `getIOSVersion()` en pushUtils oculta toggle si versión < 16.4 |
| Permiso "denied" irrecuperable sin acción del usuario | Alto | Snackbar con botón "Abrir ajustes" (Chrome) + instrucciones genéricas |
| VAPID key rota en backend → suscripciones inválidas | Medio | RF-4 re-suscribe en background al detectar `getSubscription() === null` |
| SW en dev deshabilitado → no se pueden probar handlers | Bajo | Documentar: handlers solo testables en build producción (`npm run build && npm start`) |
| Race condition: toggle ON → permiso denied → toggle queda ON visual | Medio | RF-2: si permiso denied, setear switch OFF en catch/finally |

---

## Orden de Implementación (Fases)

### Fase 1: Fundación (Utilidades + API)
1. `src/utils/pushUtils.ts` — funciones puras + tests
2. `src/services/api.ts` — añadir `pushPublicKey`, `pushSubscribe`, `pushUnsubscribe` + tests
3. `scripts/append-sw-handlers.mjs` — script post-build + test de que inyecta correctamente

### Fase 2: Componente Toggle + Integración en Centro de Alertas
4. `src/components/PushNotificationsToggle.tsx` — UI + lógica RF-1..RF-4 **opt-out default**, RF-7, RF-8 + tests
5. `pages/notifications/index.tsx` — montar componente en header/arriba de tabs (OP-1)

### Fase 3: Service Worker Handlers
6. Handlers `push` y `notificationclick` en `scripts/append-sw-handlers.mjs` + tests unitarios

### Fase 4: Validación y Ajustes
7. Build completo (`npm run build`) → verificar SW generado tiene handlers
8. Pruebas manuales en Chrome/Android/iOS (cuando backend listo)

---

## Checkpoints

| Checkpoint | Criterios |
|------------|-----------|
| **Después Fase 1** | `npm run lint && npm run typecheck` OK; tests unitarios pushUtils + apiPush pasan |
| **Después Fase 2** | Toggle renderiza en Home, cambia estado ON/OFF en localStorage, snackbar aparece; tests integración pasan |
| **Después Fase 3** | `npm run build` genera `public/sw.js` con handlers `push` y `notificationclick`; tests unitarios SW pasan |
| **Final** | Build limpio, todos los tests pasan, spec aprobada → listo para validación manual con backend |

---

## Fuera de Alcance (recordatorio)
- Backend, email/SMS, horarios silenciosos, preferencias granulares, vista técnico, background sync.