# Tasks: Notificaciones del administrador — Campana en la barra superior

## Fase 1: Helpers puros y tests

- [ ] **T-1**: `src/utils/alerts.ts` — helpers puros:
  - `getAlertTypeInfo(type: string)` → `{ label: string; icon: LucideIcon }` según tabla de la spec (5 tipos nuevos + legacy `customer_decision` + desconocido). Importa iconos de `lucide-react` (`FileText`, `RefreshCw`, `Wrench`, `Check`, `XCircle`, `Bell`).
  - `formatAlertDate(createdAt: string)` → `dd/mm/aaaa hh:mm` (locale `es-VE`, 24h).
  - `formatUnreadCount(count: number)` → `string`: `"0"` → `""` (oculto), `"1"`–`"49"` → número, `≥50` → `"50+"`.
  - Tipos `Alert` e `AlertType` exportados desde aquí (self-contained).
- Hecho cuando: `src/utils/alerts.ts` exporta las 3 funciones + tipos; `TopBar` y `NotificationModal` importarán de aquí; `npm run typecheck` pasa.

- [ ] **T-2**: `tests/alerts.test.mjs` con `node:test` sobre los helpers:
  - `getAlertTypeInfo`: 7 casos (5 tipos nuevos, `customer_decision`, desconocido) verificando `label` e `icon`.
  - `formatAlertDate`: casos con fechas válidas, string ISO, formato `YYYY-MM-DD HH:MM:SS` del backend.
  - `formatUnreadCount`: 0, 1, 25, 49, 50, 60, 100.
  - Regresiones: tipo case-insensitive, `null`/`undefined` en fecha → fallback seguro.
- Hecho cuando: `node --test` queda en verde sumando `tests/ids.test.mjs` y `tests/parts.test.mjs` (total ≥ 44 tests previos + nuevos).

## Fase 2: Hook useAlerts con React Query

- [ ] **T-3**: `src/hooks/useAlerts.ts` — hook principal:
  - `useUnreadAlerts()`: `useQuery` con `queryKey: ['alerts', 'unread']`, `queryFn` → `api.get(endpoints.alerts + '?unread=1')`, `refetchInterval: 120000`, `refetchOnWindowFocus: true`, `staleTime: 0`. Retorna `{ data: Alert[], isLoading, isError, error, refetch, count }` donde `count = data?.length ?? 0`. Maneja offline 503: en `onError` si `error.status === 503 && error.statusText === 'OfflineMode'` conserva `data` previo y no propaga error global.
  - `useMarkAlertAsRead()`: `useMutation` `PATCH /api/alerts` con `{ id }`, `onSuccess` → `queryClient.invalidateQueries({ queryKey: ['alerts', 'unread'] })`.
  - `useMarkAllAlertsAsRead()`: `useMutation` `POST /api/alerts/read-all` (cuerpo vacío), `onSuccess` → invalida igual.
  - Tipado estricto: `Alert` con `id: string`, `order_id: string | null`, `type: string`, `message: string`, `read_at: string | null`, `created_at: string`.
- Hecho cuando: `npm run typecheck` pasa; el hook compila y exporta los 3 hooks; `TopBar` podrá importar `useUnreadAlerts`, `useMarkAlertAsRead`, `useMarkAllAlertsAsRead`.

## Fase 3: Campana en TopBar (solo admin)

- [ ] **T-4**: `src/components/TopBar.tsx` — agregar campana condicional:
  - Import: `Bell` de `lucide-react`, `useUnreadAlerts` de `useAlerts`, `CustomBadge`, `useState`, `useRef`, `useRouter` (Next.js Pages Router).
  - Solo renderiza campana si `user?.role === 'admin'` (mecánico/no sesión → nada, ni petición).
  - Botón campana: `aria-label` dinámico (`count > 0 ? \`Notificaciones, ${count} sin leer\` : 'Notificaciones'`), `aria-haspopup="dialog"`, `aria-expanded={isModalOpen}`, `ref={bellRef}` para foco al cerrar modal.
  - Contador: `CustomBadge variant="danger" dot className="absolute -top-1 -right-1"` con `formatUnreadCount(count)` (vacío si 0 → badge no se renderiza con `count === 0`).
  - Estado local `isModalOpen` + `bellRef` para `NotificationModal`.
  - Responsive 320px: en el `div` del reloj, `span` de la hora con `className="xs:hidden"` (oculta texto a <425px); `Clock` icono sigue visible con `aria-label` de hora completa (`formatTime(new Date())`).
- Hecho cuando: `npm run typecheck` pasa; en navegador admin ve campana + contador; mecánico no ve campana ni hay petición a `/api/alerts?unread=1` (Network tab); a 320px hora oculta, icono reloj visible, campana + reloj + avatar sin solaparse.

## Fase 4: Modal NotificationModal (componente separado)

- [ ] **T-5**: `src/components/NotificationModal.tsx` — componente nuevo:
  - Props: `open`, `onClose`, `alerts`, `onMarkRead(id, orderId)`, `onMarkAllRead`, `isLoading`, `isError`, `error`, `onRetry`, `bellRef` (para devolver foco).
  - `CustomDialog` con `maxWidth="lg"`, `title="Notificaciones pendientes"`, `disableBackdropClose={false}`, `disableEscapeClose={false}`.
  - Header: título + badge contador (`formatUnreadCount(alerts.length)`) + botón "Marcar todas como leídas" (`CustomButton variant="secondary" size="sm"`) solo si `alerts.length > 0`, `onClick={onMarkAllRead}`.
  - Lista:
    - Carga (`isLoading`): 3-4 skeletons (`div` con `animate-pulse` `h-16` `bg-slate-100`).
    - Vacío (`!isLoading && alerts.length === 0`): `p` centrado "No tienes notificaciones pendientes".
    - Error (`isError`): `div` con mensaje `error?.message ?? 'Error al cargar notificaciones'` + `CustomButton variant="ghost" size="sm"` "Reintentar" → `onRetry()`.
    - Offline 503: detectar `error?.status === 503` → aviso "Sin conexión" + "Reintentar".
    - Datos: `alerts.map(alert)` → `<button role="menuitem" tabIndex=0 className="w-full text-left p-3 hover:bg-slate-50 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500" onClick={() => onMarkRead(alert.id, alert.order_id)}>`:
      - Fila superior: `CustomBadge` con variant según `getAlertTypeInfo(alert.type)` (mapeo: `order_created`→`brand`, `order_status_changed`→`info`, `part_requested`→`warning`, `budget_accepted`→`success`, `budget_rejected`→`danger`, `customer_decision`→`neutral`, default→`neutral`), icono a la izquierda (`dot={true}`).
      - Mensaje: `p className="mt-1.5 line-clamp-2 text-sm text-slate-700"` con `alert.message`.
      - Fecha: `p className="mt-1 text-xs text-slate-400"` con `formatAlertDate(alert.created_at)`.
  - Accesibilidad: `role="dialog"`, `aria-modal="true"` (lo da `CustomDialog`), foco al abrir en primer botón de alerta (o botón cerrar si lista vacía), `onClose` → `bellRef.current?.focus()`.
- Hecho cuando: `npm run typecheck` pasa; modal se abre al click en campana, lista alertas con etiqueta/tipo/fecha, truncado 2 líneas, click en alerta dispara `onMarkRead`, "Marcar todas" solo si hay pendientes, estados carga/vacío/error/offline renderizan correctamente, Escape cierra y foco vuelve a campana.

## Fase 7: Integración campana + modal en TopBar (actualizada)

- [ ] **T-6**: `src/components/TopBar.tsx` — conectar modal y mutaciones + botón "Ver todas":
  - Import `NotificationModal`, `useMarkAlertAsRead`, `useMarkAllAlertsAsRead` de `useAlerts`, `useRouter` de `next/router`.
  - En cuerpo: `const { mutate: markAsRead } = useMarkAlertAsRead(); const { mutate: markAllAsRead } = useMarkAllAlertsAsRead(); const router = useRouter();`.
  - `handleMarkRead = (id, orderId) => { markAsRead(id, { onSuccess: () => { if (orderId) router.push(\`/admin/dashboard?selectedOrderId=\${orderId}\`); } }); }`.
  - `handleMarkAllRead = () => { markAllAsRead(); }`.
  - `handleRetry = () => { refetch(); }` (del `useUnreadAlerts`).
  - **Nuevo**: `handleViewAll = () => { router.push('/notifications?tab=unread', undefined, { shallow: true }); }`.
  - Render `NotificationModal` con props: `open={isModalOpen}`, `onClose={() => setIsModalOpen(false)}`, `alerts={data ?? []}`, `onMarkRead={handleMarkRead}`, `onMarkAllRead={handleMarkAllRead}`, `onViewAll={handleViewAll}`, `isLoading`, `isError`, `error`, `onRetry={handleRetry}`, `bellRef`.
  - `aria-expanded={isModalOpen}` en botón campana.
- Hecho cuando: click en campana abre modal; click en alerta → `PATCH /api/alerts` + navega a `/admin/dashboard?selectedOrderId={id}`; alerta desaparece y contador baja; "Marcar todas" → `POST /api/alerts/read-all` + lista vacía + contador 0; **"Ver todas" navega a `/notifications?tab=unread`**; error en `PATCH` navega igual; offline 503 conserva último estado.

## Fase 8: Componentes reutilizables para página de notificaciones

- [ ] **T-7**: `src/components/AlertList.tsx` — lista reutilizable (usada por modal y página):
  - Props: `alerts: Alert[]`, `emptyMessage: string`, `onMarkRead?: (id, orderId) => void`, `onMarkAllRead?: () => void`, `isLoading`, `isError`, `error`, `onRetry`, `showActions: boolean` (true en modal/unread, false en read).
  - Estados: skeletons (carga), vacío (`emptyMessage`), error + "Reintentar", offline 503 + "Reintentar", datos.
  - Fila: botón con `role="menuitem"`, truncado 2 líneas, badge tipo, fecha formateada.
  - Si `showActions`: click → `onMarkRead(id, orderId)`; header muestra badge contador + "Marcar todas" (solo si `alerts.length > 0`).
  - Si `!showActions`: solo lectura, sin botones de acción.
- Hecho cuando: `npm run typecheck` pasa; componente se usa en `NotificationModal` (con acciones) y en página `/notifications` (sin acciones en tab "Leídas").

- [ ] **T-8**: `src/components/NotificationTabs.tsx` — tabs accesibles:
  - Props: `activeTab: 'unread' | 'read'`, `onChange: (tab) => void`, `unreadCount: number`, `readCount: number`.
  - Render: `role="tablist"`, dos botones `role="tab"` con `aria-selected`, `aria-controls`, `id`, `tabIndex`.
  - Teclado: ←/→ navega entre tabs, Enter/Space activa, Tab entra al panel.
  - Estilos: `activeTab` con `border-b-2 border-brand-600 text-brand-600`, inactivo `text-slate-500 hover:text-slate-700`.
  - Badge contador en cada tab: `unreadCount` / `readCount` (formato `formatUnreadCount`).
- Hecho cuando: `npm run typecheck` pasa; tabs funcionan con teclado (←/→, Enter), `aria-selected` correcto, badges visibles.

- [ ] **T-9**: `src/hooks/useAlerts.ts` — extender hook:
  - Añadir `useReadAlerts()`: `useQuery` con `queryKey: ['alerts', 'read']`, endpoint `?read=1`, `refetchInterval: 120000`, `refetchOnWindowFocus: true`, misma lógica offline 503.
  - `useMarkAlertAsRead` y `useMarkAllAlertsAsRead` invalidan **ambas** queries: `queryClient.invalidateQueries({ queryKey: ['alerts'] })` (prefijo).
  - Exportar todo.
- Hecho cuando: `npm run typecheck` pasa; hook exporta `useUnreadAlerts`, `useReadAlerts`, `useMarkAlertAsRead`, `useMarkAllAlertsAsRead`.

## Fase 9: Página `/notifications` (RF-26 a RF-32)

- [ ] **T-10**: `pages/notifications/index.tsx` — página completa:
  - `withAuth(..., { roles: ['admin'], redirectTo: '/login' })`.
  - Lee `tab` de `router.query.tab` (default `'unread'`), sincroniza con estado local y URL (`router.push` shallow).
  - Usa `useUnreadAlerts()` y `useReadAlerts()` del hook extendido.
  - Header: `<h1>Notificaciones</h1>`, badge total (`unreadCount + readCount`), breadcrumb "Dashboard / Notificaciones".
  - `NotificationTabs` con `activeTab`, `onChange`, contadores.
  - Panel activo: `AlertList` con `alerts` correspondiente, `showActions = (activeTab === 'unread')`.
    - Tab "No leídas": `emptyMessage="No tienes notificaciones pendientes"`, `onMarkRead`, `onMarkAllRead`.
    - Tab "Leídas": `emptyMessage="No hay notificaciones leídas"`, `showActions=false`.
  - Estados carga/vacío/error/offline delegados a `AlertList`.
  - Responsive 320px: tabs apilados verticalmente en móvil, header compacto.
- Hecho cuando: `npm run typecheck` y `npm run build` pasan; en navegador:
  - `/notifications?tab=unread` muestra lista con acciones, "Marcar todas" funciona.
  - `/notifications?tab=read` muestra lista solo lectura, sin botones.
  - Cambio de tab actualiza URL sin recarga, botones ←/→ navegan tabs.
  - Badge en tabs muestra contadores correctos.
  - Header con breadcrumb funcional (click → dashboard).

## Fase 10: Documentación y verificación final

- [ ] **T-11**: `API_FRONTEND.md` — actualizar sección "Alertas" con:
  - Endpoint `GET /api/alerts?read=1` (nuevo).
  - Endpoint `GET /api/alerts` sin parámetros (legacy).
  - Esquema con `triggered_by_user_id`.
  - Reglas de generación actualizadas.
- Hecho cuando: `npm run typecheck` y `npm run build` pasan.

- [ ] **T-12**: Verificación end-to-end completa:
  - `node --test` en verde.
  - `npm run typecheck` sin errores.
  - `npm run build` sin errores (13 páginas: + `/notifications`).
  - Admin: campana → modal (pendientes, refresh, "Marcar todas", "Ver todas") → `/notifications` (tabs, listas, contadores, acciones en "No leídas", solo lectura en "Leídas").
  - Mecánico: campana NO visible, NO peticiones a `/api/alerts`.
  - Responsive: 320px, 375px, 768px, escritorio.
  - Accesibilidad: tabs con teclado, modal con Escape/foco, `aria-label` dinámico.
  - Estados: carga, vacío, error, offline 503 en modal y página.
  - Polling 120s + refetchOnWindowFocus en ambas queries.
  - 6 alertas `customer_decision` legacy aparecen en ambas listas (unread/read según `read_at`).
- Hecho cuando: todos los checks pasan.

## Estado

- **PLANIFICADA**: `spec.md` actualizada con RF-26 a RF-32, RF-9b.
- PENDIENTE: T-1 a T-12 (T-1 a T-6 ya implementados; T-7 a T-12 nuevos).