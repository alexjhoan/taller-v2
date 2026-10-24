# Tasks: Asignación múltiple de mecánicos

## Fase 1: Helper de normalización

- [x] T-1: `toNumericId` / `toNumericIdArray` en `src/utils/ids.ts` (tolera array, JSON string, legacy `3`/`"3"`, null/undefined/""; JSON corrupto → `[]`)
- [x] T-2: Tests `tests/ids.test.mjs` con `node:test` (8 tests: formatos, casos límite, regresiones)

## Fase 2: Datos (entrada y salida)

- [x] T-3: `parseWorkOrder` en `src/hooks/useWorkOrders.ts` normaliza `assigned_user_id` a `number[]`
- [x] T-4: Payload de envío como JSON string (`JSON.stringify`) en recepción y detalle admin

## Fase 3: UI

- [x] T-5: Checkboxes múltiples en `ReceptionCheckinForm.tsx` (placeholder si no hay usuarios activos) + `toggleAssignedUser`
- [x] T-6: Checkboxes múltiples en `AdminOrderDetail.tsx` + `toggleAssignedUser`
- [x] T-7: Filtro del técnico por inclusión (`filterOrdersByAssignedUser` en `src/utils/orderFilters.ts`, RF-3)
- [x] T-8: `OrderCard` con un badge por mecánico asignado; vacío/sin match → badge rojo "No asignado" (RF-4)
- [x] T-9: `WorkOrderList` resuelve asignados vía `toNumericIdArray` + `usersMap`

## Fase 4: Normalización de ids de usuario (corrección posterior)

- [x] T-10: `toNumericId` en los checkboxes (recepción y admin) — `u.id` puede venir string y rompía `includes()`/payload
- [x] T-11: Documentar contrato en `API_FRONTEND.md` (JSON string `"[3, 5]"`, `"[]"` = sin asignar)

## Fase 5: Limpieza y verificación

- [x] T-12: Qitar código sin uso detectado con noUnusedLocals (`Car` en OrderCard, `EVIDENCE_*` en TechnicianOrderDetail, `serviceDescription`/`servicePrice` en AdminOrderDetail, `Camera` en ReceptionCheckinForm, `assigned_user_id` no usado en ClientQuotationPortal)
- [x] T-13: `npm run typecheck` → 0 errores
- [x] T-14: `npm run build` → exit 0
- [x] T-15: `node --test` → verde (8/8)

## Estado

- COMPLETADA: todas las tareas cerradas; typecheck, build y tests en verde.
