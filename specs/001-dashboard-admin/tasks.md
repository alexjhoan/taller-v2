# Tareas 001 — Dashboard del Administrador

> **Nota:** la implementación final usó nombres diferentes a los planificados originalmente.
> El tab de Vehículos se eliminó del dashboard (decisión: tabla vehicles no se usa allí).

## Fase 1: Infraestructura y datos

- [x] **T1. Crear página base del dashboard.** RF-14
  - `pages/admin/dashboard.tsx` con tabs (Órdenes / Usuarios), protegido con withAuth
  - Hecho cuando: la página carga y muestra los dos tabs ✅

- [x] **T2. Crear hooks de datos.** RF-11, RF-14
  - `src/hooks/useVehicles.ts` y `src/hooks/useUsers.ts` con React Query
  - Hecho cuando: los hooks retornan datos, loading y error ✅

- [x] **T3. Crear funciones puras de utilidad.** RF-2, RF-9, RF-12, RF-17, RF-18
  - `src/utils/vehicleFilters.ts`: filterVehiclesByStatus, searchVehiclesByPlate,
    paginateList, isEmailUnique, sortUsersByName, formatDate, getStatusLabel, getStatusColor
  - (no se creó userHelpers.ts; las funciones de usuarios viven en vehicleFilters.ts)
  - Hecho cuando: las funciones existen y son puras ✅

## Fase 2: Vehículos

- [x] **T4. Crear componente de lista de vehículos/órdenes.** RF-1, RF-2, RF-9, RF-12, RF-17
  - Tab "Órdenes" integrado en `pages/admin/dashboard.tsx` (tabla, búsqueda, clic → detalle)
  - El tab de vehículos se decidió eliminar (MEMORY.md: tabla vehicles no se usa en dashboard)
  - Hecho cuando: la lista muestra datos, busca y navega al detalle ✅

- [x] **T5. Crear componente VehicleDetail.** RF-3, RF-16
  - `src/components/AdminVehicleDetail.tsx`
  - Hecho cuando: el detalle muestra datos del vehículo ✅

## Fase 3: Usuarios

- [x] **T6. Crear componente UserList.** RF-4, RF-7, RF-15, RF-18
  - Tab "Usuarios" integrado en `pages/admin/dashboard.tsx` (tabla con acciones)
  - Hecho cuando: la lista muestra usuarios con sus acciones ✅

- [x] **T7. Crear componente UserFormModal.** RF-5, RF-6
  - `src/components/CreateUserModal.tsx` (crear, con username) +
    `src/components/AdminUserDetail.tsx` (editar)
  - Validación de campos obligatorios; email único lo valida el backend (409)
  - Hecho cuando: el modal crea y edita usuarios correctamente ✅

- [x] **T8. Crear componente ConfirmDialog.** RF-13
  - `src/components/ui/CustomDialog.tsx` (reutilizable, usado para confirmaciones)
  - Hecho cuando: el diálogo muestra mensaje y botones de confirmar/cancelar ✅

## Fase 4: Integración y verificación

- [x] **T9. Integrar todos los componentes en el dashboard.** RF-1, RF-4, RF-10
  - Tabs conectados, Notistack para todas las acciones, detalle con vuelta a lista
  - Hecho cuando: el dashboard funciona completo con feedback visual ✅

- [x] **T10. Verificación final.** RF-11, RF-14
  - `npm run typecheck` sin errores; withAuth protege /admin/*
  - Hecho cuando: typecheck pasa y la protección funciona ✅
