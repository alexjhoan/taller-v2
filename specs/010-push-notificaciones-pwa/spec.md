# Spec 010 — Notificaciones Push Web en la PWA (frontend)

Estado: borrador a aprobar

## Contexto y objetivo

Hoy los admins y mecánicos solo se enteran de lo que pasa en sus órdenes si tienen
la PWA abierta y mirando la pantalla correcta. El backend (PHP) ya se está
implementando en paralelo y expondrá endpoints para suscribir/desuscribir y
enviar push (ver `specs/010-push-notificaciones-pwa/backend-prompt.md`).

Objetivo: implementar en el frontend la capacidad de **pedir permiso con gesto del
usuario**, **suscribirse al push service del navegador**, **mostrar notificaciones
nativas** aunque la app esté cerrada, y **abrir la orden correcta** al tocar la
notificación. El alcance cubre **admins y mecánicos** (decidido por el usuario).

## Estado actual del código (verificado)

- **Backend (contrato congelado en `backend-prompt.md`)**:
  - `GET /api/push/public-key` (JWT) → `{ public_key: "BExxx..." }`
  - `POST /api/push/subscribe` (JWT) — body `{ endpoint, keys: { p256dh, auth }, user_agent? }` — idempotente por hash del endpoint
  - `POST /api/push/unsubscribe` (JWT) — body `{ endpoint }`
  - Payload del push: `{ title, body, order_id }`
  - Formato envoltorio estándar: `{ status, body, statusText }`

- **Frontend stack**: Next.js 14 Pages Router, TS, Tailwind, React Query,
  Notistack, next-pwa (PWA habilitada en prod, deshabilitada en dev).

- **PWA existente**:
  - `public/manifest.json` + `public/sw.js` generado por next-pwa
  - `pages/_app.tsx`: monta `PWAInstallPrompt` (auto-show 30s, mobile-only)
  - `src/components/PWAInstallPrompt.tsx`: detecta iOS/Android, muestra CTA de
    instalación (requisito previo para push en iOS 16.4+)

- **UI primitivas**: `CustomSwitch`, `CustomCard`, `CustomBadge`, `CustomButton`,
  `CustomDialog`, `CustomInput` en `src/components/ui/`.

- **API client**: `src/services/api.ts` — wrapper `api.get/post/patch` con
  envoltorio estándar, `ApiError`, manejo 401/403 → logout+redirect, **catch de
  fallo de red → ApiError 503 OfflineMode** (regla: fallos de red no rompen la
  app, se muestra snackbar).

- **Home**: `pages/index.tsx` — cards de accesos rápidos sincronizadas con
  `navigationItems` filtradas por rol; ubicación candidata para el toggle.

- **Campana de alertas**: spec 009 ya define la URL de destino al clic
  (`/admin/dashboard?selectedOrderId={id}`) y los tipos de alerta.

## Requisitos funcionales (RF)

### RF-1 — Detección de soporte y visibilidad del toggle
**El toggle de notificaciones SOLO se muestra si:**
- `Notification` existe en `window` (soporte del navegador).
- `serviceWorker` en `navigator` y `pushManager` en `swRegistration`.
- En iOS: la PWA está instalada y en modo standalone (`matchMedia('(display-mode: standalone)')` o `navigator.standalone === true`). Si no está instalada, **no se muestra el toggle**; en su lugar se muestra CTA de instalar (reusando lógica de `PWAInstallPrompt`).

**Criterios de aceptación:**
- Chrome/Edge/Firefox desktop → toggle visible.
- Android Chrome → toggle visible.
- iOS Safari (pestaña normal, NO instalada) → toggle NO visible; CTA de instalar visible.
- iOS PWA instalada (standalone) → toggle visible.
- Navegadores sin soporte (p.ej. Safari macOS <13) → toggle NO visible; snackbar informativo opcional si el usuario intenta acceder a una sección de ajustes relacionada.

---

### RF-2 — Activación (opt-out por defecto: suscripción automática si ya hay permiso; gesto si es primera vez)
**Estados al cargar:**
1. `Notification.permission === 'granted'` **y** no hay suscripción → **suscripción silenciosa automática** (sin prompt, sin gesto): `pushManager.subscribe()` → `POST /api/push/subscribe` → toggle ON real.
2. `Notification.permission === 'default'` → toggle ON **visual** (estado "pending"), **sin suscripción real**. Al primer gesto del usuario en el toggle (o cualquier click en la página si se prefiere), pedir permiso y suscribir.
3. `Notification.permission === 'denied'` → toggle OFF, snackbar con instrucciones de habilitar en ajustes del navegador.

**Flujo al accionar el switch a OFF (usuario quiere desactivar):**
1. `pushManager.getSubscription()` → si existe, `subscription.unsubscribe()`.
2. `POST /api/push/unsubscribe` con `{ endpoint }`.
3. `localStorage.setItem('pushNotificationsEnabled', 'false')`.
4. Toggle OFF real.
5. Snackbar: "Notificaciones desactivadas".

**Flujo al accionar el switch a ON (usuario reactiva tras haber desactivado):**
1. Si permiso "granted" → suscripción silenciosa + POST subscribe → toggle ON.
2. Si permiso "default" → `requestPermission()` (gesto) → si granted, suscribir + POST.
3. Si permiso "denied" → snackbar instrucciones, toggle vuelve OFF.

---

### RF-3 — Desactivación (opt-out explícito del usuario)
**Flujo al accionar el switch a OFF:**
1. `pushManager.getSubscription()` → si existe, `subscription.unsubscribe()`.
2. `POST /api/push/unsubscribe` con `{ endpoint }` (idempotente).
3. `localStorage.setItem('pushNotificationsEnabled', 'false')` (flag explícito de opt-out).
4. Toggle OFF real.
5. Snackbar: "Notificaciones desactivadas".

**Criterios de aceptación:**
- Toggle OFF → unsubscribe local + POST + flag `false` en localStorage.
- Fallo de red en `unsubscribe` → snackbar 503, toggle **vuelve a ON** (rollback optimista), flag no se guarda.
- Si no había suscripción local → solo POST unsubscribe + flag `false` + snackbar éxito.

---

### RF-4 — Restauración de estado (opt-out por defecto)
**Al cargar la app (montaje del componente):**
1. Leer `localStorage.pushNotificationsEnabled` (flag de opt-out explícito).
2. **Si flag === 'false'** → usuario desactivó explícitamente → toggle OFF, **no** intentar suscribir.
3. **Si flag !== 'false'** (null, 'true', o cualquier otro) → **comportamiento por defecto ON**:
   - `Notification.permission === 'granted'` → `pushManager.getSubscription()`:
     - Existe y coincide → toggle ON real.
     - No existe → **suscripción silenciosa automática** (`pushManager.subscribe()` → POST subscribe) → toggle ON.
   - `Notification.permission === 'default'` → toggle ON visual (estado "pending"), **sin suscripción real**. Al primer gesto del usuario en la app, pedir permiso y suscribir.
   - `Notification.permission === 'denied'` → toggle OFF con snackbar instrucciones.

**Criterios de aceptación:**
- Primera visita (sin flag, permiso default) → toggle ON visual, sin suscripción real hasta gesto.
- Recarga en mismo navegador (permiso granted, flag null) → suscripción silenciosa automática → toggle ON real.
- Usuario desactivó (flag 'false') → recarga → toggle OFF, sin intentos de suscribir.
- Usuario borró datos del sitio (flag null, permiso granted) → re-suscripción silenciosa → toggle ON.
- Permiso cambiado a "denied" en ajustes del navegador → toggle OFF + snackbar instrucciones.

---

### RF-5 — Handler `push` en el Service Worker (mostrar notificación)
**En el SW (next-pwa):**
- Evento `push`: parsear `event.data.json()` → `{ title, body, order_id }`.
- `event.waitUntil(self.registration.showNotification(title, { body, icon: '/icons/icon-192x192.png', badge: '/icons/icon-72x72.png', data: { url: '/admin/dashboard?selectedOrderId=' + order_id }, requireInteraction: true, tag: 'order-' + order_id }))`.
- `tag` evita duplicados si llegan varios pushes de la misma orden.

**Criterios de aceptación:**
- Push recibido con app cerrada → notificación nativa del SO aparece con título/cuerpo/icono.
- Push recibido con app abierta en primer plano → notificación igual (el SW la muestra; si se prefiere no molestar en primer plano, se puede detectar `client.focus` y omitir, pero la spec lo deja como decisión abierta RF-OP-1).
- Varios pushes de la misma `order_id` → solo una notificación visible (tag la agrupa).

---

### RF-6 — Handler `notificationclick` en el SW (abrir la orden)
- Evento `notificationclick`: `event.notification.close()`.
- `event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => { for (const client of clients) { if (client.url.includes('/admin/dashboard') && 'focus' in client) return client.focus(); } return clients.openWindow(event.notification.data.url); }))`.
- URL destino: `/admin/dashboard?selectedOrderId={order_id}` (mismo patrón que la campana spec 009).

**Criterios de aceptación:**
- App cerrada → clic abre nueva pestaña/ventana en la orden.
- App abierta en otra pestaña → foco a la pestaña del dashboard y navega a la orden (shallow router).
- App abierta en la misma pestaña → navega a la orden dentro de la pestaña.

---

### RF-7 — Estados de error/denied con mensajes amigables
- **Permiso denegado**: snackbar persistente (autoHideDuration: 0) con botón "Abrir ajustes" que ejecuta `window.open('chrome://settings/content/notifications', '_blank')` (solo Chrome; en otros navegadores mensaje genérico).
- **Error de red (503)**: snackbar estándar "Sin conexión. Se reintentará...".
- **Error 400/422 del POST subscribe**: snackbar "No se pudo suscribir. Intenta de nuevo".
- **Push recibido pero `order_id` inválido**: notificación genérica "Nueva actividad en Mecaflow" sin URL de navegación.

---

### RF-8 — iOS: flujo instalación → permiso push
- En iOS Safari (pestaña normal): **no se muestra el toggle**; se muestra CTA "Instalar app para recibir notificaciones" (reusa `PWAInstallPrompt` o lógica equivalente).
- Tras instalar y abrir la PWA (standalone): toggle aparece → activación normal (RF-2).
- iOS < 16.4: Web Push no soportado → toggle oculto, sin CTA (o mensaje informativo si el usuario entra en ajustes).

---

## Fuera de alcance (explícito)

- Cambios en el backend (el contrato está congelado en `backend-prompt.md`).
- Notificaciones por email / SMS / WhatsApp.
- Configuración de horarios silenciosos / "no molestar".
- Agrupación avanzada de notificaciones por tipo (solo `tag` por `order_id`).
- Preferencias granulares por tipo de alerta (solo ON/OFF global).
- Notificaciones en la vista del técnico móvil (solo admins/mecánicos en dashboard por ahora).
- Background sync / periodic sync.

---

## Decisiones abiertas para el usuario (máx 4)

| ID | Pregunta | Recomendación |
|---|---|---|
| **OP-1** | ¿Dónde vive el toggle en la UI? | **Home (`pages/index.tsx`)**, en una card nueva "Notificaciones" arriba de los accesos rápidos, visible para ambos roles. Alternativa: sección "Ajustes" futura (no existe hoy). |
| **OP-2** | ¿El toggle también en la vista del técnico (`/technician/order`)? | **No** por ahora — el técnico ve sus notificaciones al abrir la orden; añadir toggle allí añade complejidad sin valor inmediato. |
| **OP-3** | ¿Notificación al recibir push con la app **abierta en primer plano**? | **Sí, mostrarla** (comportamiento nativo del SW). Si se prefiere silenciar en foreground, es un cambio de 1 línea en el handler `push`. |
| **OP-4** | Copy exacto del snackbar de "permiso denegado" (texto + botón). | Texto: "Las notificaciones están bloqueadas. Habilítalas en los ajustes del navegador para recibirlas." Botón: "Abrir ajustes" (solo Chrome). |

---

## Inconsistencias detectadas (entre plan.md y backend-prompt.md)

Ninguna: ambos reflejan las 3 decisiones del usuario (admins+mecánicos, URL de clic, composer disponible). El `plan.md` ya se actualizó con las decisiones.

---

## Plan de validación (por RF — **EJECUCIÓN BLOQUEADA hasta confirmación de backend listo**)

| RF | Prueba manual (cuando backend listo) |
|---|---|
| RF-1 | Abrir en Chrome desktop / Android / iOS pestaña / iOS instalada → verificar visibilidad toggle / CTA instalar. |
| RF-2 | Click ON → permiso → suscripción → POST 200 → toggle ON + snackbar. Click ON con permiso denied → snackbar instrucciones. Desconectar red → click ON → snackbar 503 + toggle OFF. |
| RF-3 | Click OFF → unsubscribe local + POST → toggle OFF + snackbar. Red desconectada → rollback a ON + snackbar 503. |
| RF-4 | Recargar app → estado persiste. Borrar datos del sitio (DevTools → Application → Clear storage) → recargar → re-suscripción silenciosa → toggle ON. Cambiar permiso a denied en ajustes del navegador → recargar → toggle OFF. |
| RF-5 | Enviar push real desde backend (curl/script) con app cerrada → notificación nativa con title/body/icono. Enviar 2 pushes mismo order_id → solo 1 notificación visible. |
| RF-6 | Clic en notificación (app cerrada) → abre orden. Clic (app abierta en otra pestaña) → foco + navega. |
| RF-7 | Permiso denied → snackbar con botón "Abrir ajustes" (Chrome). Red caída en subscribe → snackbar 503. |
| RF-8 | iOS Safari pestaña → CTA instalar. iOS PWA instalada → toggle funcional. |

---

## Rutas de archivos a crear/modificar (para el plan de tareas posterior)

**Nuevos:**
- `src/utils/pushUtils.ts` — `urlBase64ToUint8Array`, `isPushSupported()`, `getPermissionState()`, `SUPPORTED_KEY = 'pushNotificationsEnabled'`.
- `src/components/PushNotificationsToggle.tsx` — componente con `CustomSwitch`, lógica RF-1..RF-4.
- `public/sw.js` modificado (o `customWorker` si next-pwa lo soporta) — handlers `push` y `notificationclick` (RF-5, RF-6).

**Modificados:**
- `pages/index.tsx` — montar `PushNotificationsToggle` en la card recomendada (OP-1).
- `src/services/api.ts` — añadir `pushPublicKey()`, `pushSubscribe()`, `pushUnsubscribe()` (mismo patrón que `apiGetVersionApp`).
- `next.config.mjs` — si se usa `customWorker` de next-pwa, configurarlo; si no, script post-build que anexa handlers al `public/sw.js` generado.

---

## Resumen para aprobación

- **Archivo**: `specs/010-push-notificaciones-pwa/spec.md`
- **RFs**: 8 (RF-1 visibilidad, RF-2 activación, RF-3 desactivación, RF-4 restauración, RF-5 SW push, RF-6 SW click, RF-7 errores, RF-8 iOS)
- **Decisiones abiertas**: 4 (OP-1 ubicación toggle — home recomendada; OP-2 toggle en técnico — no por ahora; OP-3 notificación en foreground — sí; OP-4 copy snackbar denied — propuesto)
- **Pruebas**: definidas por RF, **bloqueadas** hasta confirmación "backend listo" del usuario.
- **Duda solo usuario**: confirmar OP-1..OP-4; el resto del contrato está congelado por `backend-prompt.md`.