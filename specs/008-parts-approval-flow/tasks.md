# Tasks: Flujo de aprobación de repuestos

## Fase 1: Helpers puros y datos

- [x] T-1: `src/utils/parts.ts` — helpers puros: `isPartVisibleInPortal` (RF-7), `canTechnicianDeletePart` (RF-13), `getPartActions` (RF-2), `partNeedsPrice` (RF-3), `countOrdersWithPendingParts` (RF-8), y `serializeParts` unificado (migrado desde Admin/Technician).
- Hecho cuando: `src/components/AdminOrderDetail.tsx` y `TechnicianOrderDetail.tsx` importan `serializeParts` desde el helper y sus copias locales están eliminadas.
- [x] T-2: `tests/parts.test.mjs` con `node:test` sobre los helpers (estados `pending`/`approved`/`rejected`/`undefined`, checkin/legacy, JSON corrupto en `parts`, regresiones).
- Hecho cuando: `node --test` queda en verde sumando los tests de `ids.test.mjs`.
- [x] T-3: `src/hooks/useWorkOrders.ts` — `PartItem` con `approvalStatus?` y `requestedByTechnician?` opcionales y sin `reference` (RF-10 interim: el backend aún no devuelve esos campos).
- Hecho cuando: `npm run typecheck` pasa y `ReceptionCheckinForm`/`ClientQuotationPortal` no necesitan casts nuevos por el cambio de tipo.

## Fase 2: Admin — persistencia inmediata y estados (RF-12, RF-5)

- [x] T-4: `src/components/AdminOrderDetail.tsx` — `handleAddPart` crea el repuesto con `approvalStatus: "approved"` y `requestedByTechnician: false` (RF-5); `handleAddPart`, `handleUpdatePart` y `handleDeletePart` persisten de inmediato con `PATCH { id, parts: serializeParts(...), budget_accepted: 0 }`, patrón optimista con rollback y `invalidateQueries(["work_orders"])` (RF-12). `handleSave` sigue staged para vehículo/cliente.
- Hecho cuando: agregar/editar/eliminar un repuesto genera un PATCH inmediato con `budget_accepted: 0` sin pulsar "Guardar Cambios", y un fallo revierte la lista local.
- [x] T-5: `src/components/AdminOrderDetail.tsx` — botones **Aprobar**/**Rechazar** por repuesto según `getPartActions` (RF-2, RF-4); Editar/Eliminar siempre visibles; `handleApprovePart`/`handleRejectPart` marcan `approved`/`rejected` y persisten igual que T-4; sin `approvalStatus` no hay botones de estado.
- Hecho cuando: `pending` muestra Aprobar+Rechazar, `approved` solo Rechazar, `rejected` solo Aprobar, legacy nada; ninguna decisión elimina el repuesto.
- [x] T-6: `src/components/AdminOrderDetail.tsx` — paso de precio al aprobar (RF-3, RF-4): si `partNeedsPrice`, diálogo `CustomDialog` con `NumericInput`; confirmar aprueba con el precio; cancelar deja el repuesto en su estado ORIGINAL (ni muta `approvalStatus`).
- Hecho cuando: aprobar sin `unit_price` pide el precio, cancelar deja `pending` como `pending` (y `rejected` como `rejected`), y con precio ya puesto aprueba directo.
- [x] T-7: `src/components/AdminOrderDetail.tsx` — badge "Solicitud del técnico" (`CustomBadge`) junto al de estado cuando `requestedByTechnician` (RF-9), y `getPartStatusBadge` con caso `undefined` → badge neutro "Ingresado" (decisión 12).
- Hecho cuando: un repuesto del técnico se distingue visualmente y uno legacy/checkin muestra "Ingresado" sin renderizar el valor crudo.

## Fase 3: Técnico (RF-13) y portal (RF-7)

- [x] T-8: `src/components/TechnicianOrderDetail.tsx` — botón eliminar por repuesto SOLO si `canTechnicianDeletePart` (RF-13); `getPartStatusBadge` con "Ingresado" para `undefined`; modal "Solicitar Repuesto" intacto (RF-1).
- Hecho cuando: el técnico ve todos los repuestos con badge, pero solo puede borrar los suyos no aprobados; borrar un repuesto del admin o aprobado no ofrece botón.
- [x] T-9: `src/components/ClientQuotationPortal.tsx` — filtrar `orderParts` con `isPartVisibleInPortal` (RF-7) ANTES del render y de todos los cálculos de totales (useMemo de totales y bloque "Presupuesto Detallado"); el total aceptado gating `decisions[id] === "accepted"` sobre los visibles, conservando el atajo `budget_accepted === 1`.
- Hecho cuando: con datos locales que incluyan `pending`/`rejected`, el portal no los pinta ni los suma; los `undefined` (legacy/checkin) sí aparecen y cuentan (RF-6).

## Fase 4: Dashboard, solo lectura y documentación (RF-8, RF-2, RF-14)

- [x] T-10: `src/components/WorkOrderList.tsx` + `pages/admin/dashboard.tsx` — badge/contador con `countOrdersWithPendingParts(orders)` junto a la lista, visible solo con prop `showPendingPartsCounter` que pasa el dashboard admin (RF-8).
- Hecho cuando: una orden con repuesto `pending` incrementa el contador al refrescar la lista, y la vista del técnico no lo muestra.
- [x] T-11: `src/components/AdminOrderDetailReadOnly.tsx` (historial, `/admin/history`) — `getPartStatusBadge` con "Ingresado" para `undefined` y quitar el `Ref: {part.reference}` (campo obsoleto que ya no viaja); verificar que NO tiene botones de aprobación ni edición (RF-2).
- Hecho cuando: la vista de historial pinta badge de estado sin ningún botón y sin "Ref:" vacío.
- [x] T-12: `API_FRONTEND.md` — documentar el contrato de `parts` (RF-14): campos internos camelCase `id`/`approvalStatus`/`requestedByTechnician`/`criticality` (excepción aprobada, decisión 7), filtrado server-side del portal (RF-11) y envío de `budget_accepted: 0` ante cualquier cambio de repuestos (RF-12).
- Hecho cuando: `API_FRONTEND.md` describe los cuatro campos, el filtrado y el reinicio del presupuesto.

## Fase 5: Limpieza y verificación

- [x] T-13: Limpieza de código huérfano (copias locales de `serializeParts`, `reference`, imports sin uso) + `npm run lint && npm run typecheck` sin errores + `node --test` en verde.
- Hecho cuando: los tres comandos terminan limpios y no quedan restos de `reference` ni duplicados de `serializeParts` fuera del helper.

## Fase 6: Corrección post-validación (acciones por repuesto sin id)

- [x] T-14: `src/utils/parts.ts` — helper puro `assignFallbackPartIds<T extends { id?: string }>(items, generateId)` que devuelve una copia con un id de respaldo (generador inyectado: `generateShortUid`) para cada repuesto sin id (ausente/`undefined`/vacío), sin mutar la entrada y conservando los que ya lo traen; conectado en el `useState` inicial de `src/components/AdminOrderDetail.tsx` y `src/components/TechnicianOrderDetail.tsx`. Cubre RF-2, RF-5, RF-12 y RF-13, y cierra la limitación declarada en spec.md § Limitaciones conocidas ("el frontend genera `id` de respaldo solo en el portal… las acciones del admin/técnico deben tolerar repuestos sin `id`").
- Hecho cuando: con `parts` cargados sin `id`, Eliminar borra SOLO ese repuesto y Aprobar/Rechazar/Editar afectan SOLO al suyo (nada de borrar/editar la lista entera con un clic); los repuestos que ya traen `id` (creados por admin/técnico o devueltos por el backend) quedan intactos; `node --test`, `npm run typecheck` y `npm run build` en verde.

## Fase 7: Cambio de requisito — vocabulario `accepted` (T-15)

> La especificación CAMBIÓ de vocabulario: el valor que significa "aceptado por el
> admin" pasa de `"approved"` a `"accepted"` (`approvalStatus` = `pending` /
> `accepted` / `rejected`). La aprobación del CLIENTE sigue viviendo en
> `budget_accepted` y en las decisiones por repuesto del portal. El `"approved"` del
> `OrderStatus` de la ORDEN NO se renombra. Entradas T-1..T-14 de este archivo
> describen el vocabulario vigente en su momento (histórico).

- [x] T-15: Renombrar el vocabulario del repuesto `approved` → `accepted` en TODOS los
  puntos donde habla de `approvalStatus` (RF-2, RF-4, RF-5, RF-6, RF-7, RF-13, RF-14),
  y hacer que los repuestos creados por el admin o en recepción nazcan `accepted`
  (RF-5/RF-6). Alcance exacto:
  1. `src/utils/parts.ts` — líneas ~38-42 (`isPartVisibleInPortal`), ~51
     (`canTechnicianDeletePart`), ~57-68 (`getPartActions`): `"approved"` → `"accepted"`
     y sus comentarios.
  2. `src/types/index.ts` línea ~19: `PartApprovalStatus = 'accepted' | 'pending' |
     'rejected'`. **NO tocar** el `OrderStatus` de la línea ~11.
  3. `src/components/AdminOrderDetail.tsx` líneas ~397 (`handleAddPart`) y ~460
     (`confirmApprovePart`): `"accepted"`. Línea ~652 (`getPartStatusBadge`):
     `case "accepted"` y texto del badge `Aprobado` → `Aceptado`. Texto visible del
     botón de acción `Aprobar` → `Aceptar` y título/textos del diálogo de precio
     `Aprobar` → `Aceptar`. Los identificadores internos
     `handleApprovePart`/`confirmApprovePart` pueden quedarse si renombrarlos añade
     riesgo (lo decide el implementador); el texto de UI debe decir "Aceptar".
  4. `src/components/AdminOrderDetailReadOnly.tsx` línea ~113: `case "accepted"` +
     texto `Aceptado`.
  5. `src/components/TechnicianOrderDetail.tsx` línea ~323: `case "accepted"` + texto
     `Aceptado` (el borrado condicionado ya usa el helper, no cambia lógica).
  6. `src/components/ReceptionCheckinForm.tsx` (~líneas 202-207, `addPart`): los
     repuestos creados en recepción se crean con `approvalStatus: "accepted"` (además
     de `id`, `name`, `quantity`, `unit_price`). Antes se creaban sin `approvalStatus`
     (legacy/`undefined`).
  7. `tests/parts.test.mjs`: actualizar los casos que usan `'approved'` a `'accepted'`
     (líneas ~18-19, 55-57, 72, 87-88, 134-138, 171, 184, 205, 223) y los títulos de
     los tests.
  8. `API_FRONTEND.md`: la tabla del contrato de `parts` pasa a `pending` / `accepted` /
     `rejected` y los ejemplos deben usar `accepted`; la redacción "aprobado por el
     admin" → "aceptado por el admin". **NO** cambiar los `status: "approved"` de la
     ORDEN en los ejemplos.
- Hecho cuando: no queda ningún `"approved"` dentro de `approvalStatus` (grep limpio:
  `src/utils/parts.ts`, `src/types/index.ts`, los tres componentes de detalle,
  `tests/parts.test.mjs` y `API_FRONTEND.md`); los repuestos creados por el admin y en
  recepción llevan `approvalStatus: "accepted"`; la UI dice "Aceptar"/"Aceptado"; el
  portal sigue mostrando `accepted` y ocultando `pending`/`rejected`; los sitios del
  estado de la ORDEN (`src/utils/const.ts`, `OrderStatus` en `src/types/index.ts`,
  `src/utils/orderFilters.ts`, `status: "approved"` del portal) siguen en `"approved"`;
  `npm run typecheck`, `node --test` (44 tests) y `npm run build` en verde.

## Estado

- **CAMBIO DE REQUISITO (aprobado por el usuario, 2026-10-23)**: el vocabulario de
  `approvalStatus` del repuesto pasa de `approved` a `accepted` (el admin ACEPTA, el
  cliente APRUEBA). `spec.md` y `plan.md` ya reflejan el cambio; la implementación es
  T-15 (HECHA). Motivo: la orden 30 tenía `approvalStatus: "accepted"` escrito a
  mano en la BD y el portal los ocultaba por solo reconocer `"approved"`. Las entradas
  T-1..T-14 de abajo se conservan como histórico con el vocabulario de su momento.
- HECHA: T-1 (helpers puros en `src/utils/parts.ts` + `serializeParts` unificado).
- HECHA: T-3 (`PartItem` con `approvalStatus?`/`requestedByTechnician?` opcionales y sin `reference`; typecheck en verde; se quitó el `Ref:` obsoleto de `AdminOrderDetailReadOnly` como limpieza necesaria para compilar, parte de T-11).
- HECHA: T-4 (repuestos del admin nacen `approved` + persistencia inmediata con PATCH optimista `budget_accepted: 0` y rollback en `AdminOrderDetail`; `npm run typecheck` en verde).
- HECHA: T-5 (botones Aprobar/Rechazar por repuesto según `getPartActions` con Editar/Eliminar siempre visibles; `handleApprovePart`/`handleRejectPart` marcan el estado y persisten vía `persistParts`; estructura preparada para T-6 con `confirmApprovePart`; typecheck y `node --test` en verde).
- HECHA: T-6 (paso de precio al aprobar: si `partNeedsPrice`, `handleApprovePart` abre `CustomDialog` con `NumericInput` —confirmar aprueba con `approvalStatus: "approved"` + `unit_price` vía `confirmApprovePart(part, unitPrice)`, cancelar NO muta nada y el repuesto conserva su estado original; con precio ya puesto aprueba directo; precio 0/vacío deshabilita Confirmar; `npm run typecheck` y `node --test` en verde, 37 pass).
- HECHA: T-7 (badge "Solicitud del técnico" con `CustomBadge variant='info'` junto al de estado solo cuando `requestedByTechnician` es true — RF-9; `getPartStatusBadge` en AdminOrderDetail pinta badge neutro "Ingresado" para `undefined`/desconocido — decisión 12; typecheck y `node --test` en verde, 37 pass).
- HECHA: T-8 (botón eliminar en `TechnicianOrderDetail` oculto salvo `canTechnicianDeletePart(part)` — RF-13: el técnico borra solo sus solicitudes no aprobadas; `getPartStatusBadge` local pinta "Ingresado" neutro para `undefined` — decisión 12; badge "Solicitud del técnico" junto al de estado por consistencia con RF-9; modal "Solicitar Repuesto"/`handleSubmitNewPart` sin cambios — RF-1; `npm run typecheck` en verde y `node --test` en 37 pass).
- HECHA: T-9 (portal: `visibleParts = orderParts.filter(isPartVisibleInPortal)` con `useMemo` — RF-7/RF-6 — consumido por el render, el useMemo de totales, el bloque inline del "Presupuesto Detallado", `handleAcceptAll`/`handleRejectAll` y la comprobación de vacío; total aceptado gating solo `decisions[id] === "accepted"` sobre los visibles con atajo `budget_accepted === 1` conservado — RF-7; contador de rechazados también solo por decisión del cliente; `npm run typecheck` en verde y `node --test` en 37 pass).
- HECHA: T-10 (badge `CustomBadge variant='warning'` con `dot` junto al título de la lista con `countOrdersWithPendingParts(orders)`, solo con `showPendingPartsCounter` — default `false`, así `TechnicianOrderList` NO lo ve — RF-8; con 0 no se pinta nada; pluralización singular/plural; el dashboard admin es el único que pasa `showPendingPartsCounter={true}`; `npm run typecheck` en verde y `node --test` en 37 pass).
- HECHA: T-11 (vista de solo lectura del historial: `getPartStatusBadge` pinta badge neutro "Ingresado" para `undefined`/desconocido — decisión 12, igual que T-7/T-8; verificado que no quedan usos de `part.reference` — ya lo había quitado T-3 — y que el render de repuestos no tiene ningún botón de Aprobar/Rechazar/Editar/Eliminar, solo el badge — RF-2; `npm run typecheck` en verde y `node --test` en 37 pass).
- HECHA: T-2 (`tests/parts.test.mjs` con `node:test`: 29 tests sobre `isPartVisibleInPortal`, `canTechnicianDeletePart`, `getPartActions`, `partNeedsPrice`, `countOrdersWithPendingParts` y `serializeParts`, cubriendo estados `pending`/`approved`/`rejected`/`undefined`/`null`, checkin/legacy, JSON corrupto en `parts` y regresiones; `node --test` en verde sumando los de `ids.test.mjs`, 37 pass).
- HECHA: T-15 (vocabulario `accepted`: `isPartVisibleInPortal`/`canTechnicianDeletePart`/
  `getPartActions` y sus comentarios; `PartApprovalStatus = 'accepted' | 'pending' |
  'rejected'` con el `OrderStatus` de la ORDEN intacto; `AdminOrderDetail` escribe
  `accepted` al agregar y al aceptar, badge "Aceptado", botón y diálogo de precio en
  "Aceptar" — identificadores `handleApprovePart`/`confirmApprovePart` conservados;
  badges "Aceptado" en `AdminOrderDetailReadOnly` y `TechnicianOrderDetail`;
  `ReceptionCheckinForm` crea el repuesto con `approvalStatus: "accepted"` y lo envía en
  el JSON de `parts`; `tests/parts.test.mjs` migrado a `accepted` (44 pass);
  `API_FRONTEND.md` con `pending`/`accepted`/`rejected` y redacción "aceptado por el
  admin"; typecheck, `node --test` (44) y `npm run build` (12 páginas) en verde).
  Los sitios del `"approved"` de la ORDEN (`const.ts`, `OrderStatus`, `orderFilters`,
  `status: "approved"` del portal) NO se tocaron.
- HECHA: T-13 (limpieza final + verificación: guardia de permiso interna en `deletePart` de `TechnicianOrderDetail` —RF-13, defensa en profundidad antes de persistir—; auditoría de huérfanos sin hallazgos: cero copias locales de `serializeParts`, cero usos de `reference` en los componentes, cero imports sin uso y el portal consume solo `visibleParts`; `npm run typecheck`, `node --test` (37 pass) y `npm run build` en verde; `npm run lint` NO ejecutable: el repo no tiene configuración de ESLint —sin `.eslintrc*`, `eslint.config.*` ni `eslintConfig` en `package.json`— y `next lint` abre el asistente interactivo; preexistente, fuera del alcance de la spec).
- HECHA: T-12 (`API_FRONTEND.md` actualizado — RF-14: sección "Contrato de `parts`" con la tabla de 8 campos, la excepción camelCase declarada (decisión 7) con nota cruzada en §12, ejemplo con `pending` + `requestedByTechnician: true` + legacy, subsección de persistencia inmediata con `budget_accepted: 0` (RF-12/D1), nota de filtrado server-side del portal (RF-11) en §7 y el contrato backend RF-10 marcado como requisito pendiente; actualizado también el ejemplo de `POST /{table}` en §3; typecheck en verde y `node --test` en 37 pass).
- HECHA: T-14 (corrección post-validación, pérdida de datos con `parts` sin id — RF-2/RF-5/RF-12/RF-13 y limitación de spec.md § Limitaciones conocidas: "el frontend genera `id` de respaldo solo en el portal"): helper puro `assignFallbackPartIds(items, generateId)` en `src/utils/parts.ts` (copia nueva, no muta la entrada, conserva los id existentes —incluido el numérico legacy— y da uno por repuesto sin id, ausente/`undefined`/`""`), conectado en el `useState` inicial de `AdminOrderDetail` y `TechnicianOrderDetail` con inicializador diferido para que el id se asigne UNA vez al montar y sea estable en toda la sesión; los `filter`/`map` por `p.id` de las acciones NO se tocaron. Decisión (elegida por el usuario): el generador se INYECTA (`generateShortUid` ya importado en ambos componentes) en lugar de importarlo en `parts.ts`, porque `node --test` (Node 25, type stripping) no resuelve imports relativos sin extensión ni `@/` y `tsc` exige `allowImportingTsExtensions` en tsconfig para el sufijo `.ts` — se evitó tocar `tsconfig.json` y duplicar la lógica de `uid.ts`. 7 tests nuevos en `tests/parts.test.mjs` (sin id → recibe respaldo, id existente conservado, array vacío, `""`/`undefined` con ids distintos, id numérico intacto, no muta la entrada, `generateShortUid` real); TDD: rojo primero (importación inexistente) y después verde. `node --test` 44 pass, `npm run typecheck` y `npm run build` (12 páginas) en verde. Pendiente documental CERRADO: `spec.md` sincronizada con T-14 (§ Limitaciones conocidas reescrita como RESUELTO, nuevo criterio de finalización para las acciones por repuesto sin `id`, y `Estado:` actualizado).
