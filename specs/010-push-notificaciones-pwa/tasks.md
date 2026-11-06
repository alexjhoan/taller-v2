# Tareas — Spec 010: Notificaciones Push Web en la PWA

> **Convención:** Cada tarea = 1 commit atómico. Tests first (rojo → verde). Verificación: `npm run lint && npm run typecheck && node --test`.

---

## Fase 1: Fundación — Utilidades y API

### T1. `src/utils/pushUtils.ts` — Utilidades puras de push
**Archivos:** `src/utils/pushUtils.ts` (nuevo), `tests/pushUtils.test.ts` (nuevo)
**RFs:** RF-1, RF-2, RF-4, RF-8
**Dependencias:** Ninguna

**Hecho cuando:**
- [ ] `isPushSupported()` devuelve `true` solo si `Notification`, `serviceWorker` y `pushManager` existen
- [ ] `shouldShowToggle()` matrix: Chrome desktop=true, Android Chrome=true, iOS Safari tab=false, iOS standalone=true, Safari macOS <13=false
- [ ] `urlBase64ToUint8Array()` convierte VAPID key base64url → Uint8Array (vector de prueba conocido)
- [ ] `getIOSVersion()` extrae versión mayor de `OS XX_` en userAgent
- [ ] `SUPPORTED_KEY === 'pushNotificationsEnabled'`
- [ ] `npm run lint && npm run typecheck` OK
- [ ] `node --test tests/pushUtils.test.ts` → todos verdes

**Test sugerido (unitario Node):**
```typescript
// tests/pushUtils.test.ts
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { isPushSupported, shouldShowToggle, urlBase64ToUint8Array, getIOSVersion, SUPPORTED_KEY } from '../src/utils/pushUtils';

describe('pushUtils', () => {
  let originalWindow: any;
  beforeEach(() => { originalWindow = global.window; global.window = {}; });
  afterEach(() => { global.window = originalWindow; });

  it('isPushSupported true when all APIs present', () => {
    global.window.Notification = {};
    global.navigator = { serviceWorker: { pushManager: {} } };
    assert.strictEqual(isPushSupported(), true);
  });

  it('shouldShowToggle matrix', () => {
    // desktop Chrome
    global.window.navigator = { userAgent: 'Chrome', serviceWorker: { pushManager: {} } };
    global.window.Notification = {};
    global.window.matchMedia = () => ({ matches: false });
    assert.strictEqual(shouldShowToggle(), true);

    // iOS tab
    global.window.navigator = { userAgent: 'iPhone', serviceWorker: { pushManager: {} } };
    global.window.matchMedia = () => ({ matches: false });
    global.navigator.standalone = false;
    assert.strictEqual(shouldShowToggle(), false);

    // iOS standalone
    global.window.matchMedia = () => ({ matches: true });
    assert.strictEqual(shouldShowToggle(), true);
  });

  it('urlBase64ToUint8Array known vector', () => {
    const result = urlBase64ToUint8Array('BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U');
    assert.ok(result instanceof Uint8Array);
    assert.strictEqual(result.length, 65);
  });

  it('getIOSVersion parses major version', () => {
    global.window.navigator = { userAgent: 'iPhone OS 17_4 like Mac OS X' };
    assert.strictEqual(getIOSVersion(), 17);
  });

  it('SUPPORTED_KEY constant', () => {
    assert.strictEqual(SUPPORTED_KEY, 'pushNotificationsEnabled');
  });
});
```

---

### T2. `src/services/api.ts` — Métodos tipados para endpoints push
**Archivos:** `src/services/api.ts` (modificar), `tests/apiPush.test.ts` (nuevo)
**RFs:** RF-2, RF-3, RF-4
**Dependencias:** T1 (tipos compartidos si los hay)

**Hecho cuando:**
- [ ] `pushPublicKey(): Promise<{ public_key: string }>` → `GET /api/push/public-key`
- [ ] `pushSubscribe(payload: { endpoint: string; keys: { p256dh: string; auth: string }; user_agent?: string }): Promise<void>` → `POST /api/push/subscribe`
- [ ] `pushUnsubscribe(endpoint: string): Promise<void>` → `POST /api/push/unsubscribe`
- [ ] Todos usan `api.get/post` existente (manejo 401/403/503 ya implementado)
- [ ] Types inline en el archivo (self-contained)
- [ ] `npm run lint && npm run typecheck` OK
- [ ] `node --test tests/apiPush.test.ts` → todos verdes

**Test sugerido (unitario Node, mock `api`):**
```typescript
// tests/apiPush.test.ts
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import * as apiModule from '../src/services/api';

// Mock del módulo api
const mockGet = mock.fn();
const mockPost = mock.fn();
apiModule.api = { get: mockGet, post: mockPost };

import { pushPublicKey, pushSubscribe, pushUnsubscribe } from '../src/services/api';

describe('api push methods', () => {
  beforeEach(() => { mockGet.mock.resetCalls(); mockPost.mock.resetCalls(); });

  it('pushPublicKey calls GET /api/push/public-key', async () => {
    mockGet.mock.mockImplementation(async () => ({ public_key: 'TEST_KEY' }));
    const res = await pushPublicKey();
    assert.strictEqual(mockGet.mock.callCount(), 1);
    assert.deepStrictEqual(mockGet.mock.calls[0].arguments, ['/api/push/public-key']);
    assert.strictEqual(res.public_key, 'TEST_KEY');
  });

  it('pushSubscribe calls POST /api/push/subscribe with payload', async () => {
    mockPost.mock.mockImplementation(async () => ({}));
    const payload = { endpoint: 'ep', keys: { p256dh: 'k1', auth: 'k2' }, user_agent: 'UA' };
    await pushSubscribe(payload);
    assert.strictEqual(mockPost.mock.callCount(), 1);
    assert.deepStrictEqual(mockPost.mock.calls[0].arguments, ['/api/push/subscribe', payload]);
  });

  it('pushUnsubscribe calls POST /api/push/unsubscribe with endpoint', async () => {
    mockPost.mock.mockImplementation(async () => ({}));
    await pushUnsubscribe('ep123');
    assert.strictEqual(mockPost.mock.callCount(), 1);
    assert.deepStrictEqual(mockPost.mock.calls[0].arguments, ['/api/push/unsubscribe', { endpoint: 'ep123' }]);
  });
});
```

---

### T3. `scripts/append-sw-handlers.mjs` — Script post-build que inyecta handlers en SW
**Archivos:** `scripts/append-sw-handlers.mjs` (nuevo), `package.json` (modificar: añadir `postbuild`), `tests/appendSwHandlers.test.mjs` (nuevo)
**RFs:** RF-5, RF-6
**Dependencias:** Ninguna (pero debe ejecutarse después de `npm run build`)

**Hecho cuando:**
- [ ] Script lee `public/sw.js` generado por next-pwa
- [ ] Anexa handlers `push` y `notificationclick` al final (sin duplicar si ya existen)
- [ ] Reescribe `public/sw.js` con el contenido combinado
- [ ] `package.json` tiene `"postbuild": "node scripts/append-sw-handlers.mjs"`
- [ ] `npm run build` genera `public/sw.js` que **contiene** `self.addEventListener('push',` y `self.addEventListener('notificationclick',`
- [ ] `npm run lint` OK (script ES modules)
- [ ] `node --test tests/appendSwHandlers.test.mjs` → verde

**Handlers a inyectar (referencia para el script):**
```javascript
// push handler (RF-5)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const { title, body, order_id } = data;
  const tag = `order-${order_id}`;
  const url = `/admin/dashboard?selectedOrderId=${order_id}`;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { url },
      requireInteraction: true,
      tag,
    })
  );
});

// notificationclick handler (RF-6)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (!url) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/admin/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
```

**Test sugerido (unitario Node):**
```javascript
// tests/appendSwHandlers.test.mjs
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendHandlers } from '../scripts/append-sw-handlers.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_SW = path.join(__dirname, 'fixtures', 'sw-base.js');
const OUTPUT_SW = path.join(__dirname, 'fixtures', 'sw-output.js');

describe('append-sw-handlers', () => {
  beforeEach(() => {
    fs.copyFileSync(FIXTURE_SW, OUTPUT_SW);
  });

  afterEach(() => {
    if (fs.existsSync(OUTPUT_SW)) fs.unlinkSync(OUTPUT_SW);
  });

  it('appends push and notificationclick handlers', async () => {
    await appendHandlers(OUTPUT_SW);
    const content = fs.readFileSync(OUTPUT_SW, 'utf8');
    assert.ok(content.includes("self.addEventListener('push'"));
    assert.ok(content.includes("self.addEventListener('notificationclick'"));
    assert.ok(content.includes("showNotification"));
    assert.ok(content.includes("clients.matchAll"));
  });

  it('idempotent: running twice does not duplicate', async () => {
    await appendHandlers(OUTPUT_SW);
    await appendHandlers(OUTPUT_SW);
    const content = fs.readFileSync(OUTPUT_SW, 'utf8');
    const pushCount = (content.match(/self\.addEventListener\('push'/g) || []).length;
    const clickCount = (content.match(/self\.addEventListener\('notificationclick'/g) || []).length;
    assert.strictEqual(pushCount, 1);
    assert.strictEqual(clickCount, 1);
  });
});
```

---

## Fase 2: Componente Toggle + Integración Home

### T4. `src/components/PushNotificationsToggle.tsx` — Componente completo con lógica RF-1..RF-4 **opt-out default**, RF-7, RF-8
**Archivos:** `src/components/PushNotificationsToggle.tsx` (nuevo), `tests/PushNotificationsToggle.test.tsx` (nuevo)
**RFs:** RF-1, RF-2, RF-3, RF-4, RF-7, RF-8
**Dependencias:** T1 (pushUtils), T2 (api push methods)

**Hecho cuando:**
- [ ] Componente usa `CustomSwitch` de `src/components/ui/`
- [ ] `shouldShowToggle()` (pushUtils) controla visibilidad: si `false` → render `null` (toggle oculto)
- [ ] En iOS tab (no standalone): renderiza CTA "Instalar app para recibir notificaciones" con botón que reusa lógica de `PWAInstallPrompt` (llamar `showInstallPrompt()` o similar)
- [ ] **Comportamiento opt-out default (ON por defecto):**
  - [ ] Al montar: si `localStorage.pushNotificationsEnabled !== 'false'` (null/'true') Y permiso "granted" → **suscripción silenciosa automática** (sin gesto, sin prompt) → POST subscribe → switch ON real
  - [ ] Si permiso "default" → switch ON visual (estado "pending"), **sin suscripción real**. Al primer gesto del usuario en la app → pedir permiso + suscribir
  - [ ] Si permiso "denied" → switch OFF + snackbar instrucciones
- [ ] **Activación explícita (usuario click ON tras haber desactivado):**
  - [ ] Permiso "granted" → suscripción silenciosa + POST → switch ON
  - [ ] Permiso "default" → `requestPermission()` (gesto) → si granted, suscribir + POST
  - [ ] Permiso "denied" → snackbar instrucciones, switch vuelve OFF
- [ ] **Desactivación (OFF):**
  - [ ] `pushManager.getSubscription()` → `unsubscribe()` → `pushUnsubscribe(endpoint)` → `localStorage.setItem('pushNotificationsEnabled', 'false')` → switch OFF → snackbar éxito
  - [ ] Fallo red (503) → rollback switch a ON + snackbar "Sin conexión. Se reintentará al desactivar de nuevo"
  - [ ] Sin suscripción local → solo `pushUnsubscribe` + flag `false` + snackbar éxito
- [ ] Snackbars usan `enqueueSnackbar` de Notistack
- [ ] Snackbars usan `enqueueSnackbar` de Notistack
- [ ] `npm run lint && npm run typecheck` OK
- [ ] `node --test tests/PushNotificationsToggle.test.tsx` → todos verdes

**Test sugerido (integración React Testing Library + mocks):**
```tsx
// tests/PushNotificationsToggle.test.tsx
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PushNotificationsToggle } from '../src/components/PushNotificationsToggle';
import * as pushUtils from '../src/utils/pushUtils';
import * as api from '../src/services/api';
import { SnackbarProvider } from 'notistack';

// Mocks globales
const mockEnqueueSnackbar = mock.fn();
const mockShowInstallPrompt = mock.fn();

jest.mock('../src/utils/pushUtils', () => ({
  ...jest.requireActual('../src/utils/pushUtils'),
  isPushSupported: () => true,
  shouldShowToggle: () => true,
  isIOSStandalone: () => false,
  getPermissionState: () => 'default',
  urlBase64ToUint8Array: (s: string) => new Uint8Array([1,2,3]),
  SUPPORTED_KEY: 'pushNotificationsEnabled',
}));

jest.mock('../src/services/api', () => ({
  api: {
    get: mock.fn(),
    post: mock.fn(),
  },
  pushPublicKey: mock.fn(),
  pushSubscribe: mock.fn(),
  pushUnsubscribe: mock.fn(),
}));

jest.mock('notistack', () => ({
  ...jest.requireActual('notistack'),
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
  SnackbarProvider: ({ children }) => <div>{children}</div>,
}));

describe('PushNotificationsToggle', () => {
  beforeEach(() => {
    mockEnqueueSnackbar.mockReset();
    localStorage.clear();
    // Mock serviceWorker
    navigator.serviceWorker = {
      ready: Promise.resolve({
        pushManager: {
          subscribe: mock.fn().mockResolvedValue({
            endpoint: 'ep',
            getKey: (name: string) => name === 'p256dh' ? new ArrayBuffer(8) : new ArrayBuffer(16),
          }),
          getSubscription: mock.fn().mockResolvedValue(null),
        },
      }),
    } as any;
    Notification.permission = 'default';
    Notification.requestPermission = mock.fn().mockResolvedValue('granted');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderToggle = () => render(
    <SnackbarProvider>
      <PushNotificationsToggle />
    </SnackbarProvider>
  );

  it('renders switch OFF initially', () => {
    renderToggle();
    const switchInput = screen.getByRole('switch');
    assert.strictEqual(switchInput.checked, false);
  });

  it('activation happy path: click ON → permission granted → subscribe → POST → switch ON', async () => {
    api.pushPublicKey.mockResolvedValue({ public_key: 'TEST_KEY' });
    api.pushSubscribe.mockResolvedValue({});
    navigator.serviceWorker.ready = Promise.resolve({
      pushManager: {
        subscribe: mock.fn().mockResolvedValue({
          endpoint: 'ep1',
          getKey: (name: string) => new Uint8Array(32),
        }),
        getSubscription: mock.fn().mockResolvedValue(null),
      },
    });
    Notification.requestPermission.mockResolvedValue('granted');

    renderToggle();
    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      assert.strictEqual(screen.getByRole('switch').checked, true);
    });
    assert.ok(api.pushPublicKey.mock.calls.length === 1);
    assert.ok(api.pushSubscribe.mock.calls.length === 1);
    assert.ok(mockEnqueueSnackbar.mock.calls.some(c => c[0].includes('activadas')));
    assert.strictEqual(localStorage.getItem('pushNotificationsEnabled'), 'true');
  });

  it('permission denied → switch stays OFF + snackbar with button', async () => {
    Notification.requestPermission.mockResolvedValue('denied');
    renderToggle();
    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      assert.strictEqual(screen.getByRole('switch').checked, false);
    });
    assert.ok(mockEnqueueSnackbar.mock.calls.some(c =>
      c[0].includes('bloqueadas') && c[1]?.action?.label === 'Abrir ajustes'
    ));
  });

  it('network error (503) on subscribe → switch OFF + snackbar offline', async () => {
    api.pushPublicKey.mockResolvedValue({ public_key: 'TEST_KEY' });
    const err = new Error('Offline'); (err as any).status = 503; (err as any).statusText = 'OfflineMode';
    api.pushSubscribe.mockRejectedValue(err);
    Notification.requestPermission.mockResolvedValue('granted');

    renderToggle();
    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      assert.strictEqual(screen.getByRole('switch').checked, false);
    });
    assert.ok(mockEnqueueSnackbar.mock.calls.some(c => c[0].includes('Sin conexión')));
  });

  it('restore: localStorage true + subscription exists → switch ON', async () => {
    localStorage.setItem('pushNotificationsEnabled', 'true');
    navigator.serviceWorker.ready = Promise.resolve({
      pushManager: {
        getSubscription: mock.fn().mockResolvedValue({ endpoint: 'ep1' }),
      },
    });
    renderToggle();
    await waitFor(() => {
      assert.strictEqual(screen.getByRole('switch').checked, true);
    });
  });

  it('restore: localStorage true + no subscription → re-subscribe silent', async () => {
    localStorage.setItem('pushNotificationsEnabled', 'true');
    api.pushPublicKey.mockResolvedValue({ public_key: 'TEST_KEY' });
    api.pushSubscribe.mockResolvedValue({});
    navigator.serviceWorker.ready = Promise.resolve({
      pushManager: {
        getSubscription: mock.fn().mockResolvedValue(null),
        subscribe: mock.fn().mockResolvedValue({
          endpoint: 'ep-new',
          getKey: () => new Uint8Array(32),
        }),
      },
    });
    renderToggle();
    await waitFor(() => {
      assert.strictEqual(screen.getByRole('switch').checked, true);
    });
    assert.ok(api.pushSubscribe.mock.calls.length === 1);
  });
});
```

---

### T5. `pages/notifications/index.tsx` — Montar `PushNotificationsToggle` en página de alertas (OP-1)
**Archivos:** `pages/notifications/index.tsx` (modificar)
**RFs:** RF-1, OP-1
**Dependencias:** T4

**Hecho cuando:**
- [ ] Import `PushNotificationsToggle` y render en el header de la página (arriba de `NotificationTabs`, visible para `admin` y `mechanic`)
- [ ] No rompe layout existente; diseño coherente con la página (ej. en el `div` del header junto al badge de contador)
- [ ] `npm run lint && npm run typecheck` OK
- [ ] Build `npm run build` OK

---

## Fase 3: Service Worker Handlers

### T6. Handlers `push` y `notificationclick` en `scripts/append-sw-handlers.mjs` (completar implementación real)
**Archivos:** `scripts/append-sw-handlers.mjs` (completar), `tests/swPushHandler.test.mjs` (nuevo), `tests/swClickHandler.test.mjs` (nuevo)
**RFs:** RF-5, RF-6
**Dependencias:** T3 (script base)

**Hecho cuando:**
- [ ] Handler `push` parsea `event.data.json()` → `{ title, body, order_id }`
- [ ] `showNotification` con: `title`, `body`, `icon: '/icons/icon-192x192.png'`, `badge: '/icons/icon-72x72.png'`, `data: { url: '/admin/dashboard?selectedOrderId=' + order_id }`, `requireInteraction: true`, `tag: 'order-' + order_id`
- [ ] Handler `notificationclick`: `event.notification.close()` → `clients.matchAll({ type: 'window', includeUncontrolled: true })` → busca cliente con `/admin/dashboard` → `focus()` o `clients.openWindow(url)`
- [ ] Si `order_id` inválido/ausente → notificación genérica "Nueva actividad en Mecaflow" sin `data.url` (RF-7)
- [ ] `npm run build` → `public/sw.js` contiene ambos handlers
- [ ] `node --test tests/swPushHandler.test.mjs` y `tests/swClickHandler.test.mjs` → verdes

**Test sugerido (unitario Node, mock ServiceWorkerRegistration):**
```javascript
// tests/swPushHandler.test.mjs
import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { pushHandler } from '../scripts/swHandlers.mjs'; // extraer handlers a módulo testable

describe('SW push handler', () => {
  it('shows notification with correct options', () => {
    const mockShowNotification = mock.fn();
    const mockRegistration = { showNotification: mockShowNotification };
    const event = {
      data: { json: () => ({ title: 'Nueva orden', body: 'Detalle', order_id: 42 }) },
      waitUntil: (p) => p,
    };
    pushHandler(event, mockRegistration);
    assert.strictEqual(mockShowNotification.mock.callCount(), 1);
    const [title, options] = mockShowNotification.mock.calls[0].arguments;
    assert.strictEqual(title, 'Nueva orden');
    assert.strictEqual(options.body, 'Detalle');
    assert.strictEqual(options.tag, 'order-42');
    assert.strictEqual(options.data.url, '/admin/dashboard?selectedOrderId=42');
    assert.strictEqual(options.requireInteraction, true);
  });

  it('fallback for missing order_id', () => {
    const mockShowNotification = mock.fn();
    const event = {
      data: { json: () => ({ title: 'Test', body: 'Body' }) }, // sin order_id
      waitUntil: (p) => p,
    };
    pushHandler(event, { showNotification: mockShowNotification });
    const [, options] = mockShowNotification.mock.calls[0].arguments;
    assert.strictEqual(options.data, undefined);
  });
});
```

```javascript
// tests/swClickHandler.test.mjs
import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { clickHandler } from '../scripts/swHandlers.mjs';

describe('SW notificationclick handler', () => {
  it('focuses existing dashboard client', async () => {
    const mockFocus = mock.fn();
    const mockMatchAll = mock.fn().mockResolvedValue([{ url: 'https://app/admin/dashboard', focus: mockFocus }]);
    const event = {
      notification: { close: () => {}, data: { url: '/admin/dashboard?selectedOrderId=42' } },
      waitUntil: (p) => p,
    };
    await clickHandler(event, { clients: { matchAll: mockMatchAll, openWindow: mock.fn() } });
    assert.strictEqual(mockFocus.mock.callCount(), 1);
  });

  it('opens new window if no dashboard client', async () => {
    const mockOpenWindow = mock.fn();
    const mockMatchAll = mock.fn().mockResolvedValue([]);
    const event = {
      notification: { close: () => {}, data: { url: '/admin/dashboard?selectedOrderId=42' } },
      waitUntil: (p) => p,
    };
    await clickHandler(event, { clients: { matchAll: mockMatchAll, openWindow: mockOpenWindow } });
    assert.strictEqual(mockOpenWindow.mock.callCount(), 1);
    assert.strictEqual(mockOpenWindow.mock.calls[0].arguments[0], '/admin/dashboard?selectedOrderId=42');
  });
});
```

> **Nota:** Para testabilidad, extraer los handlers a `scripts/swHandlers.mjs` (exportados) y que `append-sw-handlers.mjs` los importe y anexe como strings.

---

## Fase 4: Validación Final

### T7. Build completo y verificación de SW generado
**Archivos:** Ninguno nuevo (verificación)
**RFs:** Todos (integración)
**Dependencias:** T1–T6

**Hecho cuando:**
- [ ] `npm run build` exit code 0
- [ ] `public/sw.js` existe y contiene `self.addEventListener('push'` y `self.addEventListener('notificationclick'`
- [ ] `npm run lint && npm run typecheck` OK
- [ ] `node --test` (todos los tests) → todos verdes
- [ ] `npm start` sirve la app y SW se registra (verificar en DevTools → Application → Service Workers)

---

## Resumen de Tareas (Orden de Ejecución)

| Tarea | Título | Archivos Principales | Tests |
|-------|--------|---------------------|-------|
| T1 | pushUtils.ts + tests | `src/utils/pushUtils.ts`, `tests/pushUtils.test.ts` | Unitario |
| T2 | api.ts push methods + tests | `src/services/api.ts`, `tests/apiPush.test.ts` | Unitario (mock api) |
| T3 | append-sw-handlers.mjs + postbuild + test | `scripts/append-sw-handlers.mjs`, `package.json`, `tests/appendSwHandlers.test.mjs` | Unitario |
| T4 | PushNotificationsToggle.tsx + tests | `src/components/PushNotificationsToggle.tsx`, `tests/PushNotificationsToggle.test.tsx` | Integración (RTL) |
| T5 | pages/notifications/index.tsx montar toggle | `pages/notifications/index.tsx` | Build + lint |
| T6 | SW handlers reales + tests | `scripts/swHandlers.mjs`, `scripts/append-sw-handlers.mjs`, `tests/swPushHandler.test.mjs`, `tests/swClickHandler.test.mjs` | Unitario |
| T7 | Build final + verificación SW | (verificación) | `npm run build && node --test` |

---

## Notas para el Implementador

1. **Orden estricto:** T1 → T2 → T3 → T4 → T5 → T6 → T7. Cada tarea deja el repo en estado funcional.
2. **Tests first:** Escribe el test (rojo), implementa (verde), `node --test`, commit.
3. **No tocar backend:** Solo frontend. Endpoints ya definidos en `backend-prompt.md`.
4. **Regla 503:** `api.ts` ya maneja fallos de red → `ApiError` 503. El componente solo muestra snackbar y revierte UI.
5. **iOS:** `shouldShowToggle()` en pushUtils encapsula toda la lógica. El componente solo llama a esa función.
6. **SW en dev:** next-pwa deshabilita SW en `development`. Los handlers solo se prueban en `npm run build && npm start`.
7. **Iconos:** Usar `/icons/icon-192x192.png` y `/icons/icon-72x72.png` (ya existen en `public/icons/` por next-pwa).