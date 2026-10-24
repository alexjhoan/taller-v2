# Plan: Asignación múltiple de mecánicos (Spec 007)

## Objetivo

Que `assigned_user_id` pase de FK escalar a **array de IDs de mecánicos**,
conservando el nombre del campo/API (decisión aprobada por el usuario). La UI
usa checkboxes múltiples (recepción y detalle admin) y el técnico ve todas las
órdenes donde participa (filtro por inclusión).

## Decisiones de contrato (aprobadas por el usuario)

1. El campo se llama igual: `assigned_user_id` (sin renombrar columnas ni endpoints).
2. En el payload se envía como **JSON string** (`"[3, 5]"`), igual que
   `parts`/`service_items`. Lista vacía = `"[]"` = sin asignar.
3. Al recibirlo se **normaliza siempre a `number[]`**, tolerando también array
   `[3,5]`, número/string legacy (`3`, `"3"`) y `null`/`""`.
4. JSON corrupto (`"[3,"`) → `[]`, sin tumbar la lista.

## Arquitectura de la solución

### Normalización en la entrada (helper puro + tests)

- `src/utils/ids.ts`:
  - `toNumericId(value): number | null` — normaliza un id suelto (el backend
    puede devolver `"3"` en string; `"3" !== 3` rompe `includes()`/`Map.get()`).
  - `toNumericIdArray(value): number[]` — normaliza `assigned_user_id` completo
    (array, JSON string, legacy escalar, null/undefined/"" → `[]`; JSON corrupto
    → `[]` sin lanzar).
- `tests/ids.test.mjs` (node:test): 8 tests que cubren los formatos, casos
  límite y regresiones de `toNumericId`.

### Normalización en el hook de órdenes

- `src/hooks/useWorkOrders.ts` → `parseWorkOrder(order)` aplica
  `toNumericIdArray` a `assigned_user_id` en cada orden entrante. Como
  `.map(parseWorkOrder)` se ejecuta dentro del `queryFn`, React Query entrega
  órdenes ya normalizadas a `number[]` a todos los consumidores.

### Envío (payload)

- Recepción (`ReceptionCheckinForm`) y detalle admin (`AdminOrderDetail`)
  envían `assigned_user_id: JSON.stringify(number[])` en POST/PATCH.

### UI: checkboxes múltiples (RF-2)

- `<select>`/radio de un solo asignado → **checkboxes**, uno por usuario activo,
  con placeholder "No hay usuarios disponibles" si no hay activos.
- `toggleAssignedUser(id)`: alterna el id en el array (agrega si falta, quita si
  está).
- Los ids de los usuarios se normalizan con `toNumericId` dentro del map antes
  del `checked`/`onChange` (el backend puede devolver `u.id` como string).

### Filtro del técnico por inclusión (RF-3)

- `src/utils/orderFilters.ts` → `filterOrdersByAssignedUser(orders, userId)`:
  `toNumericIdArray(o.assigned_user_id).includes(userId)`. Sin userId → lista
  vacía (no se muestran órdenes ajenas).

### OrderCard: un badge por asignado (RF-4)

- `WorkOrderList` resuelve `assignedUsers` con
  `toNumericIdArray(order.assigned_user_id).map((id) => usersMap.get(id)).filter(Boolean)`
  (ids inexistentes se ignoran).
- `OrderCard` pinta un badge por cada mecánico; sin asignados (o ningún id
  coincide con un usuario conocido) → badge rojo "No asignado".

### Documentación

- `API_FRONTEND.md`: `assigned_user_id` documentado como JSON string con array
  de IDs en POST/PATCH de órdenes y en la ruta pública del portal.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/utils/ids.ts` | helpers `toNumericId` / `toNumericIdArray` |
| `tests/ids.test.mjs` | 8 tests del helper |
| `src/hooks/useWorkOrders.ts` | `parseWorkOrder` normaliza `assigned_user_id` |
| `src/components/ReceptionCheckinForm.tsx` | checkboxes + `toggleAssignedUser` + payload JSON.stringify |
| `src/components/AdminOrderDetail.tsx` | checkboxes + `toggleAssignedUser` + payload JSON.stringify |
| `src/utils/orderFilters.ts` | filtro por inclusión |
| `src/components/OrderCard.tsx` | badges múltiples |
| `src/components/WorkOrderList.tsx` | resolución de asignados vía usersMap |
| `API_FRONTEND.md` | contrato del campo actualizado |

## Verificación

- `npm run typecheck` y `npm run build` sin errores.
- `node --test` en verde (8/8).
- Sin referencias huérfanas (`assignedUser=` singular, `<select>` de asignación residual).
