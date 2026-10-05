# Tareas 001 — Dashboard del Administrador

## Fase 1: Infraestructura y datos

- [x] **T1. Crear página base del dashboard.** RF-14
  - Crear `pages/admin/dashboard.tsx` con tabs (Vehículos / Usuarios)
  - Proteger con withAuth (solo admin)
  - Hecho cuando: la página carga y muestra los dos tabs

- [ ] **T2. Crear hooks de datos.** RF-11, RF-14
  - Crear `src/hooks/useVehicles.ts` con React Query (GET /vehicles)
  - Crear `src/hooks/useUsers.ts` con React Query (GET /users)
  - Hecho cuando: los hooks retornan datos, loading y error

- [ ] **T3. Crear funciones puras de utilidad.** RF-2, RF-9, RF-12, RF-17, RF-18
  - Crear `src/utils/vehicleFilters.ts` con filterVehiclesByStatus, searchVehiclesByPlate, paginateList
  - Crear `src/utils/userHelpers.ts` con isEmailUnique, formatDate, getStatusLabel, getStatusColor
  - Hecho cuando: las funciones pasan los tests con `node --test`

## Fase 2: Vehículos

- [ ] **T4. Crear componente VehicleList.** RF-1, RF-2, RF-9, RF-12, RF-17
  - Crear `src/components/admin/VehicleList.tsx`
  - Mostrar tabla con placa, marca, modelo, cliente, estado
  - Añadir filtro por estado y búsqueda por placa
  - Añadir paginación (20 por página)
  - Hecho cuando: la lista muestra datos, filtra, busca y pagina correctamente

- [ ] **T5. Crear componente VehicleDetail.** RF-3, RF-16
  - Crear `src/components/admin/VehicleDetail.tsx`
  - Mostrar ficha del vehículo (datos completos)
  - Mostrar historial de órdenes asociadas (GET /work_orders?vehicle_plate=XXX)
  - Hecho cuando: el detalle muestra datos del vehículo y sus órdenes

## Fase 3: Usuarios

- [ ] **T6. Crear componente UserList.** RF-4, RF-7, RF-15, RF-18
  - Crear `src/components/admin/UserList.tsx`
  - Mostrar tabla con nombre, email, rol, estado
  - Añadir botones: crear, editar, desactivar, reactivar
  - Hecho cuando: la lista muestra usuarios con sus acciones

- [ ] **T7. Crear componente UserFormModal.** RF-5, RF-6
  - Crear `src/components/admin/UserFormModal.tsx`
  - Formulario con: first_name, last_name, email, password, phone, role
  - Validar campos obligatorios y email único
  - Soportar modo crear y modo editar
  - Hecho cuando: el modal crea y edita usuarios correctamente

- [ ] **T8. Crear componente ConfirmDialog.** RF-13
  - Crear `src/components/admin/ConfirmDialog.tsx`
  - Diálogo de confirmación reutilizable
  - Hecho cuando: el diálogo muestra mensaje y botones de confirmar/cancelar

## Fase 4: Integración y verificación

- [ ] **T9. Integrar todos los componentes en el dashboard.** RF-1, RF-4, RF-10
  - Conectar VehicleList y UserList en el dashboard
  - Añadir notificaciones Notistack para todas las acciones
  - Hecho cuando: el dashboard funciona completo con feedback visual

- [ ] **T10. Verificación final.** RF-11, RF-14
  - Ejecutar `npm run lint && npm run typecheck`
  - Verificar que el dashboard solo es accesible con rol admin
  - Hecho cuando: typecheck pasa sin errores y la protección funciona
