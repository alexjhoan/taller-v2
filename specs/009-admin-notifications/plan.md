# Plan: Notificaciones del administrador — Campana en la barra superior (Spec 009)

## Objetivo

Implementar una campana de notificaciones **solo para administradores** en la barra superior
(junto al reloj) con contador de pendientes, modal de alertas no leídas, marcado de lectura
al hacer clic y navegación a la orden. Todo sobre la tabla `alerts` existente, sin crear
tablas ni columnas nuevas. Polling cada 120 s + refetch al enfocar ventana.

## Decisiones de implementación (derivadas de las decisiones de diseño de la spec)

1. **Helpers puros en `src/utils/alerts.ts`** con tests `node --test`: etiqueta/icono por
   `type`, formateo de fecha `dd/mm/aaaa hh:mm`, conteo con tope 50 ("50+"). Lógica de
   negocio pura → fuera de componentes, testeable sin backend. Alternativa descartada:
   lógica inline en cada componente (ya hay duplicación de `formatTime` en `TopBar`).

2. **Hook `useAlerts` en `src/hooks/useAlerts.ts`** con React Query: `GET /api/alerts?unread=1`,
   `PATCH /api/alerts`, `POST /api/alerts/read-all`. Polling 120 s (`refetchInterval: 120000`),
   `refetchOnWindowFocus: true`, manejo de offline 503 (conserva último estado conocido).
   Cache key `['alerts', 'unread']`. Alternativa descartada: `setInterval` manual + `fetch`.

3. **Campana en `TopBar`**: icono `Bell` de `lucide-react`, contador con tope 50+, `aria-label`
   dinámico ("Notificaciones, N sin leer" / "Notificaciones"), solo si `user?.role === 'admin'`.
   Responsive 320px: campana + reloj + avatar sin solaparse; a 320px oculta texto de hora.

4. **Modal `NotificationModal` (componente separado)** reutilizando `CustomDialog`: lista de
   alertas pendientes (del hook), etiqueta de tipo + mensaje + fecha, truncado 2 líneas con
   elipsis, click = `markAsRead(id)` + navegación, botón "Marcar todas" solo si hay pendientes,
   estados: carga, vacío ("No tienes notificaciones pendientes"), error con "Reintentar",
   offline 503 sin romper barra. Accesibilidad: `role="dialog"`, `aria-modal="true"`, Escape
   cierra, foco devuelto a campana.

5. **Integración en `Layout` → `TopBar`**: `TopBar` ya está en `Layout`; solo pasa `user`
   (role) al hook interno de la campana. No hay cambios en `Layout` más allá de lo existente.

6. **Actualizar `API_FRONTEND.md`** con contrato de `alerts` (esquema real, 5 tipos nuevos +
   legacy, 3 endpoints, reglas de generación). Regla de la constitución #2.

## Arquitectura de la solución

### Fase 1 — Helpers puros + tipos + tests (RF-3, RF-10, RF-11, RF-18)

`src/utils/alerts.ts`:
- `getAlertTypeInfo(type: string)` → `{ label: string; icon: LucideIcon }` (tabla de la
  spec: 5 tipos nuevos + legacy `customer_decision` + desconocido).
- `formatAlertDate(createdAt: string)` → `dd/mm/aaaa hh:mm` (locale `es-VE`).
- `formatUnreadCount(count: number)` → `string` (`"0"` oculta, `"1"`–`"49"`, `"50+"`).
- Tests en `tests/alerts.test.mjs` (node:test): casos por tipo, legacy, desconocido,
  formateo de fecha, conteo con tope, regresiones.

`src/types/alerts.ts` (nuevo, self-contained en el hook o archivo aparte):
- `Alert` interface (id, order_id, type, message, read_at, created_at — strings tolerados).
- `AlertType` union literal con los 6 valores conocidos.

### Fase 2 — Hook `useAlerts` (RF-12, RF-13, RF-14, RF-16, RF-17)

`src/hooks/useAlerts.ts`:
- `useUnreadAlerts()` → `{ data: Alert[], isLoading, isError, error, refetch, count }`.
  React Query `useQuery` con `queryKey: ['alerts', 'unread']`, `refetchInterval: 120000`,
  `refetchOnWindowFocus: true`, `staleTime: 0`. Endpoint: `endpoints.alerts + '?unread=1'`.
  Maneja `ApiError` y offline 503 (conserva `data` previo, no lanza error global).
- `useMarkAlertAsRead()` → `mutation` `PATCH /api/alerts` con `{ id }`, `onSuccess` invalida
  `['alerts', 'unread']`.
- `useMarkAllAlertsAsRead()` → `mutation` `POST /api/alerts/read-all`, invalida igual.
- El hook expone `unreadCount` derivado de `data?.length ?? 0` (el backend ya limita a 50).

### Fase 3 — Campana en `TopBar` (RF-1, RF-2, RF-3, RF-4, RF-18, RF-20)

`src/components/TopBar.tsx` (modificación):
- Import `Bell` de `lucide-react`, `useUnreadAlerts` del hook, `CustomBadge` para contador.
- Condicional: solo renderiza si `user?.role === 'admin'`.
- Contador: `CustomBadge variant="danger" dot` con `formatUnreadCount(count)`.
- `aria-label` dinámico: `count > 0 ? \`Notificaciones, ${count} sin leer\` : 'Notificaciones'`.
- `aria-haspopup="dialog"`, `aria-expanded={isModalOpen}`.
- Click abre modal (estado local `isModalOpen` en `TopBar`).
- Responsive: a 320px `xs:text-hidden` en el `span` de la hora; icono `Clock` sigue visible
  con `aria-label` de la hora completa.

### Fase 4 — Modal `NotificationModal` (RF-5, RF-6, RF-7, RF-8, RF-9, RF-10, RF-11, RF-15, RF-16, RF-17, RF-18, RF-19, RF-21)

`src/components/NotificationModal.tsx` (nuevo):
- Props: `open`, `onClose`, `alerts`, `onMarkRead(id)`, `onMarkAllRead`, `isLoading`,
  `isError`, `error`, `onRetry`.
- `CustomDialog` con `maxWidth="lg"`, `disableBackdropClose={false}`,
  `disableEscapeClose={false}`, `title="Notificaciones pendientes"`.
- Header: título + badge con contador (mismo `formatUnreadCount`) + botón "Marcar todas como
  leídas" (solo si `alerts.length > 0`), `CustomButton variant="secondary" size="sm"`.
- Lista: `alerts.map(alert)` → fila clicable (`button` con `role="menuitem"`,
  `tabIndex=0`, `onClick` = marcar leída + navegar).
  - Etiqueta tipo: `CustomBadge` con variant según tipo (brand/info/warning/success/danger).
  - Mensaje: `line-clamp-2` + `truncate`.
  - Fecha: `formatAlertDate(alert.created_at)`.
- Estados:
  - Carga: skeleton o spinner en lista.
  - Vacío: "No tienes notificaciones pendientes" centrado.
  - Error: mensaje + `CustomButton variant="ghost" size="sm"` "Reintentar" → `onRetry()`.
  - Offline 503: aviso "Sin conexión" + "Reintentar".
- Accesibilidad: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` al título,
  botón cerrar `aria-label="Cerrar"`, foco al abrir en primer elemento (o botón cerrar),
  Escape cierra, `onClose` devuelve foco a campana (`ref` pasada desde `TopBar`).

### Fase 5 — Integración campana + modal en `TopBar` (RF-5, RF-6, RF-7, RF-9)

- `TopBar` mantiene `isModalOpen` y `bellRef`.
- Pasa `alerts`, `isLoading`, `isError`, `error` del hook al modal.
- `onMarkRead(id)` → `markAsReadMutation.mutate(id, { onSuccess: () => navigate(...) })`.
- Navegación: `router.push('/admin/dashboard?selectedOrderId=' + order_id)` (usa
  `useRouter` de Next.js Pages Router).
- `onMarkAllRead` → `markAllAsReadMutation.mutate()`.
- `onRetry` → `refetch()`.

### Fase 6 — Actualizar `API_FRONTEND.md` (RF-33)

- Sección "Contrato de `alerts`": esquema real (6 columnas), tipos de alerta (tabla),
  3 endpoints (GET ?unread=1, PATCH, POST read-all), reglas de generación (5 bullets),
  nota de compatibilidad (GET sin parámetro intacto), legacy `customer_decision` tolerado.

### Fase 7 — Página de notificaciones `/notifications` (RF-26 a RF-32)

Nueva ruta Pages Router: `pages/notifications/index.tsx` (protegida con `withAuth`, solo `admin`).

**Arquitectura:**
- Layout reutilizado (`Layout` + `TopBar` con campana).
- Estado de tab en URL: `/notifications?tab=unread` | `?tab=read` (default `unread`).
- Hook extendido: `useAlerts` añade `useReadAlerts()` (`GET ?read=1`).
- Componente reutilizable `AlertList` para ambas pestañas (recibe `alerts`, `emptyMessage`, `variant`).

**Componentes nuevos:**
- `pages/notifications/index.tsx` — página principal con tabs, header, breadcrumb.
- `src/components/AlertList.tsx` — lista reutilizable (skeleton, vacío, error, offline, truncado, fecha).
- `src/components/NotificationTabs.tsx` — tabs accesibles (`role="tablist"`, `aria-selected`, teclado ←/→).

**Extensiones en `useAlerts.ts`:**
- `useReadAlerts()` → `useQuery` con `queryKey: ['alerts', 'read']`, endpoint `?read=1`, mismo polling 120s, misma lógica offline.
- `useMarkAlertAsRead` y `useMarkAllAlertsAsRead` invalida ambas queries (`['alerts', 'unread']` y `['alerts', 'read']`).

**Tabs accesibles:**
- `role="tablist"`, botones con `role="tab"`, `aria-selected`, `aria-controls`, `id`.
- Teclado: ←/→ navega entre tabs, Tab entra a la lista, Escape cierra (si está en modal) o sale.
- URL sincronizada: `router.push('/notifications?tab=read', undefined, { shallow: true })`.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/utils/alerts.ts` | **NUEVO** — helpers puros: `getAlertTypeInfo`, `formatAlertDate`, `formatUnreadCount`, `getAlertBadgeVariant` + tests |
| `tests/alerts.test.mjs` | **NUEVO** — tests `node:test` de los helpers |
| `src/hooks/useAlerts.ts` | **NUEVO** — `useUnreadAlerts`, `useReadAlerts`, `useMarkAlertAsRead`, `useMarkAllAlertsAsRead` con React Query (polling 120s, offline 503) |
| `src/components/TopBar.tsx` | Campana condicional (solo admin), contador, `aria-label` dinámico, estado modal, responsive 320px, botón "Ver todas" |
| `src/components/NotificationModal.tsx` | **NUEVO** — Modal con lista, refresh + loader, "Marcar todas", "Ver todas", dropdown leídas, accesibilidad |
| `src/components/NotificationTabs.tsx` | **NUEVO** — Tabs accesibles para `/notifications` (role=tablist, teclado, URL sync) |
| `src/components/AlertList.tsx` | **NUEVO** — Lista reutilizable (skeleton, vacío, error, offline, truncado 2 líneas, fecha) |
| `pages/notifications/index.tsx` | **NUEVO** — Página completa con tabs, header, breadcrumb, URL sync |
| `API_FRONTEND.md` | Contrato de `alerts` (esquema con `triggered_by_user_id`, 5 tipos nuevos + legacy, 4 endpoints: GET ?unread=1, GET ?read=1, PATCH, POST read-all, reglas de generación) |

## Sin tocar

- `src/components/Layout.tsx` (ya usa `TopBar`; la campana vive dentro de `TopBar`).
- `src/services/api.ts` (ya declara `alerts: '/api/alerts'` en `endpoints`).
- `src/context/UserContext.tsx` (ya provee `user.role`).
- Tabla `alerts` en BD (no se crea ni altera; la spec lo prohíbe).
- Endpoints de backend (los implementa el usuario; el frontend consume lo declarado).
- `src/utils/const.ts`, `src/types/index.ts` (no se añaden tipos globales; `Alert` vive en el hook o `utils/alerts.ts`).
- Notificaciones push, WebSockets, preferencias por usuario, historial leídas, campana para mecánicos.

## Orden de las tareas y por qué

1. **Helpers + tests primero**: base pura que consumen hook y UI; se verifica con `node --test`
   **sin backend**.
2. **Hook `useAlerts` segundo**: encapsula React Query, polling, offline, mutaciones; UI solo
   consume el hook.
3. **Campana en `TopBar` tercero**: integra hook + modal; requiere helpers y hook listos.
4. **Modal `NotificationModal` cuarto**: componente separado, reutiliza `CustomDialog` y
   primitivas UI; recibe datos del hook vía `TopBar`.
5. **Integración campana+modal quinto**: une todo en `TopBar`; pasa callbacks de mutaciones.
6. **`API_FRONTEND.md` al cierre**: documenta lo implementado; regla constitución #2.
7. **Verificación final**: `npm run typecheck`, `npm run build`, `node --test` en verde.

## Verificación

- `node --test` en verde (`tests/alerts.test.mjs` + `tests/ids.test.mjs` + `tests/parts.test.mjs`).
- `npm run typecheck` sin errores.
- `npm run build` sin errores (12 páginas).
- `npm run lint` no ejecutable (preexistente: repo sin configuración ESLint; `next lint`
  abre asistente interactivo).
- Grep de control: ningún `user_id`/`is_read`/`title`/`dedupe_key` en código frontend;
  `TopBar` solo renderiza campana si `role === 'admin'`; `GET ?unread=1` en hook;
  `PATCH {id}` y `POST /read-all` en mutaciones; contador con "50+" a partir de 50.
- Responsive manual a 320px, 375px, 768px y escritorio: campana, reloj, avatar sin
  solaparse ni scroll horizontal.
- Accesibilidad manual: Tab a campana, Enter abre modal, Tab recorre alertas, Enter
  marca leída + navega, Escape cierra, foco vuelve a campana; `aria-label` dinámico
  anuncia contador; `role="dialog"` en modal.
- Estados verificados: carga (spinner), vacío ("No tienes notificaciones pendientes"),
  error con "Reintentar", offline 503 sin romper barra (último estado conocido).
- Backend cumple RF-22 a RF-32 (verificado por el usuario; frontend no valida backend).
- `GET /api/alerts` sin `unread=1` sigue devolviendo todas las alertas (no se toca).
- Las 6 alertas `customer_decision` existentes aparecen en la campana al abrirla.