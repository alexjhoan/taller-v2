# MEMORY.md — Diario de Estudio
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual
- Next.js 14 Pages Router, React 18, TypeScript, Tailwind, React Query, Notistack.
- Login: JWT en cookie (`bkBtM0NvMGsmMw`) + cookie de usuario (`bkBtM0NvMGsmMw_u`); restauración con `src/utils/session.ts`.
- Specs 001–004 aprobadas e implementadas.
- Componentes: ReceptionCheckinForm, AdminOrderDetail, TechnicianOrderDetail, TechnicianOrderList, WorkOrderList (unificado admin/técnico), OrderCard, EvidenceUploader, ClientQuotationPortal, CreateUserModal, TopBar, OrderStatusButton, Layout, Sidebar.
- **Nuevos componentes**: EvidenceGallery (carrusel con autoplay, thumbnails, modal lightbox), EvidenceGalleryModal (lightbox con grid de thumbnails), hook useOrderEvidence.
- UI primitives en `src/components/ui/`.
- Hooks: useWorkOrders, useDeliveredOrders, useUsers, useVehicles, useCreateOrder, useEvidenceUpload, useWhatsApp, useMediaQuery, useOrderEvidence.
- `parseWorkOrder` resiliente (JSON corrupto → `[]` + warn). `toNumericId` normaliza FKs string. WorkOrder ahora incluye `evidence?: string[]`.
- AdminOrderDetail: header con badge status clickeable (OrderStatusButton con lápiz + modal), OrderStatusSelect eliminado. Status SIEMPRE editable (cualquier usuario, sin restricción de rol).
- AdminOrderDetail: `updated_by` en PATCH con JSON.stringify({id, firstName, lastName, role}).
- WorkOrderList: filtro de status con localStorage (`work_orders_status_filter`), default "En taller". Admin ve todas, técnico solo las suyas.
- **EvidenceUploader**: nuevo modal "Tomar foto con cámara" usando `navigator.mediaDevices.getUserMedia({ facingMode: 'environment' })` con preview en video, captura via canvas→blob, manejo de errores (NotAllowedError, NotFoundError, OverconstrainedError), switch cámara trasera/frontal. Un solo input file para galería/drag-drop. **Vista admin y técnico usan el mismo uploader**.
- **EvidenceGallery**: carrusel principal con autoplay (5s), navegación flechas, indicadores dots, strip de thumbnails horizontal. Click abre EvidenceGalleryModal (lightbox) con grid de thumbnails, navegación teclado (ESC, flechas), click fuera para cerrar. Soporta imágenes y videos. Usado en AdminOrderDetail y TechnicianOrderDetail.
- Sidebar responsive (xs:425px, drawer + topbar con hamburguesa).
- Reloj TopBar: HH:MM (sin segundos).
- Tests: 82 tests en `tests/*.test.mjs`, `node --test`.
- **Audit trail**: `pages/admin/order-log.tsx` con timeline vertical, hook `useOrderAuditLog`, tipos en `src/types/audit.ts`. Botón "Ver Log de Cambios" en AdminOrderDetail.
- `.env.local`: `NEXT_PUBLIC_API_BASE_URL=http://localhost`, `NEXT_PUBLIC_PORTAL_URL=http://localhost:3000`.
- `npm run build` pasa. `npm run typecheck` pasa. `npm run lint` no (ESLint no configurado, preexistente).

## Decisiones (y por qué)
- Pages Router: requisito. Tipos autocontenidos por componente. Tailwind puro.
- React Query (caché API) + Context (estado global). Notificaciones en apiClient.ts.
- Backend resuelve login con usuario O email. FKs del backend son strings → `toNumericId()`.
- `allowedDevOrigins` detecta IPs LAN en runtime (Next 14 no admite `192.168.*`).
- Subagentes V2: `.opencode/agents/*.md`. Fallback si rate limit: reintentar 1 vez y luego hacer manual.
- Badge status clickeable (OrderStatusButton) en vez de select nativo — mejor UX en móvil.
- **Código limpio**: eliminar imports no usados, variables muertas y código huérfano. Regla permanente: si no se usa, se quita.
- **Anchos unificados**: Recepción `max-w-2xl`, Admin/Técnico `max-w-4xl`, Portal `max-w-md` (móvil-first).
- **Títulos responsive**: `text-xl sm:text-2xl` en <425px (Recepción, Portal, Admin, Técnico, History).
- **EvidenceUploader**: cámara con `getUserMedia` (no `capture="environment"`) da control total, pide permisos correctamente, funciona en iOS Safari. Preview en modal, captura canvas→blob→File→addFiles(). Un solo input file para galería/drag-drop. Admin y técnico comparten componente.
- **EvidenceGallery**: carrusel sin dependencias externas (ligero, accesible). Auto-play 5s, pause on hover, thumbnails strip, modal lightbox con grid thumbnails y navegación completa.

## Aprendizajes y errores a evitar
- Campos API snake_case exactos. Offline: `{ status: 503, statusText: 'OfflineMode' }`.
- Cookie JWT ofuscada: `bkBtM0NvMGsmMw` en `src/utils/const.ts`.
- Tests con alias `@/`: `register('./alias-resolver.mjs')` + `import()` dinámico.
- Chrome DevTools MCP: refs caducan tras snapshot. Verificar por DOM, no por imagen.
- Prueba UI autenticada: cookies dummy + `window.next.router.push(...)`.
- **EvidenceUploader**: error 401 "Authorization token missing or malformed" ocurre cuando el `fetch` no incluye el JWT. El hook `useEvidenceUpload` y `api.upload` ya envían el token vía `setApiToken()` — asegúrate de llamar `setApiToken(token)` después del login, no solo en el componente evidencia.
- **getUserMedia** en modal: manejar NotAllowedError (permiso denegado), NotFoundError (sin cámara), OverconstrainedError (cámara trasera no disponible → fallback a frontal). Limpiar tracks al cerrar modal.

## Próximos pasos
- Log de cambios (audit trail) del plan propuesto (`specs/005-audit-log/plan.md`).
- Backend: POST /api/orders/{id}/send-email.
- Columna `username` en tabla users.
- Verificar visualmente repuestos en checkin.