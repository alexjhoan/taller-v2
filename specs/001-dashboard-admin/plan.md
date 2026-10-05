# Plan 001 — Dashboard del Administrador

## Archivos y responsabilidades

| Archivo | Responsabilidad |
|---------|-----------------|
| `pages/admin/dashboard.tsx` | Página principal del dashboard con tabs (Vehículos / Usuarios) |
| `src/components/admin/VehicleList.tsx` | Lista de vehículos con filtros, búsqueda y paginación |
| `src/components/admin/VehicleDetail.tsx` | Detalle de un vehículo con historial de órdenes |
| `src/components/admin/UserList.tsx` | Lista de usuarios con acciones (crear, editar, desactivar, reactivar) |
| `src/components/admin/UserFormModal.tsx` | Modal para crear/editar usuarios |
| `src/components/admin/ConfirmDialog.tsx` | Diálogo de confirmación reutilizable |
| `src/hooks/useVehicles.ts` | Hook para datos de vehículos (React Query) |
| `src/hooks/useUsers.ts` | Hook para datos de usuarios (React Query) |

## Funciones puras

```typescript
// Filtrar vehículos por estado
function filterVehiclesByStatus(vehicles: Vehicle[], status: string): Vehicle[]

// Buscar vehículos por placa (búsqueda parcial, case-insensitive)
function searchVehiclesByPlate(vehicles: Vehicle[], query: string): Vehicle[]

// Paginar lista
function paginateList<T>(items: T[], page: number, pageSize: number): T[]

// Formatear fecha para mostrar
function formatDate(dateString: string): string

// Validar email único
function isEmailUnique(users: User[], email: string, excludeId?: number): boolean

// Obtener label de estado
function getStatusLabel(status: string): string

// Obtener color de badge según estado
function getStatusColor(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral'
```

## Algoritmo en pseudocódigo

### Lista de vehículos
```
1. Obtener vehículos de GET /vehicles (React Query)
2. Aplicar filtro por estado (si hay filtro activo)
3. Aplicar búsqueda por placa (si hay query)
4. Ordenar por created_at descendente
5. Paginar (20 por página)
6. Mostrar lista con estados de carga y error
```

### Detalle de vehículo
```
1. Recibir vehicleId por query param
2. Obtener datos del vehículo de GET /vehicles?id=X
3. Obtener historial de órdenes de GET /work_orders?vehicle_plate=XXX
4. Mostrar ficha del vehículo + lista de órdenes asociadas
```

### Crear/Editar usuario
```
1. Abrir modal con formulario
2. Validar campos obligatorios (first_name, last_name, email, password, role)
3. Si es crear: verificar email único
4. Si es editar: excluir email actual de la validación
5. Enviar POST /users o PATCH /users
6. Mostrar notificación de éxito/error
7. Cerrar modal y refrescar lista
```

### Desactivar/Reactivar usuario
```
1. Mostrar diálogo de confirmación
2. Si confirma: enviar PATCH /users con { id, active: 0 o 1 }
3. Mostrar notificación de éxito/error
4. Refrescar lista de usuarios
```

## Decisiones técnicas

| Decisión | Alternativa descartada | Justificación |
|----------|------------------------|---------------|
| React Query para datos | useState + useEffect manual | Cache automático, refetch, estados de loading/error integrados |
| Paginación en frontend | Paginación en backend | Simplicidad — con < 100 vehículos no es necesario |
| Búsqueda en frontend | Búsqueda en backend | Evita requests por cada tecla — debounce no necesario con datos locales |
| Confirmación para acciones destructivas | Sin confirmación | RF-13 exige confirmación — previene errores irreversibles |
| Modal para crear/editar usuario | Página separada | Menos navegación, más rápido para acciones simples |
| active = 0/1 en users | Eliminar usuario | Desactivación lógica es reversible y no pierde historial |

## Estrategia de tests

Tests con `node --test` para funciones puras:

```typescript
// tests/vehicleFilters.test.js
test('filterVehiclesByStatus filtra correctamente')
test('searchVehiclesByPlate busca parcialmente')
test('paginateList divide correctamente')
test('isEmailUnique detecta duplicados')
test('getStatusColor retorna color correcto')
```

Cada test verifica una función pura con datos de entrada y salida esperada.

## Cobertura de RF por componente

| Componente | RF cubiertos |
|------------|--------------|
| VehicleList | RF-1, RF-2, RF-9, RF-12, RF-17 |
| VehicleDetail | RF-3, RF-16 |
| UserList | RF-4, RF-7, RF-15, RF-18 |
| UserFormModal | RF-5, RF-6 |
| ConfirmDialog | RF-13 |
| useVehicles | RF-11, RF-14 |
| useUsers | RF-8, RF-10 |
