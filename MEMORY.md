# MEMORY.md — Diario de Estudio
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual
- Next.js 14 Pages Router, React 18, TypeScript, Tailwind, React Query, Notistack.
- Login: JWT en cookie (`bkBtM0NvMGsmMw`) + cookie de usuario (`bkBtM0NvMGsmMw_u`); restauración con `src/utils/session.ts`.
- Specs 001–004 aprobadas e implementadas. Spec 007 (`specs/007-multi-mechanic-assignment/`) implementada: asignación múltiple de mecánicos.
- Spec 008 (aprobación de repuestos) — frontend COMPLETO (T-1..T-15, reviewer APROBADO RF por RF): helpers en `src/utils/parts.ts`, AdminOrderDetail (admin en `accepted`, persistencia inmediata PATCH + `budget_accepted: 0`, Aceptar/Rechazar con deshacer, paso de precio, badge "Solicitud del técnico" e "Ingresado"), TechnicianOrderDetail (solo borra sus solicitudes no aceptadas, con guardia en `deletePart`), portal filtra `pending`/`rejected` vía `visibleParts` y gating totales por decisión del cliente, dashboard con contador de pendientes (solo admin), historial solo lectura, `API_FRONTEND.md` con el contrato de `parts`, y **44 tests** en verde.
- **Vocabulario de `approvalStatus` (repuesto) = `pending` → `accepted` → `rejected`** (T-15, cambio de requisito del usuario). `accepted` = aceptado por el ADMIN y visible al cliente para que lo apruebe; la aprobación del CLIENTE es otra cosa (`budget_accepted` + decisiones de sesión del portal). Repuestos creados por el admin (detalle y RECEPCIÓN) nacen `accepted`; los del mecánico nacen `pending`. **OJO**: `approved` sigue siendo un valor de `OrderStatus` (estado de la ORDEN) — no confundirlos.
- **T-14** cerró un riesgo de pérdida de datos: `assignFallbackPartIds` da `id` de respaldo al cargar en admin/técnico (sin él, `undefined === undefined` hacía que Eliminar/Aceptar afectara a TODOS los repuestos). **NO es end-to-end hasta que el backend PHP cumpla RF-10/RF-11** — hasta entonces el admin verá todos los repuestos como "Ingresado" sin botones (fallback esperado).
- Componentes: ReceptionCheckinForm, AdminOrderDetail, TechnicianOrderDetail, TechnicianOrderList, WorkOrderList (unificado admin/técnico), OrderCard, EvidenceUploader, ClientQuotationPortal, CreateUserModal, TopBar, OrderStatusButton, Layout, Sidebar.
- **Nuevos componentes**: EvidenceGallery (carrusel con autoplay, thumbnails, modal lightbox), EvidenceGalleryModal (lightbox con grid de thumbnails), hook useOrderEvidence.
- UI primitives en `src/components/ui/`.
- Hooks: useWorkOrders, useDeliveredOrders, useUsers, useVehicles, useCreateOrder, useEvidenceUpload, useWhatsApp, useMediaQuery, useOrderEvidence.
- `parseWorkOrder` resiliente (JSON corrupto → `[]` + warn). `toNumericId` normaliza FKs string; `toNumericIdArray` normaliza `assigned_user_id` a `number[]` (acepta JSON string "[3,5]", array o legacy 3/"3"). WorkOrder ahora incluye `evidence?: string[]`.
- **Asignación múltiple (spec 007)**: `assigned_user_id` es array de IDs; se envía como JSON string `"[3, 5]"` ("[]" = sin asignar). Recepción y AdminOrderDetail usan checkboxes (no select); OrderCard muestra un badge por mecánico; filtro del técnico por inclusión.
- AdminOrderDetail: header con badge status clickeable (OrderStatusButton con lápiz + modal), OrderStatusSelect eliminado. Status SIEMPRE editable (cualquier usuario, sin restricción de rol).
- AdminOrderDetail: `updated_by` en PATCH con JSON.stringify({id, firstName, lastName, role}).
- **Spec 009 (en revisión)**: notificaciones admin con campana, polling **120s**, reutiliza tabla `alerts` existente.
- **Futuro (Spec 010)**: notificaciones a mecánicos cuando su orden cambia de estado. Requiere `user_id` en `alerts` o tabla `alert_reads` (estado leído por usuario), rompería la simplicidad actual de lectura compartida. Queda en memoria para decidir después de cerrar Spec 009.
- WorkOrderList: filtro de status con localStorage (`work_orders_status_filter`), default "En taller". Admin ve todas, técnico solo las suyas.
- **EvidenceUploader**: nuevo modal "Tomar foto con cámara" usando `navigator.mediaDevices.getUserMedia({ facingMode: 'environment' })` con preview en video, captura via canvas→blob, manejo de errores (NotAllowedError, NotFoundError, OverconstrainedError), switch cámara trasera/frontal. Un solo input file para galería/drag-drop. **Vista admin y técnico usan el mismo uploader**.
- **EvidenceGallery**: carrusel principal con autoplay (5s), navegación flechas, indicadores dots, strip de thumbnails horizontal. Click abre EvidenceGalleryModal (lightbox) con grid de thumbnails, navegación teclado (ESC, flechas), click fuera para cerrar. Soporta imágenes y videos. Usado en AdminOrderDetail y TechnicianOrderDetail.
- Sidebar responsive (xs:425px, drawer + topbar con hamburguesa).
- Reloj TopBar: HH:MM (sin segundos).
- Tests: `tests/ids.test.mjs` (8 tests, `node --test`). Node ≥23 importa `.ts` directo (type stripping), sin alias-resolver.
- **Audit trail**: `pages/admin/order-log.tsx` con timeline vertical, hook `useOrderAuditLog`, tipos en `src/types/audit.ts`. Botón "Ver Log de Cambios" en AdminOrderDetail.
- `.env.local`: `NEXT_PUBLIC_API_BASE_URL=http://localhost`, `NEXT_PUBLIC_PORTAL_URL=http://localhost:3000`.
- `npm run build` pasa. `npm run typecheck` pasa. `npm run lint` no (ESLint no configurado, preexistente).
- **Spec 010 (push notificaciones) — E2E VERIFICADO en Chrome real (backend ya implementado, 200 en los 3 endpoints)**: fixes de esta sesión →
  1. `isPushSupported()` usaba `'pushManager' in navigator.serviceWorker` (SIEMPRE false; `pushManager` vive en la REGISTRAción). Fix: `'PushManager' in window`.
  2. "Ejecutar Todo" del debugger no hacía nada: closures obsoletos de `isRunning` + función duplicada `runAllSteps`. Fix: secuencia con `cancelRef` (useRef), para ante el primer error.
  3. Pasos 4–6 del debugger usaban `localStorage.getItem('token')`/`userId` (nunca existen; el JWT vive SOLO en cookie) → `Bearer null` 401. Fix: cliente `api` (`pushPublicKey/pushSubscribe`) + `userRef.current?.id`.
  4. **NADIE registraba el SW** en toda la app → `serviceWorker.ready` cuelga eterno. Fix: `ensureServiceWorkerRegistered()` en `pushUtils` (idempotente; si hay registro sin worker activo, re-registra para reemplazar el install encallado), llamado por el toggle y el debugger.
  5. **`public/sw.js` es artefacto de build prod** (workbox precache de chunks con hashes viejos) → en dev su `install` cuelga (404 en precache). Fix: `public/sw-dev.js` minimalista (solo push + notificationclick) y `getServiceWorkerPath()` devuelve `/sw-dev.js` en dev, `/sw.js` en prod. NO fijar rutas de SW a mano.
- Lección: si un chunk/código nuevo "no aparece" en el navegador de pruebas, es caché de chunks del dev server (refrescar duro o reiniciar dev limpiando `.next`).
- **Contrato de envoltorio del backend**: toda respuesta es `{ status, body, statusText }` — al tipar métodos de `api.ts`, el genérico DEBE describir el envoltorio, no el payload interior (bug real: `pushPublicKey` tipado `{ public_key }` en raíz → `undefined` en runtime → "Clave VAPID pública vacía" aunque el backend respondía 200 con la clave en `body`). Leer siempre `response.body?.campo`.
- **Push "solo llega una vez"**: NO es cuota (FCM acepta todo; verificar `accepted_by_push_service`/`failed` en la respuesta de `/api/push/test`). Es el `tag: 'order-'+order_id` repetido: Chrome REEMPLAZA en silencio la notificación sin banner. Fix: `order_id=0` (prueba) → tag único + `requireInteraction:false`; órdenes reales conservan `order-N` sticky. Handlers duplicados en `public/sw-dev.js` (dev) y `scripts/append-sw-handlers.cjs` (prod) — cambiar SIEMPRE ambos. Para ver si un push llegó aunque el SO no lo muestre: `registration.getNotifications()` desde la página.
- Diseño de `/notifications`: toggle push entre tabs y listado; debugger vive en un modal (`CustomDialog`, maxWidth `lg`) que abre el botón "Debug Push" del header con estado fresco cada vez.

## Decisiones (y por qué)
- Pages Router: requisito. Tipos autocontenidos por componente. Tailwind puro.
- React Query (caché API) + Context (estado global). Notificaciones en apiClient.ts.
- Backend resuelve login con usuario O email. FKs del backend son strings → `toNumericId()`.
- `allowedDevOrigins` detecta IPs LAN en runtime (Next 14 no admite `192.168.*`).
- Subagentes V2: `.opencode/agents/*.md`. Fallback si rate limit: reintentar 1 vez y luego hacer manual.
- **Skills por agente**: cada agente lista en su prompt las skills que puede cargar con la herramienta `skill` (permiso `skill` en el frontmatter). Espejo `.agents/agents/` idéntico byte a byte. Tabla completa en `AGENTS.md` §Skills (31 skills).
- **`grill-me` reparada**: el paquete de `mattpocock/skills` instala un stub que redirige a una skill `grilling` que no se incluye. Se reescribió con el contenido real de `grilling` y se eliminó `disable-model-invocation` (dejaba la skill invisible al modelo) y la carpeta `agents/openai.yaml` (para el SDK de OpenAI, inútil aquí).
- Badge status clickeable (OrderStatusButton) en vez de select nativo — mejor UX en móvil.
- **Código limpio**: eliminar imports no usados, variables muertas y código huérfano. Regla permanente: si no se usa, se quita.
- **Anchos unificados**: Recepción `max-w-2xl`, Admin/Técnico `max-w-4xl`, Portal `max-w-md` (móvil-first).
- **Títulos responsive**: `text-xl sm:text-2xl` en <425px (Recepción, Portal, Admin, Técnico, History).
- **EvidenceUploader**: cámara con `getUserMedia` (no `capture="environment"`) da control total, pide permisos correctamente, funciona en iOS Safari. Preview en modal, captura canvas→blob→File→addFiles(). Un solo input file para galería/drag-drop. Admin y técnico comparten componente.
- **EvidenceGallery**: carrusel sin dependencias externas (ligero, accesible). Auto-play 5s, pause on hover, thumbnails strip, modal lightbox con grid thumbnails y navegación completa.

## Aprendizajes y errores a evitar
- Campos API snake_case exactos. Offline: `{ status: 503, statusText: 'OfflineMode' }`.
- Cookie JWT ofuscada: `bkBtM0NvMGsmMw` en `src/utils/const.ts`.
- Chrome DevTools MCP: refs caducan tras snapshot. Verificar por DOM, no por imagen.
- Prueba UI autenticada: cookies dummy + `window.next.router.push(...)`.
- **EvidenceUploader**: error 401 "Authorization token missing or malformed" ocurre cuando el `fetch` no incluye el JWT. El hook `useEvidenceUpload` y `api.upload` ya envían el token vía `setApiToken()` — asegúrate de llamar `setApiToken(token)` después del login, no solo en el componente evidencia.
- **getUserMedia** en modal: manejar NotAllowedError (permiso denegado), NotFoundError (sin cámara), OverconstrainedError (cámara trasera no disponible → fallback a frontal). Limpiar tracks al cerrar modal.

## Próximos pasos
- **Spec 008 — bloqueante para end-to-end**: backend PHP/MariaDB debe cumplir **RF-10** (`PATCH /api/orders` guarda `parts` verbatim; `GET /api/orders` devuelve `id`, `approvalStatus`, `requestedByTechnician`, `criticality`) y **RF-11** (`GET /api/public/order/{token}` filtra server-side a solo repuestos aprobados/sin estado). El frontend ya está preparado: al llegar, los botones de aprobación aparecen solos sin tocar código.
- Verificación manual pendiente: probar el flujo completo (mecánico solicita → admin aprueba con precio → contador → portal) cuando el backend cumpla RF-10.
- Backend: POST /api/orders/{id}/send-email.
- Columna `username` en tabla users.
- Verificar visualmente repuestos en checkin.
- Limpieza opcional: interfaces legacy `RequiredPart`/`TechnicianPartRequest` en `src/types/index.ts` parecen huérfanas (previas a la spec 008).