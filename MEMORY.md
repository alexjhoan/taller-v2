# MEMORY.md — Diario de Estudio
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no
aporte.
## Estado actual
- Scaffold completo creado con Pages Router (no App Router).
- Componentes principales: ReceptionCheckinForm, TechnicianOrderView, TechnicianOrderDetail, AdminOrderDetail, AdminUserDetail, AdminOrderDetailReadOnly, ClientQuotationPortal, EvidenceGalleryModal.
- Componentes UI atómicos en src/components/ui/ (CustomDialog, CustomInput, CustomButton, CustomSwitch, CustomCard, CustomBadge, CustomStepper, CustomImage, Sidebar).
- Contextos: UserContext, DialogsProvider, WorkshopProvider.
- Servicios: api.ts (cliente HTTP), apiClient.ts (wrapper con notificaciones), localForage.ts (cola offline).
- Hooks: useWorkOrders, useDeliveredOrders, useUsers, useVehicles, useCreateOrder, useAudioRecorder, useWhatsApp.
- Integración con API real según API_FRONTEND.md (snake_case).
- Notistack para notificaciones al usuario (SnackbarProvider en _app.tsx).
- HOC withAuth para proteger páginas.
- Typecheck pasa sin errores.
- Login funcional con JWT en cookie.
- Rutas protegidas: /, /reception/checkin, /technician/order, /admin/* (solo admin).
- Rutas públicas: /login, /portal, /portal/evidence.
- Spec 001 (dashboard admin) aprobada e implementada.
- Spec 002 (detalle de orden) aprobada e implementada.
- Spec 003 (historial de órdenes entregadas) aprobada e implementada.
- Tabla vehicles creada con CRUD completo (pero no se usa en el dashboard).
- Checklist y parts se almacenan como JSON en work_orders.
- Portal del cliente funcional con token en URL.
## Decisiones (y por qué)
- Pages Router en lugar de App Router: requisito del proyecto, sin rutas diná�.
- Tipos autocontenidos en cada componente: facilita mantenimiento y desacoplamiento.
- Tailwind puro sin librería UI: más ligero y coherente con design system.
- React Query + React Context: React Query para caché de API, Context para estado global.
- Conexión real a API con datos mock como fallback: permite desarrollo sin backend.
- Tabla vehicles separada de work_orders: evita duplicación de datos (pero no se usa en dashboard).
- Órdenes delivered no se eliminan: solo cambian de estado (preserva historial).
- Paginación en frontend: simplicidad con < 100 registros.
- Notificaciones globalizadas en apiClient.ts: evita repetir código.
- Subagentes (planner, implementer, reviewer) no funcionan fuera de OpenCode.
## Aprendizajes y errores a evitar
- El nombre de la cookie JWT está ofuscado: `bkBtM0NvMGsmMw` en `src/utils/const.ts`.
- Los campos de API deben ser snake_case exactos (customer_name, vehicle_plate, etc.).
- El modo offline debe manejar respuestas `{ status: 503, statusText: 'OfflineMode' }`.
- Next.js 14.2.15 tiene vulnerabilidades de seguridad conocidas.
- Subagentes (planner, implementer, reviewer) no funcionan fuera de OpenCode.
- SnackbarProvider debe estar en _app.tsx para que funcione useSnackbar.
- React Query necesita invalidateQueries para actualizar la lista después de editar.
## Próximos pasos
- PENDIENTE: Agregar en dashboard admin un historial de vehículos entregados (ya implementado en /admin/history).
- Implementar envío de correo a clientes (sugerencia: POST /api/orders/{id}/send-email).
- Implementar sistema de versiones para auto-recarga.
- Actualizar Next.js a versión parcheada.
